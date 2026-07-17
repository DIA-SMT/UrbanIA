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

/** yyyy-mm-dd de hoy corrido `years` anios atras. */
function isoYearsAgo(years: number): string {
  const now = new Date();
  const day = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  const month = String(day.getMonth() + 1).padStart(2, "0");

  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, "0")}`;
}

export default async function IngresarPage({ searchParams }: IngresarPageProps) {
  const params = await searchParams;

  // Los limites se calculan en el server para que coincidan con ageFrom() del
  // registro: el cliente no puede ofrecer una fecha que el servidor va a rechazar.
  return (
    <LoginPage
      initialError={params?.error}
      initialMode={params?.mode === "register" ? "register" : "login"}
      maxBirthDate={isoYearsAgo(18)}
      minBirthDate={isoYearsAgo(120)}
    />
  );
}
