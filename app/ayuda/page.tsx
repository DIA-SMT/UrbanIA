import { PublicHelp } from "@/components/public/public-help";

export const metadata = {
  title: "Ayuda | UrbanIA",
  description: "Guia paso a paso del portal ciudadano de UrbanIA: el Codigo, Migue, propuestas y audiencias publicas."
};

/**
 * Centro de ayuda PUBLICO. Es una pantalla del portal ciudadano: no usa el
 * AppShell interno (que expondria la navegacion del sistema municipal) ni
 * carga el manual del equipo. La guia interna vive en /admin/ayuda.
 */
export default function AyudaPage() {
  return <PublicHelp />;
}
