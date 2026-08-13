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
 * - El orden se respeta MIENTRAS se pueda: los items sanos suben en el orden en
 *   que entraron, pero un item que agoto sus reintentos se aparta y los demas
 *   siguen. Antes el trabado frenaba a toda la cola (decision original, "los
 *   tramos conviene subirlos en orden"), y en la IX Audiencia (2026-08-12) eso
 *   dejo ~15 minutos de audio retenidos en memoria detras de un tramo que no
 *   iba a subir nunca. Los tramos se numeran: el orden de subida es cosmetico,
 *   no perder audio no.
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
  /**
   * Hay un flush() esperando. Mientras dure, retryStuck() no hace nada: si el
   * barrido periodico revive items agotados mas rapido de lo que drain() los
   * vuelve a agotar, drain() no termina nunca y el cierre de la audiencia
   * queda colgado en "Cerrando..." sin mensaje ni salida.
   */
  private flushing = false;

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

  /**
   * Devuelve los intentos a cero en lo que quedo trabado, para volver a probar.
   * Durante un flush NO hace nada: revivir items mientras el cierre espera es
   * lo que puede dejar a drain() sin condicion de salida.
   */
  retryStuck(): void {
    if (this.flushing) return;
    for (const entry of this.items) {
      if (entry.attempts >= this.maxAttempts) entry.attempts = 0;
    }
  }

  /**
   * Vacia la cola de a uno. Reentrante: si ya hay un drain corriendo, vuelve en
   * el acto y deja que el que esta en curso levante los items nuevos.
   *
   * Los items agotados se SALTEAN, no cortan el ciclo: quedan en la cola
   * (marcados stuck) esperando el proximo retryStuck(), y los que vienen detras
   * suben igual.
   */
  async drain(): Promise<void> {
    if (this.working) return;
    this.working = true;
    try {
      while (true) {
        // El primer item con intentos disponibles: el orden de llegada se
        // respeta entre los sanos, los agotados se dejan atras.
        const entry = this.items.find((candidate) => candidate.attempts < this.maxAttempts);
        if (!entry) break;

        try {
          await this.options.upload(entry.item);
          this.items.splice(this.items.indexOf(entry), 1);
          this.uploadedCount += 1;
          // El error se limpia solo si no queda nadie trabado: mientras haya un
          // item agotado, su mensaje es el diagnostico que el operador necesita.
          if (!this.items.some((candidate) => candidate.attempts >= this.maxAttempts)) {
            this.lastError = "";
          }
          this.emit();
        } catch (error) {
          entry.attempts += 1;
          this.lastError = error instanceof Error ? error.message : "No se pudo subir.";
          this.emit();
          if (entry.attempts < this.maxAttempts) {
            await this.sleep(this.backoff[entry.attempts - 1] ?? this.backoff[this.backoff.length - 1] ?? 0);
          }
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
    // El orden importa: primero se destraba lo agotado, y recien despues se
    // cierra la puerta a que el barrido vuelva a destrabar durante la espera.
    this.retryStuck();
    this.flushing = true;
    try {
      void this.drain();
      while (this.working) {
        await this.sleep(FLUSH_POLL_MS);
      }
    } finally {
      this.flushing = false;
    }
    this.emit();
    return this.items.length === 0;
  }
}
