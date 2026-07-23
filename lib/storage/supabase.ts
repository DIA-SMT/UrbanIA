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

export type UploadedDocument = { storagePath: string; url: string };

/** Sube el archivo al bucket bajo <meetingId>/<timestamp>-<nombre> y devuelve su URL pública. */
export async function uploadHearingDocument(input: {
  meetingId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<UploadedDocument> {
  const supabase = client();
  const safeName = input.fileName.replace(/[^\w.\-]/g, "_") || "documento";
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
