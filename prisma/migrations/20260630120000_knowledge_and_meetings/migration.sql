CREATE TYPE "KnowledgeSourceKind" AS ENUM ('REGULATION','REPORT','WEB_PAGE','MEETING','FILE','MANUAL');
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING','PROCESSING','READY','ERROR');
CREATE TYPE "MeetingKind" AS ENUM ('MEETING','PUBLIC_HEARING','CABINET','TECHNICAL_COMMITTEE');
CREATE TYPE "MediaKind" AS ENUM ('AUDIO','VIDEO');
CREATE TYPE "MeetingInsightKind" AS ENUM ('DECISION','COMMITMENT','RISK','QUESTION','CONFLICT','REGULATION_REFERENCE');
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED');

CREATE TABLE "KnowledgeSource" (
 "id" TEXT PRIMARY KEY, "kind" "KnowledgeSourceKind" NOT NULL, "externalId" TEXT,
 "title" TEXT NOT NULL, "sourceUrl" TEXT, "filePath" TEXT, "mimeType" TEXT,
 "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING', "rawText" TEXT, "summary" TEXT,
 "metadata" JSONB NOT NULL DEFAULT '{}', "wordCount" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 "processedAt" TIMESTAMP(3)
);
CREATE TABLE "KnowledgeChunk" (
 "id" TEXT PRIMARY KEY, "sourceId" TEXT NOT NULL, "chunkIndex" INTEGER NOT NULL,
 "content" TEXT NOT NULL, "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
 "metadata" JSONB NOT NULL DEFAULT '{}', "embedding" vector(1536),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Meeting" (
 "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "kind" "MeetingKind" NOT NULL DEFAULT 'MEETING',
 "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING', "occurredAt" TIMESTAMP(3),
 "location" TEXT, "description" TEXT, "language" TEXT NOT NULL DEFAULT 'es',
 "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "MeetingMedia" (
 "id" TEXT PRIMARY KEY, "meetingId" TEXT NOT NULL, "kind" "MediaKind" NOT NULL,
 "fileName" TEXT NOT NULL, "storagePath" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "sizeBytes" BIGINT, "durationSec" INTEGER, "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
 "errorMessage" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "MeetingParticipant" (
 "id" TEXT PRIMARY KEY, "meetingId" TEXT NOT NULL, "displayName" TEXT NOT NULL,
 "role" TEXT, "email" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE "TranscriptSegment" (
 "id" TEXT PRIMARY KEY, "meetingId" TEXT NOT NULL, "participantId" TEXT, "speakerLabel" TEXT,
 "startMs" INTEGER NOT NULL, "endMs" INTEGER NOT NULL, "content" TEXT NOT NULL,
 "confidence" DOUBLE PRECISION, "metadata" JSONB NOT NULL DEFAULT '{}',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "MeetingAnalysis" (
 "id" TEXT PRIMARY KEY, "meetingId" TEXT NOT NULL, "provider" TEXT, "model" TEXT,
 "version" INTEGER NOT NULL DEFAULT 1, "summary" TEXT NOT NULL,
 "conclusions" JSONB NOT NULL DEFAULT '[]', "topics" JSONB NOT NULL DEFAULT '[]',
 "risks" JSONB NOT NULL DEFAULT '[]', "citations" JSONB NOT NULL DEFAULT '[]',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "MeetingInsight" (
 "id" TEXT PRIMARY KEY, "meetingId" TEXT NOT NULL, "kind" "MeetingInsightKind" NOT NULL,
 "title" TEXT NOT NULL, "description" TEXT NOT NULL, "importance" INTEGER NOT NULL DEFAULT 3,
 "evidence" JSONB NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "MeetingActionItem" (
 "id" TEXT PRIMARY KEY, "meetingId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
 "assignee" TEXT, "dueDate" TIMESTAMP(3), "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
 "evidence" JSONB NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "KnowledgeSource_kind_externalId_key" ON "KnowledgeSource"("kind","externalId");
CREATE INDEX "KnowledgeSource_kind_idx" ON "KnowledgeSource"("kind");
CREATE INDEX "KnowledgeSource_status_idx" ON "KnowledgeSource"("status");
CREATE UNIQUE INDEX "KnowledgeChunk_sourceId_chunkIndex_key" ON "KnowledgeChunk"("sourceId","chunkIndex");
CREATE INDEX "KnowledgeChunk_sourceId_chunkIndex_idx" ON "KnowledgeChunk"("sourceId","chunkIndex");
CREATE INDEX "MeetingMedia_meetingId_idx" ON "MeetingMedia"("meetingId");
CREATE INDEX "MeetingMedia_status_idx" ON "MeetingMedia"("status");
CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");
CREATE INDEX "TranscriptSegment_meetingId_startMs_idx" ON "TranscriptSegment"("meetingId","startMs");
CREATE UNIQUE INDEX "MeetingAnalysis_meetingId_version_key" ON "MeetingAnalysis"("meetingId","version");
CREATE INDEX "MeetingInsight_meetingId_kind_idx" ON "MeetingInsight"("meetingId","kind");
CREATE INDEX "MeetingActionItem_meetingId_status_idx" ON "MeetingActionItem"("meetingId","status");

ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingMedia" ADD CONSTRAINT "MeetingMedia_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAnalysis" ADD CONSTRAINT "MeetingAnalysis_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingInsight" ADD CONSTRAINT "MeetingInsight_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
