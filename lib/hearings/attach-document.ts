// Sin "server-only": lo usan rutas de Next, pero el helper de storage ya lo es.
// Se mantiene liviano para poder compartirlo entre la subida de documentos y la
// carga de audiencia por PDF.

import { prisma } from "@/lib/db/prisma";
import { ensureHearingRecord } from "@/lib/hearings/record";
import { uploadHearingDocument } from "@/lib/storage/supabase";

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

  const recordId = await ensureHearingRecord(input.meetingId);
  const extension = input.fileName.slice(input.fileName.lastIndexOf(".")).toLowerCase();

  const document = await prisma.hearingDocument.create({
    data: {
      hearingRecordId: recordId,
      name: input.fileName,
      type: input.contentType || extension.replace(".", "").toUpperCase(),
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      sizeBytes: input.fileSize,
      uploadedBy: input.uploadedByName ?? null
    },
    select: { id: true }
  });

  return { documentId: document.id, url: uploaded.url, storagePath: uploaded.storagePath };
}
