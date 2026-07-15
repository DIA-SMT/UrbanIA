"use client";

import { useRef, useState, type ChangeEvent } from "react";

/**
 * Manejo de adjuntos para los chats (Migue y Consulta al CPU): selección,
 * validación de peso en el cliente, subida a /api/attachments/extract y estado
 * del texto extraído. El archivo no se persiste: solo viaja su texto.
 */

export type ChatAttachment = {
  name: string;
  sizeBytes: number;
  chars: number;
  truncated: boolean;
  notes: string[];
  text: string;
};

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // Debe coincidir con el endpoint.
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
        `"${file.name}" pesa ${formatFileSize(file.size)} y el límite es 5 MB. Probá subir solo las páginas que necesitás: abrí el PDF, elegí Imprimir → "Guardar como PDF" y seleccioná el rango de páginas.`
      );
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/attachments/extract", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "No se pudo leer el archivo.");
      }
      setAttachment(payload as ChatAttachment);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo leer el archivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return { attachment, uploading, error, inputRef, openPicker, clear, onFileSelected };
}
