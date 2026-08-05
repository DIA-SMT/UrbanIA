import { AppShell } from "@/components/shell";
import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata = {
  title: "Configuración | UrbanIA",
  description: "Usuarios, roles, permisos y auditoría de UrbanIA."
};

/**
 * Armazón visual de Configuración. La autorización NO vive acá: los layouts no
 * se re-ejecutan en cada navegación cliente, así que cada página valida su
 * permiso con requireSettingsAccess.
 */
export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SettingsShell>{children}</SettingsShell>
    </AppShell>
  );
}
