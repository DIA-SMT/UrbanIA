// Sin "server-only": lo usan rutas de Next, pero el helper de storage ya lo es.
// Se mantiene liviano para poder compartirlo entre la subida de documentos y la
// carga de audiencia por PDF.

import { prisma } from "@/lib/db/prisma";
import { ensureHearingRecord } from "@/lib/hearings/record";
import { getHearingDocumentPublicUrl, uploadHearingDocument } from "@/lib/storage/supabase";

/**
 * Guarda un archivo como documento adjunto de una audiencia: sube el objeto a
 * Supabase Storage y crea la fila HearingDocument del expediente. Centraliza lo
 * que compartían la subida manual de documentos y la carga de audiencia por PDF.
 * La ingesta al conocimiento de Migue es aparte (ingestHearingReport), porque es
 * lenta y conviene diferirla con `after()`.
 */
export async function attachHearingDocument(input: {
  meetingId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  fileSize: number;
  uploadedByName?: string | null;
}): Promise<{ documentId: string; url: string; storagePath: string }> {
  const uploaded = await uploadHearingDocument({
    meetingId: input.meetingId,
    fileName: input.fileName,
    contentType: input.contentType || "application/octet-stream",
    bytes: input.bytes
  });

  const registered = await registerHearingDocument({
    meetingId: input.meetingId,
    fileName: input.fileName,
    contentType: input.contentType,
    storagePath: uploaded.storagePath,
    fileSize: input.fileSize,
    uploadedByName: input.uploadedByName
  });

  return { documentId: registered.documentId, url: registered.url, storagePath: uploaded.storagePath };
}

/**
 * Registra como HearingDocument un objeto que YA está en el bucket (subida
 * directa del browser con signed URL). No sube nada: solo la fila del
 * expediente y la URL pública.
 */
export async function registerHearingDocument(input: {
  meetingId: string;
  fileName: string;
  contentType: string;
  storagePath: string;
  fileSize: number;
  uploadedByName?: string | null;
}): Promise<{ documentId: string; url: string }> {
  const recordId = await ensureHearingRecord(input.meetingId);
  const extension = input.fileName.slice(input.fileName.lastIndexOf(".")).toLowerCase();
  const url = getHearingDocumentPublicUrl(input.storagePath);

  const document = await prisma.hearingDocument.create({
    data: {
      hearingRecordId: recordId,
      name: input.fileName,
      type: input.contentType || extension.replace(".", "").toUpperCase(),
      url,
      storagePath: input.storagePath,
      sizeBytes: input.fileSize,
      uploadedBy: input.uploadedByName ?? null
    },
    select: { id: true }
  });

  return { documentId: document.id, url };
}
