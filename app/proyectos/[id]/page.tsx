import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getProject } from "@/lib/projects/data";
import { ProjectDetail } from "@/components/projects/project-detail";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) notFound();

  const project = await getProject(id).catch(() => null);
  if (!project) notFound();

  const session = await getSessionUser();
  const canEdit = session ? isStaff(session.role) : false;
  const canDelete = session?.role === "ADMIN";

  const cabinetMeetings = await prisma.cabinetMeeting
    .findMany({ orderBy: { meetingDate: "desc" }, take: 100, select: { id: true, title: true } })
    .catch(() => []);

  return (
    <AppShell>
      <ProjectDetail project={project} canEdit={canEdit} canDelete={canDelete} cabinetMeetings={cabinetMeetings} />
    </AppShell>
  );
}
