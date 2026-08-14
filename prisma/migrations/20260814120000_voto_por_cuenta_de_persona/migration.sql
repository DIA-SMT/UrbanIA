-- El apoyo vuelve a contarse por cuenta, ahora que hay una cuenta por persona.
--
-- Cierra lo que 20260721140000_norm_support_by_voter_name dejo anotado como
-- provisorio. Ese cambio paso la unicidad de la cuenta al nombre declarado porque
-- las direcciones compartian una cuenta institucional y el segundo que votaba
-- pisaba el voto del primero. Con Cidituc como unico acceso cada persona entra
-- con su propia cuenta, asi que userId vuelve a alcanzar para identificar al
-- votante y voterName deja de tener que hacerlo.
--
-- Lo que se gana: el navegador ya no declara a nombre de quien vota. El servidor
-- lo toma de la sesion, y con eso el conteo deja de ser falsificable. Tambien
-- deja de romperse cuando un admin corrige el nombre de una cuenta desde
-- Configuracion: el voto cuelga del userId y no del texto.
--
-- Los apoyos ya cargados se descartan por decision del equipo: salieron de un
-- esquema que nunca fue verificable y no tiene sentido arrastrarlos a uno que si
-- lo es. voterName se conserva en la tabla, pero solo como sello para mostrar.

-- Vaciar antes de cambiar la unicidad no es opcional: la regla vieja permitia
-- varios votos de la misma cuenta sobre la misma norma (uno por nombre), y esas
-- filas harian fallar el CREATE UNIQUE INDEX de mas abajo.
DELETE FROM "NormSupport";

DROP INDEX IF EXISTS "NormSupport_projectId_voterName_key";
CREATE UNIQUE INDEX IF NOT EXISTS "NormSupport_projectId_userId_key" ON "NormSupport"("projectId", "userId");
