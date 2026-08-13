-- Un archivo del bucket = UNA fila de MeetingMedia.
-- Sin esto, dos registros concurrentes del mismo tramo (el navegador reintenta
-- cuando la confirmacion se pierde en la red) pasaban los dos por el chequeo de
-- existencia y creaban filas duplicadas. Como las filas de MeetingMedia son la
-- cola de trabajo de la transcripcion, el mismo audio se transcribia dos veces.
CREATE UNIQUE INDEX "MeetingMedia_meetingId_storagePath_key" ON "MeetingMedia"("meetingId", "storagePath");
