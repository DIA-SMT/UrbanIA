-- EnableExtensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OFFICIAL', 'TECHNICIAN', 'CITIZEN');

-- CreateEnum
CREATE TYPE "RegulationType" AS ENUM ('ORDINANCE', 'DECREE', 'URBAN_CODE', 'BUILDING_CODE', 'REPORT');

-- CreateEnum
CREATE TYPE "GeometryType" AS ENUM ('POINT', 'LINESTRING', 'POLYGON', 'MULTIPOLYGON');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_DATA', 'FEASIBLE', 'NOT_FEASIBLE', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProposalSource" AS ENUM ('CITIZEN', 'OFFICIAL', 'CABINET', 'TECHNICAL_TEAM');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('NEW', 'ANALYZING', 'CONVERTED_TO_PROPOSAL', 'DISCARDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CITIZEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regulation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "RegulationType" NOT NULL,
    "number" TEXT,
    "summary" TEXT,
    "sourceUrl" TEXT,
    "fileUrl" TEXT,
    "fullText" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "chunkIndex" INTEGER NOT NULL,
    "embeddingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT,
    "country" TEXT NOT NULL,
    "population" INTEGER,
    "areaKm2" DOUBLE PRECISION,
    "density" DOUBLE PRECISION,
    "climate" TEXT,
    "description" TEXT,
    "similarity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "results" TEXT,
    "cost" TEXT,
    "sourceUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrbanIndicator" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceUrl" TEXT,

    CONSTRAINT "UrbanIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrbanLayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "geometryType" "GeometryType" NOT NULL,
    "visibleByDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UrbanLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapFeature" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "geometry" geometry NOT NULL,

    CONSTRAINT "MapFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "ProposalSource" NOT NULL DEFAULT 'CITIZEN',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CabinetMeeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "area" TEXT,
    "participants" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CabinetMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CabinetIdea" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IdeaStatus" NOT NULL DEFAULT 'NEW',
    "proposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CabinetIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiQuery" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UrbanLayer_slug_key" ON "UrbanLayer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_proposalId_userId_key" ON "Vote"("proposalId", "userId");

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "Regulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudy" ADD CONSTRAINT "CaseStudy_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrbanIndicator" ADD CONSTRAINT "UrbanIndicator_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapFeature" ADD CONSTRAINT "MapFeature_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "UrbanLayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CabinetIdea" ADD CONSTRAINT "CabinetIdea_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CabinetMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateSpatialIndex
CREATE INDEX IF NOT EXISTS "MapFeature_geometry_idx" ON "MapFeature" USING GIST ("geometry");
