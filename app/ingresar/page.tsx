import { LoginPage } from "@/components/auth/login-page";

export const metadata = {
  title: "Ingresar | UrbanIA",
  description: "Acceso a la gestion interna de UrbanIA."
};

type IngresarPageProps = {
  searchParams?: Promise<{
    error?: string;
    mode?: string;
  }>;
};

export default async function IngresarPage({ searchParams }: IngresarPageProps) {
  const params = await searchParams;

  return <LoginPage initialError={params?.error} initialMode={params?.mode === "register" ? "register" : "login"} />;
}
