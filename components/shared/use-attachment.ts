"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { uploadToBucket } from "@/components/shared/upload-to-bucket";

/**
 * Manejo de adjuntos para los chats (Migue y Consulta al CPU): selección,
 * validación de peso en el cliente, subida directa al bucket temporal (firmar →
 * PUT → extraer por referencia; hasta 15 MB, esquivando el tope de ~4,5 MB del
 * body en Vercel) y estado del texto extraído. Si la subida directa no está
 * disponible, cae al multipart legacy (hasta 4 MB). El archivo no se persiste:
 * el objeto del bucket se borra apenas se extrae el texto.
 */

export type ChatAttachment = {
  name: string;
  sizeBytes: number;
  chars: number;
  truncated: boolean;
  notes: string[];
  text: string;
};

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // Debe coincidir con MAX_UPLOAD_BYTES del endpoint.
const MAX_MULTIPART_BYTES = 4 * 1024 * 1024; // Techo del fallback legacy (body de función en Vercel).
export const ATTACHMENT_ACCEPT = ".pdf,.txt";

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function useAttachment() {
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    setError(null);
    inputRef.current?.click();
  }

  function clear() {
    setAttachment(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);

    // Chequeo de peso en el cliente: evita subir 50 MB para recibir un 413.
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(
        `"${file.name}" pesa ${formatFileSize(file.size)} y el límite es 15 MB. Probá subir solo las páginas que necesitás: abrí el PDF, elegí Imprimir → "Guardar como PDF" y seleccioná el rango de páginas.`
      );
      event.target.value = "";
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const payload = await extractViaDirectUpload(file, setProgress);
      setAttachment(payload);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo leer el archivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return { attachment, uploading, progress, error, inputRef, openPicker, clear, onFileSelected };
}

/** Firmar → PUT directo al bucket → extraer por referencia. */
async function extractViaDirectUpload(file: File, onProgress: (percent: number) => void): Promise<ChatAttachment> {
  const signResponse = await fetch("/api/attachments/extract?action=sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, sizeBytes: file.size })
  });
  const signed = await signResponse.json().catch(() => null);

  if (signResponse.status === 503 && file.size <= MAX_MULTIPART_BYTES) {
    // Sin storage configurado (p. ej. un entorno local pelado): el archivo es
    // chico, puede viajar por el camino multipart de siempre.
    return extractViaMultipart(file);
  }
  if (!signResponse.ok || !signed?.signedUrl) {
    throw new Error(signed?.detail || signed?.error || "No se pudo preparar la subida.");
  }

  await uploadToBucket(signed.signedUrl, file, onProgress);

  const response = await fetch("/api/attachments/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath: signed.storagePath, fileName: file.name })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || "No se pudo leer el archivo.");
  }
  return payload as ChatAttachment;
}

async function extractViaMultipart(file: File): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/attachments/extract", { method: "POST", body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || "No se pudo leer el archivo.");
  }
  return payload as ChatAttachment;
}
