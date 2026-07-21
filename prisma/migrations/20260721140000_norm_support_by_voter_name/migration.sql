-- El apoyo pasa a contarse por nombre y no por cuenta.
--
-- Motivo: las direcciones entran con una cuenta institucional compartida, y el
-- unique (projectId, userId) permitia UN voto por norma para toda la direccion.
-- El segundo que votaba pisaba el voto del primero en vez de sumar el suyo.
--
-- PROVISORIO, y conviene que quede escrito: voterName es texto declarado en
-- pantalla, no una identidad verificada. Cualquiera con la cuenta abierta puede
-- votar eligiendo otro nombre. El conteo sirve como termometro de trabajo interno;
-- no es una votacion formal y no deberia citarse como tal en un expediente.
-- La solucion real es una cuenta por persona: cuando exista, voterName se
-- reemplaza por userId y este archivo queda como registro de por que se hizo asi.

-- Nullable primero para poder completar las filas que ya existen.
ALTER TABLE "NormSupport" ADD COLUMN "voterName" TEXT;

-- Los votos ya emitidos se atribuyen a la cuenta que los emitio: es lo unico que
-- se sabe de ellos con certeza, y perderlos seria peor que atribuirlos asi.
UPDATE "NormSupport" AS s
SET "voterName" = u."name"
FROM "User" AS u
WHERE s."userId" = u."id" AND s."voterName" IS NULL;

-- Red de seguridad por si quedara alguna fila sin usuario resoluble.
UPDATE "NormSupport" SET "voterName" = 'Sin identificar' WHERE "voterName" IS NULL;

ALTER TABLE "NormSupport" ALTER COLUMN "voterName" SET NOT NULL;

-- Se reemplaza la regla de unicidad. No se pierde ninguna fila: cambia por que
-- clave se evita el voto duplicado, de la cuenta al nombre declarado.
DROP INDEX "NormSupport_projectId_userId_key";
CREATE UNIQUE INDEX "NormSupport_projectId_voterName_key" ON "NormSupport"("projectId", "voterName");
