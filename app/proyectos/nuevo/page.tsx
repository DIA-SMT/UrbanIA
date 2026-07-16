import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { ProjectForm } from "@/components/projects/project-form";

export const dynamic = "force-dynamic";

export default async function NuevoProyectoPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/ingresar");
  }
  if (!isStaff(session.role)) {
    redirect("/proyectos");
  }

  let proposals: Array<{ id: string; title: string }> = [];
  let meetings: Array<{ id: string; title: string }> = [];

  if (process.env.DATABASE_URL) {
    try {
      [proposals, meetings] = await Promise.all([
        prisma.proposal.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true } }),
        prisma.meeting.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true } })
      ]);
    } catch (error) {
      console.error("No se pudieron cargar datos para el formulario de proyecto", error);
    }
  }

  return (
    <AppShell>
      <ProjectForm proposals={proposals} meetings={meetings} />
    </AppShell>
  );
}
