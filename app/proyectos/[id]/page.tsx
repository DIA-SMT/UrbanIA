import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ProjectDetail } from "@/components/projects/project-detail";
import { getProposalById } from "@/lib/proposals/data";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) notFound();

  const project = await getProposalById(id).catch(() => null);
  if (!project) notFound();

  return (
    <AppShell>
      <ProjectDetail project={project} />
    </AppShell>
  );
}
