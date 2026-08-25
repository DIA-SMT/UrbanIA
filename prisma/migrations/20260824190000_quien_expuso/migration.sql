-- Quien presento cada documento en la audiencia.
--
-- El analisis del PDF ya devolvia `organization` (el colegio, consejo,
-- universidad u ONG que lo aporto) pero se descartaba al confirmar: no habia
-- donde guardarlo. Es el dato de "quien expuso" del resumen de la audiencia, que
-- hasta ahora salia solo de los participantes cargados a mano.
ALTER TABLE "ReformDocument" ADD COLUMN "organization" TEXT;
