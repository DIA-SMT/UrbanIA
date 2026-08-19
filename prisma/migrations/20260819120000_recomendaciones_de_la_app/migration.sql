-- Recomendaciones sobre UrbanIA como herramienta: lo que el vecino sugiere,
-- reporta o cuenta de su experiencia usando el portal.
--
-- Tabla aparte de "CitizenContribution" a proposito, aunque el formulario se
-- parezca: un aporte ciudadano entra al circuito de la reforma del Codigo (se le
-- asigna un eje, se vincula a una propuesta, lo trabaja el area). Esto no entra a
-- ese circuito y mezclarlos ensuciaria las dos bandejas.
--
-- Pensada para ejecutarse a mano en el editor SQL de Supabase (base compartida:
-- nunca `migrate dev`). Si despues se usa Prisma Migrate, marcarla aplicada con:
--   npx prisma migrate resolve --applied 20260819120000_recomendaciones_de_la_app

-- Los tipos van con guarda: en Postgres CREATE TYPE no admite IF NOT EXISTS, y sin
-- esto una segunda corrida del archivo entero aborta en la primera linea.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppFeedbackKind') THEN
        CREATE TYPE "AppFeedbackKind" AS ENUM ('SUGGESTION', 'PROBLEM', 'EXPERIENCE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppFeedbackStatus') THEN
        CREATE TYPE "AppFeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'ARCHIVED');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AppFeedback" (
    "id" TEXT NOT NULL,
    "kind" "AppFeedbackKind" NOT NULL,
    "text" TEXT NOT NULL,
    -- Copia del nombre al momento de enviar: si la cuenta se borra, el equipo
    -- sigue sabiendo de quien venia. Mismo criterio que CitizenContribution.
    "name" TEXT NOT NULL,
    "status" "AppFeedbackStatus" NOT NULL DEFAULT 'NEW',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppFeedback_createdAt_idx" ON "AppFeedback"("createdAt");
CREATE INDEX IF NOT EXISTS "AppFeedback_status_idx" ON "AppFeedback"("status");
CREATE INDEX IF NOT EXISTS "AppFeedback_kind_idx" ON "AppFeedback"("kind");

-- SET NULL y no CASCADE: si se borra la cuenta del vecino, la recomendacion queda
-- para el municipio. Lo unico que se pierde es el enlace para contestarle.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AppFeedback_userId_fkey'
    ) THEN
        ALTER TABLE "AppFeedback"
            ADD CONSTRAINT "AppFeedback_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- Verificacion posterior (correr aparte). Tiene que devolver la tabla vacia:
--   SELECT count(*) FROM "AppFeedback";
