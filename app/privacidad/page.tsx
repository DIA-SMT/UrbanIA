import { LegalDocumentPage } from "@/components/public/legal-document";
import { PRIVACY } from "@/lib/legal/content";

export const metadata = {
  title: "Politica de Privacidad | UrbanIA",
  description: "Que datos personales trata UrbanIA, para que, con quienes se comparten y como ejercer tus derechos."
};

export default function PrivacidadPage() {
  return <LegalDocumentPage document={PRIVACY} />;
}
