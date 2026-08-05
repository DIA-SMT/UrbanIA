import { redirect } from "next/navigation";

/** Configuración abre en su pantalla principal: Usuarios. */
export default function ConfiguracionPage() {
  redirect("/admin/configuracion/usuarios");
}
