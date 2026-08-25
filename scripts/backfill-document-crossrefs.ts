/**
 * Completa, para los documentos ya cargados, los dos datos que el resumen de la
 * audiencia necesita y que en su momento no se guardaron:
 *
 *   1. `organization` — quién expuso. El análisis siempre lo detectó, pero hasta
 *      ahora sólo se usaba para el texto de la nota de trazabilidad y después se
 *      descartaba. Sin esto, la página "Quiénes expusieron" nombra a cada
 *      organización por el nombre de su archivo.
 *   2. `crossReferences` — contra qué artículos del Código impacta cada
 *      propuesta, y los NormativeLink correspondientes. El cruce se agregó
 *      después de que estos PDF se confirmaran, así que quedaron sin él.
 *
 * Cruza las NORMAS ya fabricadas (lo que una persona revisó y aceptó), no el PDF
 * entero: al modelo le alcanza con el título y el resumen de cada una, y así el
 * backfill es una llamada corta por documento en vez de un reanálisis completo.
 *
 * Por defecto sólo informa. Para escribir en la base hay que pasar --apply.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env.local \
 *     scripts/backfill-document-crossrefs.ts --apply
 */
import { prisma } from "../lib/db/prisma";
import { askUrbanAssistant } from "../lib/ai/openrouter";
import { extractPdfText, sanitizePdfText } from "../lib/pdf/extract-text";
import {
  crossReferenceProposals,
  CROSS_RELATIONSHIP_LABELS,
  type ProposalCrossReference
} from "../lib/normas/analyze-document";
import { loadCodeIndex, resolveArticleIds } from "../lib/normas/code-index";
import { downloadNormDocument } from "../lib/storage/supabase";

/*
 * `--env-file` de Node no descarta el BOM del archivo, así que la PRIMERA
 * variable de un .env.local guardado como UTF-8 con BOM queda registrada como
 * "﻿NEXT_PUBLIC_SUPABASE_URL" y nadie la encuentra: el script se cae con
 * "Supabase Storage no está configurado" teniendo las credenciales delante.
 */
for (const [clave, valor] of Object.entries(process.env)) {
  if (clave.charCodeAt(0) === 0xfeff) process.env[clave.slice(1)] = valor;
}

const apply = process.argv.includes("--apply");

/** Sólo el encabezado: quién presenta se dice en la portada, no en la página 20. */
const ORGANIZATION_PROMPT = [
  "Sos un asistente que identifica QUIEN PRESENTO un documento en una audiencia publica municipal.",
  "Te paso las primeras paginas de un PDF presentado en la audiencia.",
  "Devolves EXCLUSIVAMENTE un objeto JSON con esta forma: {\"organization\": \"...\"} o {\"organization\": null}.",
  "- organization: el colegio, consejo, camara, universidad, facultad, ONG, agrupacion o area de gobierno que presenta el documento.",
  "- Usa el nombre completo tal como aparece, sin siglas sueltas: 'Colegio de Arquitectos de Tucuman', no 'CAT'. Si el documento usa la sigla y tambien el nombre desplegado, devolve el nombre desplegado.",
  "- NO devuelvas nombres de personas: si el documento sólo lo firman individuos, devolve null.",
  "- Si no podes identificarla con seguridad, devolve null. Un dato inventado es peor que ninguno."
].join("\n");

async function detectOrganization(bytes: Uint8Array, fileName: string): Promise<string | null> {
  const extraction = await extractPdfText(bytes, { maxPages: 6, maxChars: 8_000 });
  const text = sanitizePdfText(extraction.text).trim();
  if (text.length < 120) return null;

  const response = await askUrbanAssistant(
    [
      { role: "system", content: ORGANIZATION_PROMPT },
      { role: "user", content: `ARCHIVO: ${fileName}\n\n${text}\n\nDevolve el JSON pedido.` }
    ],
    { model: process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o", json: true, temperature: 0, maxTokens: 200 }
  );

  try {
    const parsed = JSON.parse(response.answer) as { organization?: unknown };
    const value = typeof parsed.organization === "string" ? parsed.organization.trim() : "";
    return value && value.length <= 200 ? value : null;
  } catch {
    return null;
  }
}

async function main() {
  const codeIndex = await loadCodeIndex();
  console.log(`indice del Codigo: ${codeIndex.length} articulos`);
  if (!apply) console.log("MODO INFORME: no se escribe nada. Agregá --apply para guardar.\n");

  const documents = await prisma.reformDocument.findMany({
    where: { storagePath: { not: null } },
    orderBy: { uploadedAt: "asc" },
    select: { id: true, name: true, storagePath: true, organization: true, crossReferences: true }
  });
  console.log(`a revisar: ${documents.length} documentos\n`);

  let conOrganizacion = 0;
  let conCruce = 0;
  let enlaces = 0;

  for (const [indice, document] of documents.entries()) {
    const etiqueta = `[${indice + 1}/${documents.length}] ${document.name.slice(0, 46)}`;
    const storagePath = document.storagePath as string;

    // 1. Quién expuso.
    let organizacion = document.organization;
    if (!organizacion) {
      try {
        organizacion = await detectOrganization(await downloadNormDocument(storagePath), document.name);
      } catch (error) {
        // Un PDF escaneado no tiene capa de texto y no hay de dónde leerlo: se
        // deja sin organización y el resumen lo nombra por su archivo.
        console.log(`${etiqueta} -> organizacion: ${error instanceof Error ? error.message.slice(0, 60) : "fallo"}`);
      }
      if (organizacion) {
        conOrganizacion += 1;
        if (apply) await prisma.reformDocument.update({ where: { id: document.id }, data: { organization: organizacion } });
      }
    }

    // 2. El cruce de las normas que salieron de este PDF.
    const attachments = await prisma.projectAttachment.findMany({
      where: { storagePath },
      orderBy: { createdAt: "asc" },
      select: { project: { select: { id: true, title: true, summary: true } } }
    });
    const norms = attachments
      .map((attachment) => attachment.project)
      .filter((project) => Boolean(project?.title?.trim()))
      .map((project) => ({ id: project!.id, title: project!.title, summary: project!.summary ?? "" }));

    if (!norms.length) {
      console.log(`${etiqueta} -> ${organizacion ?? "sin organizacion"} | sin normas`);
      continue;
    }

    let cruce = new Map<number, ProposalCrossReference[]>();
    try {
      cruce = await crossReferenceProposals(norms, codeIndex);
    } catch (error) {
      console.log(`${etiqueta} -> cruce FALLO: ${error instanceof Error ? error.message.slice(0, 60) : "error"}`);
      continue;
    }

    const crossReferences = norms
      .map((norm, posicion) => ({ proposalTitle: norm.title, articles: cruce.get(posicion) ?? [] }))
      .filter((entry) => entry.articles.length);

    const detalle = crossReferences
      .flatMap((entry) => entry.articles.map((article) => `${CROSS_RELATIONSHIP_LABELS[article.relationship]} art.${article.number}`))
      .join(", ");
    console.log(
      `${etiqueta} -> ${organizacion ?? "sin organizacion"} | ${norms.length} normas | ${crossReferences.length} con cruce${
        detalle ? ` (${detalle})` : ""
      }`
    );

    if (!crossReferences.length) continue;
    conCruce += 1;
    if (!apply) continue;

    await prisma.reformDocument.update({ where: { id: document.id }, data: { crossReferences } });

    /*
     * El ancla formal: los ids se resuelven contra la base --nunca se confía en
     * el número que devolvió el modelo--.
     *
     * Antes de escribir se borran los enlaces de un backfill anterior. El cruce
     * no es determinista: dos corridas sobre la misma norma pueden elegir
     * artículos distintos, y sin este borrado la segunda dejaría los dos juegos
     * pegados, con el expediente diciendo que la propuesta toca el doble de
     * artículos de los que toca. Los enlaces hechos a mano o por el importador
     * no se tocan: se filtran por `createdBy`.
     */
    for (const [posicion, norm] of norms.entries()) {
      const articles = cruce.get(posicion) ?? [];
      if (!articles.length) continue;
      await prisma.normativeLink.deleteMany({ where: { sourceType: "project", sourceId: norm.id, createdBy: "backfill" } });
      const ids = await resolveArticleIds(articles.map((article) => article.number));
      for (const article of articles) {
        const articleId = ids.get(article.number);
        if (!articleId) continue;
        await prisma.normativeLink
          .create({
            data: {
              sourceType: "project",
              sourceId: norm.id,
              articleId,
              relationshipType: article.relationship,
              notes: article.why || null,
              createdBy: "backfill"
            }
          })
          .then(() => {
            enlaces += 1;
          })
          .catch(() => {
            // Ya existía: el cruce ya estaba asentado.
          });
      }
    }
  }

  console.log(
    `\nRESUMEN: ${conOrganizacion} organizaciones detectadas, ${conCruce} documentos con cruce, ${enlaces} enlaces nuevos${
      apply ? "" : " (nada guardado: falta --apply)"
    }`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
