-- El documento aportado a la reforma pasa a saber en QUE AUDIENCIA se presento.
--
-- Un PDF llega a la reforma porque alguien lo expuso en una audiencia publica,
-- asi que su lugar es el expediente de esa audiencia. Hasta ahora colgaba solo
-- de la reforma y no habia forma de saber de donde habia salido.
--
-- Nullable a proposito: los 15 documentos ya cargados no tienen manera
-- automatica de resolverse (los nombres dan pistas, pero son 15 archivos y 9
-- audiencias, y adivinar mal ensucia un expediente publico). Se asignan a mano
-- desde la pantalla de la reforma.
--
-- SetNull y no Cascade: borrar una audiencia no puede llevarse el documento, que
-- sigue siendo parte del material de la reforma.
ALTER TABLE "ReformDocument" ADD COLUMN "meetingId" TEXT;

ALTER TABLE "ReformDocument"
  ADD CONSTRAINT "ReformDocument_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ReformDocument_meetingId_idx" ON "ReformDocument"("meetingId");
