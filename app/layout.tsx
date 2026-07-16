import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "UrbanIA | Deliberacion urbana",
  description: "Plataforma para trazabilidad, normativa, propuestas oficiales, audiencias publicas y analisis urbano con IA."
};

const themeInitializer = `(function(){try{var t=localStorage.getItem("urbania-theme")==="dark"?"dark":"light";var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.classList.toggle("urban-light",t==="light");d.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
