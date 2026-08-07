import { LoginPage } from "@/components/auth/login-page";
import { ciditucProvider } from "@/lib/auth/identity/cidituc";

export const metadata = {
  title: "Ingresar | UrbanIA",
  description: "Acceso municipal a UrbanIA mediante Cidituc."
};

export const dynamic = "force-dynamic";

type IngresarPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function IngresarPage({ searchParams }: IngresarPageProps) {
  const params = await searchParams;

  return <LoginPage initialError={params?.error} ciditucEnabled={ciditucProvider.isEnabled()} />;
}
