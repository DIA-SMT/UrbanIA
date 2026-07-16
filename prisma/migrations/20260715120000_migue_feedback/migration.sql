-- Feedback ciudadano sobre las respuestas de Migue (pulgares + motivo + comentario).
CREATE TABLE "MigueFeedback" (
    "id" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "comment" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sourceReference" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigueFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MigueFeedback_rating_createdAt_idx" ON "MigueFeedback"("rating", "createdAt");
