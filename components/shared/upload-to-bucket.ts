"use client";

/**
 * PUT del archivo directo al bucket con una signed URL, con progreso real.
 * fetch no reporta progreso de subida, por eso XMLHttpRequest. Compartido por
 * las subidas directas (importador de normas, documentos de audiencias).
 */
export function uploadToBucket(signedUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`La subida al almacenamiento falló (HTTP ${xhr.status}).`));
    xhr.onerror = () => reject(new Error("La subida al almacenamiento se cortó. Revisá tu conexión."));
    xhr.send(file);
  });
}
