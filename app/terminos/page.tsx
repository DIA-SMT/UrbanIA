import { LegalDocumentPage } from "@/components/public/legal-document";
import { TERMS } from "@/lib/legal/content";

export const metadata = {
  title: "Terminos de Uso | UrbanIA",
  description: "Condiciones de uso de UrbanIA, la plataforma municipal para la reforma del Codigo de Planeamiento Urbano."
};

export default function TerminosPage() {
  return <LegalDocumentPage document={TERMS} />;
}
