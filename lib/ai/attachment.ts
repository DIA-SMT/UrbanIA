import { z } from "zod";

/**
 * Adjuntos en los chats (Migue y Consulta al CPU): el cliente sube el archivo a
 * /api/attachments/extract, recibe el texto extraído y lo reenvía junto con su
 * pregunta. Acá viven el schema compartido y el bloque de prompt.
 */

// El tope debe coincidir con MAX_TEXT_CHARS del endpoint de extracción, con un
// margen chico por si el cliente agrega notas.
export const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(13_000),
  truncated: z.boolean().optional()
});

export type QueryAttachment = z.infer<typeof attachmentSchema>;

/** Bloque de prompt con el documento adjuntado por el usuario y sus reglas de uso. */
export function buildAttachmentBlock(attachment: QueryAttachment): string {
  return [
    `DOCUMENTO ADJUNTADO POR EL USUARIO: "${attachment.name}"${attachment.truncated ? " (recortado por longitud; puede faltar el final)" : ""}`,
    "Contenido del documento:",
    "-----",
    attachment.text,
    "-----",
    "Reglas sobre el documento adjunto:",
    "- Si la consulta es sobre este documento, respondé basándote en su contenido y citá las partes textuales en las que te apoyás.",
    "- Distinguí siempre qué surge del documento y qué surge de la normativa u otras fuentes.",
    "- Si el documento no contiene lo que el usuario pregunta, decilo claramente. No completes con suposiciones.",
    "- Si el documento está recortado, aclaralo cuando pueda afectar la respuesta."
  ].join("\n");
}
