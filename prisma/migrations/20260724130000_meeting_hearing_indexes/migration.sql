-- El registro de audiencias filtra por kind y ordena por occurredAt desc; los
-- conteos del board agrupan por kind + hearingStatus. Meeting solo tenia indice
-- por reformId, asi que ambas consultas escaneaban la tabla completa de
-- reuniones (que incluye las que no son audiencias).
CREATE INDEX "Meeting_kind_occurredAt_idx" ON "Meeting"("kind", "occurredAt" DESC);
CREATE INDEX "Meeting_kind_hearingStatus_idx" ON "Meeting"("kind", "hearingStatus");
