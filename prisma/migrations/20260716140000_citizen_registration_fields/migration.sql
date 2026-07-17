-- Datos del registro ciudadano: para presentar una propuesta o reclamo hace falta
-- cuenta, y el vecino declara documento, fecha de nacimiento (se exigen 18 años
-- cumplidos) y ocupación. Todas nullable: las cuentas municipales ya existentes no
-- los tienen y se siguen creando sin pasar por el registro ciudadano.
ALTER TABLE "User" ADD COLUMN "dni" TEXT;
ALTER TABLE "User" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "occupation" TEXT;

-- Un documento no puede repetirse entre vecinos. El índice único de Postgres
-- admite varios NULL, así que las cuentas sin DNI conviven sin chocar.
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");
