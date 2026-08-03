-- La grabacion de una audiencia en vivo se guarda en TRAMOS: una fila de
-- MeetingMedia por tramo. Hacen falta dos datos que el modelo no tenia.
--
-- partIndex: el orden del tramo dentro de la grabacion.
-- offsetMs:  en que milisegundo de la audiencia arranca ese tramo. Es el offset
--            que recibe Whisper para que los timestamps de cada tramo caigan en
--            el minuto real. NO se puede derivar sumando duraciones: los tramos
--            se solapan a proposito (para no perder audio en el borde) y la
--            suma acumularia error a lo largo de la audiencia.
--
-- Ambas nullable: un archivo unico (ingesta batch) no las usa. La tabla no
-- tiene filas todavia, asi que no hay backfill.
ALTER TABLE "MeetingMedia" ADD COLUMN "partIndex" INTEGER;
ALTER TABLE "MeetingMedia" ADD COLUMN "offsetMs" INTEGER;
