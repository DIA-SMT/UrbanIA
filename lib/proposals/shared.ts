import type { ProposalSource, ProposalStatus } from "@prisma/client";

/**
 * Vocabulario compartido para propuestas reales (modelo Prisma `Proposal`).
 * Un "proyecto" es una propuesta en etapa avanzada del flujo municipal.
 */

export const proposalStatusLabels: Record<ProposalStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Presentada",
  UNDER_REVIEW: "En revision",
  NEEDS_DATA: "Requiere datos",
  FEASIBLE: "Factible",
  NOT_FEASIBLE: "No factible",
  APPROVED: "Aprobada",
  IN_PROGRESS: "En ejecucion",
  COMPLETED: "Finalizada",
  ARCHIVED: "Archivada"
};

export const proposalSourceLabels: Record<ProposalSource, string> = {
  CITIZEN: "Ciudadana",
  OFFICIAL: "Oficial",
  CABINET: "Gabinete",
  TECHNICAL_TEAM: "Area tecnica"
};

// Estados que convierten una propuesta en "proyecto" (pantalla Proyectos).
export const PROJECT_STATUSES: ProposalStatus[] = ["APPROVED", "IN_PROGRESS", "COMPLETED"];

export type ProposalListItem = {
  id: string;
  title: string;
  description: string;
  status: ProposalStatus;
  source: ProposalSource;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  votes: number;
  comments: number;
  citizen: { name: string; zone: string; axis: string } | null;
};
