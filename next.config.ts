import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "pdfjs-dist", "@napi-rs/canvas"],
  // El loader de @napi-rs/canvas elige el binario nativo con un require
  // computado (canvas-<plataforma>) que el tracer no puede seguir: sin esto,
  // la funcion serverless viaja sin el .node y pdfjs muere con "DOMMatrix is
  // not defined" al procesar cualquier PDF.
  outputFileTracingIncludes: {
    "/**": ["node_modules/@napi-rs/canvas-linux-x64-gnu/**"]
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
