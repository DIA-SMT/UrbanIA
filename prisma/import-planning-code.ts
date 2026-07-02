import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KnowledgeSourceKind, PrismaClient, ProcessingStatus } from "@prisma/client";

const prisma = new PrismaClient();
const SOURCE_ID = "codigo-planeamiento-smt-2014";
const SOURCE_PATH = join(process.cwd(), "data", "codigo-planeamiento-2014.txt");
const MAX_CHARS = 6_000;

function chunkText(text: string) {
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > MAX_CHARS) {
      chunks.push(current);
      current = "";
    }

    if (paragraph.length > MAX_CHARS) {
      if (current) chunks.push(current);
      for (let start = 0; start < paragraph.length; start += MAX_CHARS) {
        chunks.push(paragraph.slice(start, start + MAX_CHARS));
      }
      continue;
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  if (current) chunks.push(current);
  return chunks;
}

async function main() {
  const rawText = (await readFile(SOURCE_PATH, "utf8")).replace(/^\uFEFF/, "").trim();
  const chunks = chunkText(rawText);
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  const source = await prisma.knowledgeSource.upsert({
    where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId: SOURCE_ID } },
    update: {
      title: "Código de Planeamiento Urbano de San Miguel de Tucumán (2014)",
      filePath: "data/codigo-planeamiento-2014.txt",
      mimeType: "text/plain",
      status: ProcessingStatus.READY,
      rawText,
      wordCount,
      processedAt: new Date(),
      metadata: { jurisdiction: "San Miguel de Tucumán", year: 2014, source: "proyecto legado" }
    },
    create: {
      kind: KnowledgeSourceKind.REGULATION,
      externalId: SOURCE_ID,
      title: "Código de Planeamiento Urbano de San Miguel de Tucumán (2014)",
      filePath: "data/codigo-planeamiento-2014.txt",
      mimeType: "text/plain",
      status: ProcessingStatus.READY,
      rawText,
      wordCount,
      processedAt: new Date(),
      metadata: { jurisdiction: "San Miguel de Tucumán", year: 2014, source: "proyecto legado" }
    }
  });

  await prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
  await prisma.knowledgeChunk.createMany({
    data: chunks.map((content, chunkIndex) => ({
      sourceId: source.id,
      chunkIndex,
      content,
      tokenEstimate: Math.ceil(content.length / 4),
      metadata: { source: SOURCE_ID, chunkIndex }
    }))
  });

  console.log(`Importación completa: ${wordCount} palabras, ${chunks.length} fragmentos.`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
