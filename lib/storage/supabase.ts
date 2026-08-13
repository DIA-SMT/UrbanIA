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
 * Solo para archivos que YA están en el server (p. ej. la carga de audiencia
 * por PDF). La subida manual de documentos va por signed URL directo al bucket
 * (createHearingDocumentUploadUrl), igual que el importador de normas: el body
 * de una función en Vercel se corta en ~4,5 MB y acá se prometen 15.
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

/**
 * URL firmada para que el browser suba el documento directo al bucket de
 * audiencias, sin pasar por una función (mismo patrón que las normas).
 */
export async function createHearingDocumentUploadUrl(input: {
  meetingId: string;
  fileName: string;
}): Promise<{ storagePath: string; token: string; signedUrl: string }> {
  const supabase = client();
  const storagePath = `${input.meetingId}/${Date.now()}-${safeFileName(input.fileName)}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar la subida");

  return { storagePath, token: data.token, signedUrl: data.signedUrl };
}

/** Baja el documento del bucket (verificación e ingesta al conocimiento). */
export async function downloadHearingDocument(storagePath: string): Promise<Uint8Array> {
  const supabase = client();
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el documento");
  return new Uint8Array(await data.arrayBuffer());
}

/** Link público de un documento de audiencia ya subido. */
export function getHearingDocumentPublicUrl(storagePath: string): string {
  const supabase = client();
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
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

/* ---------------- Bucket del audio de las audiencias (privado) ------------- */
/*
 * La grabacion de una audiencia en vivo NO va al bucket de documentos: ese es
 * publico y esto son voces de vecinos identificables. Bucket PRIVADO, y para
 * escuchar se firma una URL que vence.
 *
 * La grabacion se guarda en TRAMOS independientes (part-000, part-001, ...),
 * no en un archivo unico: cada tramo se sube apenas se cierra (si el navegador
 * muere, se pierde el ultimo tramo y no la audiencia entera) y cada uno entra
 * solo en una llamada a Whisper, sin necesidad de partirlo con ffmpeg del lado
 * del servidor. El indice va con ceros a la izquierda para que el orden
 * alfabetico sea el cronologico.
 */

const AUDIO_BUCKET = process.env.SUPABASE_HEARING_AUDIO_BUCKET ?? "audiencias-audio";
/**
 * Tope por objeto del bucket. Un tramo pesa ~1,2 MB, pero aca tambien vive el
 * MP3 UNIDO de la audiencia entera (~44 MB por hora y media a 64 kbps): el
 * tope original de 25 MB rechazaba esa subida. 50 MB es el MAXIMO que permite
 * el free tier de Supabase (tope global por archivo; pedir mas falla con "The
 * object exceeded the maximum allowed size"). Para que audiencias largas
 * entren igual, el export baja el bitrate segun la duracion (audio-export.ts).
 */
const AUDIO_FILE_LIMIT = "50MB";

let audioBucketReady: Promise<void> | null = null;

/** Crea el bucket privado si no existe y ajusta su tope (idempotente, una vez por instancia). */
function ensureAudioBucket(): Promise<void> {
  audioBucketReady ??= (async () => {
    const supabase = client();
    const { error } = await supabase.storage.createBucket(AUDIO_BUCKET, { public: false, fileSizeLimit: AUDIO_FILE_LIMIT });
    if (error && !/already exists/i.test(error.message)) {
      audioBucketReady = null;
      throw new Error(error.message);
    }
    // El bucket puede existir de antes con el tope viejo de 25 MB: se actualiza.
    if (error) {
      await supabase.storage.updateBucket(AUDIO_BUCKET, { public: false, fileSizeLimit: AUDIO_FILE_LIMIT }).catch(() => {});
    }
  })();
  return audioBucketReady;
}

/**
 * Ruta del tramo dentro del bucket. Indice con ceros: orden alfabetico =
 * cronologico.
 *
 * El nonce (identificador del tramo, lo genera la grabadora) va en el nombre
 * para que la ruta identifique al TRAMO y no solo a su numero: dos tramos
 * DISTINTOS que compartan indice -- dos maquinas retomando la misma audiencia,
 * o una copia rescatada de IndexedDB despues de renumerar el bucket a mano --
 * escriben en rutas distintas en vez de pisarse.
 *
 * Los tramos guardados antes de que existiera el nonce no lo tienen: caen al
 * nombre viejo, que es exactamente el que ya ocupan en el bucket.
 */
export function hearingAudioPartPath(meetingId: string, partIndex: number, extension: string, nonce = ""): string {
  const suffix = /^[a-z0-9]{1,16}$/.test(nonce) ? `-${nonce}` : "";
  return `${meetingId}/part-${String(partIndex).padStart(4, "0")}${suffix}.${extension}`;
}

/**
 * URL firmada para que el navegador suba UN tramo directo al bucket, sin pasar
 * por una funcion (el body de una funcion en Vercel se corta en ~4,5 MB).
 */
export async function createHearingAudioUploadUrl(input: {
  meetingId: string;
  partIndex: number;
  extension: string;
  nonce?: string;
}): Promise<{ storagePath: string; signedUrl: string }> {
  await ensureAudioBucket();
  const supabase = client();
  const storagePath = hearingAudioPartPath(input.meetingId, input.partIndex, input.extension, input.nonce);

  // upsert: con el nonce en la ruta, firmar dos veces la MISMA ruta solo pasa
  // cuando es el MISMO tramo reintentando (su confirmacion se perdio en la red
  // y el navegador vuelve a intentar). Ahi pisar el archivo con bytes
  // identicos es lo correcto; sin upsert eso daba "The resource already
  // exists" para siempre y trababa la cola (paso en la IX Audiencia,
  // 2026-08-12). Dos tramos distintos ya no comparten ruta, asi que el upsert
  // no puede destruir audio ajeno.
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUploadUrl(storagePath, { upsert: true });
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar la subida del audio");

  return { storagePath, signedUrl: data.signedUrl };
}

/** Baja un tramo para mandarlo a transcribir. */
export async function downloadHearingAudioPart(storagePath: string): Promise<Uint8Array> {
  const supabase = client();
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el tramo de audio");
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * URL firmada para escuchar/descargar un objeto de audio. Vence: el bucket es
 * privado a proposito y un link que no caduca es un bucket publico con pasos
 * extra. Con `downloadName`, el link fuerza descarga con ese nombre de archivo
 * (content-disposition) en vez de reproducirse en la pestana.
 */
export async function createHearingAudioDownloadUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60,
  downloadName?: string
): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds, downloadName ? { download: downloadName } : undefined);
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar la descarga del audio");
  return data.signedUrl;
}

/* ------------------- Audio unido de la audiencia (derivado) ----------------- */
/*
 * Ademas de los tramos, el bucket guarda UN archivo derivado por audiencia: la
 * grabacion completa unida en MP3, que es lo que el equipo descarga para
 * archivar o mandar. Se genera una sola vez (la primera descarga) y se
 * invalida si aparece un tramo nuevo (audiencia retomada). No se registra en
 * MeetingMedia a proposito: las filas de esa tabla son la cola de trabajo de
 * la transcripcion, y esto es un derivado, no una fuente.
 */

/** Ruta del MP3 unido de una audiencia. */
export function hearingAudioFullPath(meetingId: string): string {
  return `${meetingId}/completo.mp3`;
}

/** True si el MP3 unido ya esta generado. */
export async function hearingAudioFullExists(meetingId: string): Promise<boolean> {
  const supabase = client();
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).list(meetingId, { search: "completo.mp3" });
  if (error) return false;
  return (data ?? []).some((object) => object.name === "completo.mp3");
}

/** Sube (o reemplaza) el MP3 unido. */
export async function uploadHearingAudioFull(meetingId: string, bytes: Uint8Array): Promise<string> {
  await ensureAudioBucket();
  const supabase = client();
  const storagePath = hearingAudioFullPath(meetingId);
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(storagePath, bytes, { contentType: "audio/mpeg", upsert: true });
  if (error) throw new Error(error.message);
  return storagePath;
}

/** Borra tramos puntuales del bucket. No falla si ya no estan. */
export async function removeHearingAudioParts(storagePaths: string[]): Promise<void> {
  if (!storagePaths.length) return;
  const supabase = client();
  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(storagePaths);
  if (error) throw new Error(error.message);
}

/**
 * Borra TODO el audio de una audiencia (al eliminarla). Lista la carpeta en vez
 * de confiar en las filas de MeetingMedia: si una subida quedo huerfana porque
 * el registro nunca se creo, igual se limpia.
 */
export async function removeHearingAudioFolder(meetingId: string): Promise<void> {
  const supabase = client();
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).list(meetingId);
  if (error || !data?.length) return;
  await supabase.storage.from(AUDIO_BUCKET).remove(data.map((file) => `${meetingId}/${file.name}`));
}

/* ----------------- Bucket temporal de adjuntos de los chats ---------------- */
/*
 * Los adjuntos de Migue y de la Consulta al CPU NO se persisten: el bucket es
 * solo un puente para esquivar el tope de ~4,5 MB del body en Vercel. PRIVADO
 * (nada de URLs públicas: son documentos de vecinos), y el objeto se borra
 * apenas se extrae el texto. El prefijo por fecha permite barrer huérfanos a
 * mano si alguna extracción nunca se confirmó.
 */

const CHAT_BUCKET = process.env.SUPABASE_CHAT_BUCKET ?? "adjuntos-chat";

let chatBucketReady: Promise<void> | null = null;

/** Crea el bucket privado si no existe (idempotente, una vez por instancia). */
function ensureChatBucket(): Promise<void> {
  chatBucketReady ??= (async () => {
    const supabase = client();
    const { error } = await supabase.storage.createBucket(CHAT_BUCKET, { public: false, fileSizeLimit: "15MB" });
    if (error && !/already exists/i.test(error.message)) {
      chatBucketReady = null;
      throw new Error(error.message);
    }
  })();
  return chatBucketReady;
}

/** URL firmada para subir un adjunto de chat directo al bucket temporal. */
export async function createChatAttachmentUploadUrl(fileName: string): Promise<{ storagePath: string; signedUrl: string }> {
  await ensureChatBucket();
  const supabase = client();
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFileName(fileName)}`;

  const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar la subida");

  return { storagePath, signedUrl: data.signedUrl };
}

/** Baja el adjunto temporal para extraerle el texto. */
export async function downloadChatAttachment(storagePath: string): Promise<Uint8Array> {
  const supabase = client();
  const { data, error } = await supabase.storage.from(CHAT_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el adjunto");
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Borra el adjunto temporal. Best-effort: no lanza.
 * Ojo al debuggear: el CDN de Supabase puede seguir sirviendo el objeto
 * borrado unos minutos (verificado 2026-07-31: list() vacío pero download
 * responde). Es caché, no un borrado fallido; y al ser bucket privado, solo
 * responde con credenciales.
 */
export async function removeChatAttachment(storagePath: string): Promise<void> {
  try {
    const supabase = client();
    await supabase.storage.from(CHAT_BUCKET).remove([storagePath]);
  } catch {
    // Queda huérfano bajo el prefijo de fecha; se barre a mano.
  }
}
