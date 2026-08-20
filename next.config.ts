import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static en la lista: el paquete resuelve la ruta del binario relativa
  // a su propio archivo, y empaquetado por Next esa ruta apunta adentro de
  // .next/ donde el ejecutable no existe (spawn ...vendor-chunks/ffmpeg ENOENT).
  // Externalizado, se resuelve en runtime desde node_modules, donde si esta.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "pdfjs-dist", "@napi-rs/canvas", "ffmpeg-static"],
  // Dos dependencias de pdfjs se cargan dinamicamente y el tracer no las ve:
  // el binario nativo de @napi-rs/canvas (require computado canvas-<plataforma>,
  // sin el "DOMMatrix is not defined") y su propio worker pdf.worker.mjs
  // (import dinamico, sin el "Setting up fake worker failed"). Ambos vistos
  // en produccion, 2026-08-01. Se fuerzan a mano en el bundle de las funciones.
  // El binario de onnxruntime (34 MB) va SOLO a las rutas que embeben: metido
  // en "/**" sumaba 34 MB a cada funcion y el deploy revento el limite de
  // tamano (fallo del 2026-08-03). canvas+pdfjs si van globales: son livianos
  // y los usan varias rutas de PDF.
  // Los logos institucionales (lib/brand/document-shell.ts) se leen con
  // readFileSync(cwd + ruta armada en runtime): el tracer tampoco los ve, asi
  // que en Vercel las funciones salian SIN public/brand. Los exports de normas
  // degradan en silencio (documento sin escudo), pero el resumen ejecutivo de
  // audiencias los exige y devolvia "Identidad institucional no disponible".
  // Son ~155 KB entre los cinco PNG: van globales.
  outputFileTracingIncludes: {
    "/**": [
      "node_modules/@napi-rs/canvas-linux-x64-gnu/**",
      "node_modules/pdfjs-dist/legacy/build/**",
      "public/brand/**"
    ],
    "/api/assistant": ["node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
    "/api/cpu": ["node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
    // Todo el modulo de audiencias vive en /api/hearings (antes estaba partido
    // en la coleccion y /[id]; se unieron por el tope de 12 funciones). Esta
    // funcion es la mas cargada del proyecto: onnx para indexar + Chromium para
    // el resumen ejecutivo. Por eso ffmpeg sigue afuera, en /api/hearings/audio.
    //
    // LOS CORCHETES VAN ESCAPADOS Y NO ES UN DETALLE. Next matchea estas claves
    // con picomatch, asi que son GLOBS: sin escapar, "[[...segments]]" se lee
    // como una clase de caracteres y la clave no matchea NUNCA con la ruta. No
    // avisa: el build pasa, el deploy pasa, y la funcion sale sin los binarios.
    // Fue exactamente lo que rompio el resumen ejecutivo en PDF entre el
    // 2026-08-13 (cuando /[id] --que si matcheaba-- se fusiono en el catch-all)
    // y el 2026-08-18. Con "\\[" picomatch toma el corchete como literal.
    // La clave tiene que seguir sin matchear /api/hearings/audio: Chromium ahi,
    // sumado a ffmpeg, arriesga el limite de tamano del bundle.
    // Hay un chequeo que lo verifica en cada build: scripts/check-tracing-keys.ts.
    "/api/hearings/\\[\\[...segments\\]\\]": [
      "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
      // El resumen ejecutivo se exporta con @sparticuz/chromium en Vercel.
      // Sus .br se resuelven en runtime y el tracer de Next no los detecta.
      "node_modules/@sparticuz/chromium/bin/**",
      // Los logos se leen desde el filesystem para convertirlos en data URI.
      // Vercel sirve public por separado y no los agrega a la funcion salvo que
      // el tracer los incluya de manera explicita. (Ademas van globales via
      // public/brand/** en "/**": el mismo fix llego por dos caminos y ambos
      // son inofensivos, asi que se conservan los dos.)
      "public/brand/logo-ciudad-smt-blanco.png",
      "public/brand/logo-municipalidad-smt-iso.png",
      "public/brand/logo-direccion-ia.png"
    ],
    // La descarga del audio completo une los tramos con ffmpeg. El binario
    // (~80 MB) va SOLO a esta ruta: sumado a Chromium+onnx en la ruta general
    // arriesgaria el limite de tamano del bundle.
    "/api/hearings/audio": ["node_modules/ffmpeg-static/**"]
  },
  outputFileTracingExcludes: {
    // Vercel ejecuta Linux x64. El paquete onnxruntime también instala binarios
    // de macOS, Windows y Linux ARM64; si quedan en esta función, junto con
    // Chromium exceden con facilidad el tamaño permitido del bundle.
    // Corchetes escapados por el mismo motivo que arriba: sin escapar, esta
    // exclusión tampoco se aplicaba y la función viajaba con los binarios de las
    // cuatro plataformas.
    "/api/hearings/\\[\\[...segments\\]\\]": [
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**"
    ]
  },
  async rewrites() {
    /*
     * Por que hay rewrites: el plan Hobby de Vercel admite 12 funciones
     * serverless por deploy y cada route.ts cuenta una. Se llego a 18 y el
     * deploy empezo a fallar con "No more than 12 Serverless Functions", asi que
     * los modulos se fusionaron. Estas dos reescrituras mantienen vivas las URLs
     * de siempre, sin tocar ni un fetch del cliente.
     *
     * OJO con lo que un rewrite NO puede hacer: el query que se inyecta en el
     * `destination` NO le llega al route handler (probado en dev, 2026-08-13).
     * Por eso las rutas /api/<modulo>/<id> se resolvieron con catch-all opcional
     * ([[...segments]]) y no reescribiendo a `?id=`. Aca solo quedan casos que
     * NO dependen de inyectar nada: el query original del cliente si se preserva.
     */
    return {
      beforeFiles: [],
      afterFiles: [
        // El mapa entra por la ruta del codigo vigente: las dos son lectura de
        // datos urbanos, ninguna trae dependencias pesadas y sus `action` no se
        // pisan (layers/features contra articulos/search/links). El cliente
        // sigue llamando /api/map?action=... y ese action viaja en la request.
        { source: "/api/map", destination: "/api/normativa" },
        /*
         * El callback de Cidituc. Su handler YA estaba expuesto en /api/auth, asi
         * que su route.ts era una segunda puerta al mismo codigo. Se reescribe en
         * vez de cambiar CIDITUC_CALLBACK_URL: la URL que el Derivador tiene
         * registrada del lado de Cidituc sigue siendo exactamente la misma.
         * Destino con SEGMENTO y no con `?action=` a proposito (ver arriba).
         */
        { source: "/auth/cidituc/callback", destination: "/api/auth/cidituc-callback" }
      ],
      fallback: []
    };
  },
  async redirects() {
    return [
      // El modulo Proyectos se reconvirtio en la Fabrica de Normas.
      { source: "/proyectos", destination: "/normas", permanent: false },
      { source: "/proyectos/:path*", destination: "/normas", permanent: false },
      /*
       * El dominio viejo de Vercel manda todo al dominio nuevo.
       *
       * UrbanIA se mudo a urbania.smt.gob.ar pero urban-ia-kappa.vercel.app
       * seguia sirviendo la aplicacion COMPLETA, sin redirigir. Eso rompia el
       * ingreso de una forma que no se arregla reintentando: quien entraba por
       * el dominio viejo --un favorito, un link de WhatsApp, el autocompletado--
       * dejaba la cookie del state en vercel.app, el Derivador lo devolvia a
       * urbania.smt.gob.ar, y la cookie no viaja entre dominios distintos.
       * Resultado: "la solicitud de acceso vencio o no coincide", siempre.
       *
       * Se redirige en vez de dar de baja el dominio para que los enlaces que ya
       * circulan sigan funcionando, con su ruta: quien tenia guardado
       * /audiencias-publicas llega a /audiencias-publicas.
       *
       * permanent:false a proposito. Un 308 queda cacheado en el navegador de
       * forma casi irreversible, y si algun dia hay que volver a usar el dominio
       * de Vercel --una prueba, un rollback-- nadie podria entrar.
       */
      {
        source: "/:path*",
        has: [{ type: "host", value: "urban-ia-kappa.vercel.app" }],
        destination: "https://urbania.smt.gob.ar/:path*",
        permanent: false
      }
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;
