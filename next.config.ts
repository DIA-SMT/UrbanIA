import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "pdfjs-dist"],
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
