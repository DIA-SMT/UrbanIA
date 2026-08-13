import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { NewDebateForm } from "@/components/foro/new-debate-form";
import { getSessionUser } from "@/lib/auth/api";
import { hasPermission } from "@/lib/auth/permissions";
import { listLinkableItems } from "@/lib/foro/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nuevo debate | Foro | UrbanIA"
};

export default async function NuevoDebatePage() {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!hasPermission(session, "debates.create")) redirect("/foro");

  const linkable = await listLinkableItems();

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-5">
          <p className="eyebrow">Foro de debates</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">Nuevo debate</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Una pregunta concreta debate mejor que un tema amplio. El contexto explica qué se discute y por qué ahora.
          </p>
        </div>
        <NewDebateForm linkable={linkable} />
      </div>
    </AppShell>
  );
}
