import assert from "node:assert/strict";
import { test } from "node:test";
import { UploadQueue } from "./upload-queue";

/**
 * Escenarios reales de una audiencia: el wifi de la sala que se cae y vuelve,
 * el cierre con tramos todavia en la cola, y el tramo que no sube nunca. Lo que
 * se prueba es que NUNCA se descarte un tramo en silencio.
 */

/** sleep instantaneo: los tests no esperan los backoff de verdad. */
const noSleep = () => Promise.resolve();

/** Cola de prueba con un upload que falla las primeras `failures` veces por item. */
function makeQueue(behaviour: (item: string, attempt: number) => boolean) {
  const attempts = new Map<string, number>();
  const uploaded: string[] = [];
  const states: ReturnType<UploadQueue<string>["state"]>[] = [];

  const queue = new UploadQueue<string>({
    sleep: noSleep,
    backoffMs: [1, 1, 1],
    onChange: (state) => states.push(state),
    upload: async (item) => {
      const attempt = (attempts.get(item) ?? 0) + 1;
      attempts.set(item, attempt);
      if (!behaviour(item, attempt)) throw new Error(`fallo de red en ${item}`);
      uploaded.push(item);
    }
  });

  return { queue, uploaded, states, attempts };
}

test("camino feliz: los tramos suben en orden y la cola queda vacia", async () => {
  const { queue, uploaded } = makeQueue(() => true);

  queue.enqueue("part-0");
  queue.enqueue("part-1");
  queue.enqueue("part-2");

  assert.equal(await queue.flush(), true);
  assert.deepEqual(uploaded, ["part-0", "part-1", "part-2"]);
  assert.deepEqual(queue.state(), { uploaded: 3, pending: 0, stuck: false, error: "" });
});

test("se cae la red un rato: reintenta y termina subiendo el mismo tramo", async () => {
  // Falla los 2 primeros intentos de cada tramo, despues anda.
  const { queue, uploaded, attempts } = makeQueue((_item, attempt) => attempt > 2);

  queue.enqueue("part-0");
  assert.equal(await queue.flush(), true);

  assert.deepEqual(uploaded, ["part-0"]);
  assert.equal(attempts.get("part-0"), 3);
  assert.equal(queue.state().pending, 0);
});

test("un tramo que nunca sube NO se descarta ni traba a los que siguen para siempre", async () => {
  const { queue, uploaded } = makeQueue((item) => item !== "part-0");

  queue.enqueue("part-0");
  queue.enqueue("part-1");

  // flush devuelve false: quedo audio sin subir y el cierre tiene que enterarse.
  assert.equal(await queue.flush(), false);
  assert.deepEqual(uploaded, []);

  const state = queue.state();
  assert.equal(state.stuck, true);
  assert.equal(state.pending, 2, "los dos tramos siguen en la cola, ninguno se perdio");
  assert.match(state.error, /part-0/);
});

test("el orden se respeta: no se saltea un tramo trabado para subir el siguiente", async () => {
  const { queue, uploaded } = makeQueue((item) => item !== "part-0");

  queue.enqueue("part-0");
  queue.enqueue("part-1");
  await queue.flush();

  // part-1 podria haber subido solo, pero se numeran y van en orden.
  assert.deepEqual(uploaded, []);
});

test("vuelve la red: retryStuck destraba y sube todo lo que habia quedado", async () => {
  let red = false;
  const { queue, uploaded } = makeQueue(() => red);

  queue.enqueue("part-0");
  queue.enqueue("part-1");
  assert.equal(await queue.flush(), false);
  assert.equal(queue.state().stuck, true);

  red = true;
  assert.equal(await queue.flush(), true, "flush destraba lo agotado antes de reintentar");
  assert.deepEqual(uploaded, ["part-0", "part-1"]);
  assert.equal(queue.state().error, "", "el error viejo se limpia al salir bien");
});

/** Cola cuyas subidas quedan colgadas hasta que el test las suelta a mano. */
function makeManualQueue(uploaded: string[]) {
  // Lista y no variable suelta: TypeScript no ve las asignaciones hechas dentro
  // del executor de la promesa y estrecha el tipo a null.
  const waiting: Array<() => void> = [];
  const queue = new UploadQueue<string>({
    sleep: noSleep,
    onChange: () => {},
    upload: (item) =>
      new Promise<void>((resolve) => {
        waiting.push(() => {
          uploaded.push(item);
          resolve();
        });
      })
  });
  /** Suelta la subida que este en vuelo. */
  const release = () => waiting.shift()?.();
  return { queue, release };
}

test("flush espera al tramo que ya estaba subiendo (no da por cerrado algo en curso)", async () => {
  const uploaded: string[] = [];
  const { queue, release } = makeManualQueue(uploaded);

  // Arranca una subida que queda colgada a proposito.
  queue.enqueue("part-0");
  await Promise.resolve();

  let flushed: boolean | null = null;
  const flushing = queue.flush().then((result) => {
    flushed = result;
  });

  // Todavia no puede haber terminado: la subida sigue en vuelo.
  await Promise.resolve();
  assert.equal(flushed, null, "flush no puede resolver con una subida en curso");

  release();
  await flushing;

  assert.equal(flushed, true);
  assert.deepEqual(uploaded, ["part-0"]);
});

test("un tramo encolado mientras la cola trabaja igual se sube", async () => {
  const uploaded: string[] = [];
  const { queue, release } = makeManualQueue(uploaded);

  queue.enqueue("part-0");
  await Promise.resolve();
  // Llega el tramo siguiente con el anterior todavia en vuelo.
  queue.enqueue("part-1");
  release();

  const flushing = queue.flush();
  // El segundo tramo arranca recien cuando el primero termina: se suelta ahi.
  await Promise.resolve();
  release();

  assert.equal(await flushing, true);
  assert.deepEqual(uploaded, ["part-0", "part-1"]);
});
