/**
 * Cola de subida con reintentos, SIN React ni DOM, para poder testearla: es la
 * pieza de la que depende no perder el audio de una audiencia, y en el preview
 * no hay microfono para probarla de punta a punta. Mismo criterio que
 * processRecognitionResults en su momento.
 *
 * Reglas que implementa:
 * - De a un item por vez (durante la audiencia la conexion es compartida).
 * - Un item que falla se reintenta con espera creciente; agotados los intentos
 *   NO se descarta, queda en la cola esperando que alguien llame a retryStuck()
 *   (el barrido periodico, o el cierre de la audiencia).
 * - El orden se respeta: la cola no saltea un item trabado para seguir con el
 *   siguiente, porque los tramos se numeran y conviene subirlos en orden.
 */

export type UploadQueueState = {
  /** Items confirmados por el servidor. */
  uploaded: number;
  /** Items todavia en la cola (subiendo o esperando reintento). */
  pending: number;
  /** Hay al menos un item que agoto sus reintentos. */
  stuck: boolean;
  /** Ultimo error, vacio si el ultimo intento salio bien. */
  error: string;
};

export type UploadQueueOptions<T> = {
  upload: (item: T) => Promise<void>;
  onChange: (state: UploadQueueState) => void;
  maxAttempts?: number;
  /** Espera antes de cada reintento. El ultimo valor se repite si faltan. */
  backoffMs?: number[];
  /** Inyectable para que los tests no esperen de verdad. */
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BACKOFF_MS = [2_000, 6_000, 15_000];
/** Cada cuanto se revisa si drain() ya termino, dentro de flush(). */
const FLUSH_POLL_MS = 150;

export class UploadQueue<T> {
  private items: Array<{ item: T; attempts: number }> = [];
  private working = false;
  private uploadedCount = 0;
  private lastError = "";

  constructor(private readonly options: UploadQueueOptions<T>) {}

  private get maxAttempts(): number {
    return this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  private get backoff(): number[] {
    return this.options.backoffMs ?? DEFAULT_BACKOFF_MS;
  }

  private sleep(ms: number): Promise<void> {
    return this.options.sleep ? this.options.sleep(ms) : new Promise((resolve) => setTimeout(resolve, ms));
  }

  state(): UploadQueueState {
    return {
      uploaded: this.uploadedCount,
      pending: this.items.length,
      stuck: this.items.some((entry) => entry.attempts >= this.maxAttempts),
      error: this.lastError
    };
  }

  private emit(): void {
    this.options.onChange(this.state());
  }

  /** Suma un item y arranca la subida si no habia nada corriendo. */
  enqueue(item: T): void {
    this.items.push({ item, attempts: 0 });
    this.emit();
    void this.drain();
  }

  /** Devuelve los intentos a cero en lo que quedo trabado, para volver a probar. */
  retryStuck(): void {
    for (const entry of this.items) {
      if (entry.attempts >= this.maxAttempts) entry.attempts = 0;
    }
  }

  /**
   * Vacia la cola de a uno. Reentrante: si ya hay un drain corriendo, vuelve en
   * el acto y deja que el que esta en curso levante los items nuevos.
   */
  async drain(): Promise<void> {
    if (this.working) return;
    this.working = true;
    try {
      while (this.items.length) {
        const entry = this.items[0];
        // Agotado: se corta el ciclo en vez de girar sobre el mismo item.
        if (entry.attempts >= this.maxAttempts) break;

        try {
          await this.options.upload(entry.item);
          this.items.shift();
          this.uploadedCount += 1;
          this.lastError = "";
          this.emit();
        } catch (error) {
          entry.attempts += 1;
          this.lastError = error instanceof Error ? error.message : "No se pudo subir.";
          this.emit();
          if (entry.attempts >= this.maxAttempts) break;
          await this.sleep(this.backoff[entry.attempts - 1] ?? this.backoff[this.backoff.length - 1] ?? 0);
        }
      }
    } finally {
      this.working = false;
    }
  }

  /**
   * Espera a que no quede nada en vuelo. Devuelve false si algun item no pudo
   * subirse. Lo usa el cierre de la audiencia: finalizar con la cola a medias
   * seria cerrar con el audio incompleto.
   *
   * No hace `await this.drain()` a secas: drain() es reentrante y volveria en
   * el acto si ya venia trabajando, dando por terminado algo que sigue en curso.
   */
  async flush(): Promise<boolean> {
    this.retryStuck();
    void this.drain();
    while (this.working) {
      await this.sleep(FLUSH_POLL_MS);
    }
    this.emit();
    return this.items.length === 0;
  }
}
