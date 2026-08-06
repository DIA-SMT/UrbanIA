-- Foro interno de debates (Fase 1).
-- Ejecutar a mano en el editor SQL de Supabase (base compartida: nunca `migrate dev`).
-- Si después se usa Prisma Migrate, marcarla aplicada con:
--   npx prisma migrate resolve --applied 20260806130000_foro_debates

CREATE TYPE "DebateStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "DebateStance" AS ENUM ('FOR', 'AGAINST', 'NEUTRAL');
CREATE TYPE "DebateArgumentStatus" AS ENUM ('VISIBLE', 'HIDDEN');

CREATE TABLE "Debate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "status" "DebateStatus" NOT NULL DEFAULT 'OPEN',
    "closesAt" TIMESTAMP(3),
    "proposalId" TEXT,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Debate_status_createdAt_idx" ON "Debate"("status", "createdAt");

ALTER TABLE "Debate" ADD CONSTRAINT "Debate_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Debate" ADD CONSTRAINT "Debate_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Debate" ADD CONSTRAINT "Debate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DebateArgument" (
    "id" TEXT NOT NULL,
    "debateId" TEXT NOT NULL,
    "authorId" TEXT,
    "stance" "DebateStance" NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "status" "DebateArgumentStatus" NOT NULL DEFAULT 'VISIBLE',
    "hiddenById" TEXT,
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateArgument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DebateArgument_debateId_status_createdAt_idx" ON "DebateArgument"("debateId", "status", "createdAt");

ALTER TABLE "DebateArgument" ADD CONSTRAINT "DebateArgument_debateId_fkey"
    FOREIGN KEY ("debateId") REFERENCES "Debate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebateArgument" ADD CONSTRAINT "DebateArgument_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DebateArgument" ADD CONSTRAINT "DebateArgument_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "DebateArgument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebateArgument" ADD CONSTRAINT "DebateArgument_hiddenById_fkey"
    FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DebateArgumentSupport" (
    "id" TEXT NOT NULL,
    "argumentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateArgumentSupport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DebateArgumentSupport_argumentId_userId_key" ON "DebateArgumentSupport"("argumentId", "userId");

ALTER TABLE "DebateArgumentSupport" ADD CONSTRAINT "DebateArgumentSupport_argumentId_fkey"
    FOREIGN KEY ("argumentId") REFERENCES "DebateArgument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebateArgumentSupport" ADD CONSTRAINT "DebateArgumentSupport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
