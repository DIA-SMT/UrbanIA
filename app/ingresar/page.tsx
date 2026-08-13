import { redirect } from "next/navigation";
import { LoginPage } from "@/components/auth/login-page";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";
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

  /*
   * Con sesión activa esta pantalla no tiene nada que ofrecer: mostrarle el
   * botón de Cidituc a alguien que ya ingresó es lo que hacía que la gente
   * creyera que no habia entrado. Se la manda a donde iba.
   *
   * El destino sale del PERMISO, no del rol, igual que el menú del portal: si
   * mañana se le concede internal.view a Ciudadano desde la matriz, esas cuentas
   * empiezan a caer en /admin sin tocar este archivo.
   *
   * Con `?error=` no se redirige: ese parámetro trae el motivo de un ingreso
   * fallido y una sesión vieja no puede taparlo.
   */
  if (!params?.error) {
    const session = await getSessionUser();
    if (session) redirect(canViewInternal(session) ? "/admin" : "/");
  }

  return <LoginPage initialError={params?.error} ciditucEnabled={ciditucProvider.isEnabled()} />;
}
