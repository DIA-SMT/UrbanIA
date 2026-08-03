"use client";

import type { RecordedPart } from "@/components/hearings/live/use-recorder";

/**
 * Guarda en el disco del navegador (IndexedDB) los tramos grabados que todavia
 * no confirmo el servidor, y los borra apenas se confirman.
 *
 * Para que: hasta ahora un tramo grabado vivia solo en la MEMORIA de la pestana
 * mientras esperaba subir. Si se cortaba internet y despues se cerraba Chrome o
 * se reiniciaba la maquina, ese audio se perdia aunque se hubiera grabado bien.
 * Con esto sobrevive al cierre y se ofrece subirlo al volver a entrar.
 *
 * NO cubre el tramo que se esta grabando en ese momento (hasta 5 minutos): eso
 * requiere partir y recomponer un webm por la mitad, y quedo afuera a proposito.
 *
 * Si IndexedDB no esta disponible (modo incognito con storage bloqueado, cuota
 * llena), todo degrada a lo de antes: se graba y se sube igual, solo que sin la
 * red de contencion. Nunca tira.
 */

const DB_NAME = "urbania-audiencias";
const DB_VERSION = 1;
const STORE = "tramos-pendientes";

type StoredPart = {
  key: string;
  meetingId: string;
  index: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  offsetMs: number;
  durationMs: number;
  savedAt: number;
};

const partKey = (meetingId: string, index: number) => `${meetingId}|${index}`;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" }).createIndex("meetingId", "meetingId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/** Envuelve una operacion sobre el store. Devuelve `fallback` si algo falla. */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest, fallback: T): Promise<T> {
  const db = await openDb();
  if (!db) return fallback;
  return new Promise<T>((resolve) => {
    try {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(fallback);
    } catch {
      resolve(fallback);
    } finally {
      // La conexion se cierra sola al terminar la transaccion.
    }
  });
}

/** Guarda un tramo recien grabado, antes de intentar subirlo. */
export async function savePendingPart(meetingId: string, part: RecordedPart): Promise<void> {
  const stored: StoredPart = {
    key: partKey(meetingId, part.index),
    meetingId,
    index: part.index,
    blob: part.blob,
    mimeType: part.mimeType,
    extension: part.extension,
    offsetMs: part.offsetMs,
    durationMs: part.durationMs,
    savedAt: Date.now()
  };
  await withStore("readwrite", (store) => store.put(stored), undefined);
}

/** Lo borra: el servidor ya lo confirmo y ocupa lugar al pedo. */
export async function forgetPendingPart(meetingId: string, index: number): Promise<void> {
  await withStore("readwrite", (store) => store.delete(partKey(meetingId, index)), undefined);
}

/** Tramos de ESTA audiencia que quedaron sin confirmar, en orden. */
export async function listPendingParts(meetingId: string): Promise<RecordedPart[]> {
  const all = await withStore<StoredPart[]>("readonly", (store) => store.getAll(), []);
  return (all ?? [])
    .filter((item) => item.meetingId === meetingId)
    .sort((a, b) => a.index - b.index)
    .map((item) => ({
      index: item.index,
      blob: item.blob,
      mimeType: item.mimeType,
      extension: item.extension,
      offsetMs: item.offsetMs,
      durationMs: item.durationMs
    }));
}

/** Limpia todo lo de una audiencia (al cerrarla). */
export async function clearPendingParts(meetingId: string): Promise<void> {
  const pending = await listPendingParts(meetingId);
  for (const part of pending) {
    await forgetPendingPart(meetingId, part.index);
  }
}
