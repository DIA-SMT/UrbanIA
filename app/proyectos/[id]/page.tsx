import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { Project360 } from "@/components/projects/project-360";
import { getUrbanProject, urbanProjects } from "@/lib/demo/urban-projects";

export function generateStaticParams() { return urbanProjects.map((project) => ({ id: project.id })); }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getUrbanProject(id);
  if (!project) notFound();
  return <AppShell><Project360 project={project} /></AppShell>;
}
