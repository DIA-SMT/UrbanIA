import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Acceso server-side a Supabase Storage para los documentos adjuntos de las
 * audiencias. Usa la service role key si está configurada (recomendado: los
 * uploads server-side saltean las políticas RLS del bucket); si no, cae a la
 * anon key (requiere que el bucket permita insert anónimo). Los archivos van a
 * un bucket público, así el link de descarga es directo.
 */

const BUCKET = process.env.SUPABASE_HEARINGS_BUCKET ?? "audiencias";
/** Bucket de los PDFs aportados a la Fabrica de Normas. Separado del de audiencias. */
const NORMS_BUCKET = process.env.SUPABASE_NORMS_BUCKET ?? "normas";

/** True si hay URL + alguna key para operar el storage. */
export function hasSupabaseStorage(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase Storage no está configurado");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Nombre de archivo seguro para usar como parte de una ruta del bucket. */
function safeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-]/g, "_") || "documento";
}

export type UploadedDocument = { storagePath: string; url: string };

/**
 * Sube el archivo al bucket bajo <meetingId>/<timestamp>-<nombre> y devuelve su URL pública.
 *
 * TODO (bug latente en produccion): el archivo pasa por la ruta de API
 * /api/hearings/[id]/documents, que acepta hasta 15 MB. En Vercel el body de
 * una funcion serverless se corta en ~4,5 MB, asi que ahi va a fallar todo lo
 * que supere ese tamano. El importador de normas ya resuelve esto subiendo
 * directo al bucket con signed URL (createNormDocumentUploadUrl): cuando se
 * arregle, conviene mover audiencias al mismo patron.
 */
export async function uploadHearingDocument(input: {
  meetingId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<UploadedDocument> {
  const supabase = client();
  const safeName = safeFileName(input.fileName);
  const storagePath = `${input.meetingId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.contentType, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { storagePath, url: data.publicUrl };
}

/** Borra el objeto del bucket. No falla si ya no existe. */
export async function removeHearingDocument(storagePath: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}

/* ------------------- Bucket de normas (PDFs de la reforma) ----------------- */
/*
 * A diferencia de audiencias, aca el archivo NUNCA pasa por una ruta de Next:
 * el limite acordado es 30 MB y Vercel corta el body de una funcion serverless
 * en ~4,5 MB. El browser sube directo al bucket con una signed URL y despues le
 * manda a la API solo el storagePath; la API baja el archivo server-to-server
 * cuando necesita leerlo.
 */

/** True si se puede operar el bucket de normas. */
export function hasNormsStorage(): boolean {
  return hasSupabaseStorage();
}

/**
 * URL firmada para que el browser suba el PDF directo al bucket.
 * Devuelve tambien el storagePath, que es lo unico que despues viaja a la API.
 */
export async function createNormDocumentUploadUrl(input: {
  reformId: string;
  fileName: string;
}): Promise<{ storagePath: string; token: string; signedUrl: string }> {
  const supabase = client();
  const storagePath = `${input.reformId}/${Date.now()}-${safeFileName(input.fileName)}`;

  const { data, error } = await supabase.storage.from(NORMS_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar la subida");

  return { storagePath, token: data.token, signedUrl: data.signedUrl };
}

/** Baja el PDF del bucket para extraerle el texto en el servidor. */
export async function downloadNormDocument(storagePath: string): Promise<Uint8Array> {
  const supabase = client();
  const { data, error } = await supabase.storage.from(NORMS_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el documento");
  return new Uint8Array(await data.arrayBuffer());
}

/** Link publico del PDF, para mostrarlo en la ficha de la norma. */
export function getNormDocumentPublicUrl(storagePath: string): string {
  const supabase = client();
  return supabase.storage.from(NORMS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Borra el objeto del bucket de normas. */
export async function removeNormDocument(storagePath: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.storage.from(NORMS_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}
