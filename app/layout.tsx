import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UrbanIA | Deliberacion urbana",
  description: "Plataforma para trazabilidad, normativa, propuestas oficiales, audiencias publicas y analisis urbano con IA."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
