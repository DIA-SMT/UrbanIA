import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "pdfjs-dist", "@napi-rs/canvas"],
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
    "/api/hearings": ["node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
    "/api/hearings/[id]": [
      "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
      // El resumen ejecutivo se exporta con @sparticuz/chromium en Vercel.
      // Sus .br se resuelven en runtime y el tracer de Next no los detecta.
      "node_modules/@sparticuz/chromium/bin/**"
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
    "/api/hearings/[id]": [
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**"
    ]
  },
  async redirects() {
    // El modulo Proyectos se reconvirtio en la Fabrica de Normas.
    return [
      { source: "/proyectos", destination: "/normas", permanent: false },
      { source: "/proyectos/:path*", destination: "/normas", permanent: false }
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
