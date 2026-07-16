import "server-only";

/**
 * Rate limiting en memoria por IP para los endpoints públicos de IA, que gastan
 * créditos de OpenRouter en cada request. Ventana fija: N requests por ventana
 * por clave; al expirar la ventana el contador arranca de nuevo.
 *
 * Límite honesto para el MVP: vive en la memoria del proceso, así que se
 * reinicia con cada deploy y no se comparte entre instancias. Para producción
 * multi-instancia habría que moverlo a Redis/Upstash.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Limpieza perezosa: cada tantas verificaciones se barren las ventanas vencidas
// para que el Map no crezca sin límite con IPs que no vuelven.
const CLEANUP_EVERY = 500;
let checksSinceCleanup = 0;

export type RateLimitResult = {
  allowed: boolean;
  /** Segundos hasta que la ventana se reinicia (para el header Retry-After). */
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string, options: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();

  checksSinceCleanup += 1;
  if (checksSinceCleanup >= CLEANUP_EVERY) {
    checksSinceCleanup = 0;
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Identifica al cliente detrás del proxy (Vercel/nginx ponen la IP real en
 * x-forwarded-for). Sin header cae a "unknown": mejor agrupar a los anónimos
 * en un solo bucket que dejar el endpoint sin límite.
 */
export function clientKeyFromRequest(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
