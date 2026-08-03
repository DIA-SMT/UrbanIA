import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "pdfjs-dist", "@napi-rs/canvas"],
  // Dos dependencias de pdfjs se cargan dinamicamente y el tracer no las ve:
  // el binario nativo de @napi-rs/canvas (require computado canvas-<plataforma>,
  // sin el "DOMMatrix is not defined") y su propio worker pdf.worker.mjs
  // (import dinamico, sin el "Setting up fake worker failed"). Ambos vistos
  // en produccion, 2026-08-01. Se fuerzan a mano en el bundle de las funciones.
  outputFileTracingIncludes: {
    "/**": [
      "node_modules/@napi-rs/canvas-linux-x64-gnu/**",
      "node_modules/pdfjs-dist/legacy/build/**",
      // onnxruntime elige su binario nativo con un require computado por
      // plataforma que el tracer no sigue; sin esto, los embeddings locales
      // (e5) no arrancan en la funcion y el RAG queda solo con texto.
      "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"
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
