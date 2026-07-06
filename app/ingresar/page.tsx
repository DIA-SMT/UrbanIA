import { LoginPage } from "@/components/auth/login-page";

export const metadata = {
  title: "Ingresar | UrbanIA",
  description: "Acceso a la gestion interna de UrbanIA."
};

export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  const params = await searchParams;
  return <LoginPage initialMode={params.mode === "register" ? "register" : "login"} error={params.error} />;
}
