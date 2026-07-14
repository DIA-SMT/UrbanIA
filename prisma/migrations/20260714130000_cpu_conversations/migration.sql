-- CreateTable
CREATE TABLE "CpuConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nueva consulta',
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpuConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpuMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "retrieved" JSONB NOT NULL DEFAULT '[]',
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpuMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CpuConversation_ownerKey_archived_updatedAt_idx" ON "CpuConversation"("ownerKey", "archived", "updatedAt");

-- CreateIndex
CREATE INDEX "CpuMessage_conversationId_createdAt_idx" ON "CpuMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CpuMessage" ADD CONSTRAINT "CpuMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CpuConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
