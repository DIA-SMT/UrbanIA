/**
 * Saca el ID de un link de YouTube y devuelve una URL canonica, o null.
 *
 * La URL entra desde el cliente y termina como argumento de yt-dlp, asi que el
 * string original no se usa nunca: se extrae el ID, se valida contra el formato
 * de 11 caracteres de YouTube y se reconstruye la URL desde cero. Aunque spawn
 * corre sin shell, reconstruirla evita que un link raro llegue al binario.
 *
 * Sin "server-only" a proposito: es una funcion pura, la usa tambien el cliente
 * para avisar antes de mandar, y asi se puede testear fuera de Next.
 */
export function canonicalYoutubeUrl(raw: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  const host = parsed.hostname.replace(/^www\.|^m\./, "");

  if (host !== "youtube.com" && host !== "youtu.be") {
    return null;
  }

  const id = host === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");

  // El formato de 11 caracteres de YouTube. Excluye cualquier cosa que empiece con
  // guion y pudiera leerse como una opcion del binario.
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || id.startsWith("-")) {
    return null;
  }

  return `https://www.youtube.com/watch?v=${id}`;
}
