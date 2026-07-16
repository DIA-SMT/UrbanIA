import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { listProjects } from "@/lib/projects/data";
import { ProjectsBoard } from "@/components/projects/projects-board";
import type { ProjectListItem } from "@/lib/projects/shared";

export const dynamic = "force-dynamic";

export default async function ProyectosPage() {
  let projects: ProjectListItem[] = [];
  let isLive = false;

  if (process.env.DATABASE_URL) {
    try {
      projects = await listProjects();
      isLive = true;
    } catch (error) {
      console.error("No se pudo listar los proyectos", error);
    }
  }

  const session = await getSessionUser();
  const canCreate = session ? isStaff(session.role) : false;

  return (
    <AppShell>
      <ProjectsBoard projects={projects} isLive={isLive} canCreate={canCreate} />
    </AppShell>
  );
}
