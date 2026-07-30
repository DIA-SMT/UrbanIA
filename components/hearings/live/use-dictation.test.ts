import assert from "node:assert/strict";
import { test } from "node:test";
import { processRecognitionResults } from "./use-dictation";

/**
 * Escenarios reales de la Web Speech API que costaron palabras perdidas en
 * audiencias. Cada resultado simula la forma minima {isFinal, 0: {transcript}}.
 */

type Result = { isFinal: boolean; 0: { transcript: string; confidence?: number } };

const interimResult = (transcript: string): Result => ({ isFinal: false, 0: { transcript } });
const finalResult = (transcript: string, confidence?: number): Result => ({ isFinal: true, 0: { transcript, confidence } });

test("flujo simple: el interino crece y despues finaliza una sola vez", () => {
  const emitted = new Set<number>();

  let paso = processRecognitionResults([interimResult("hola")], emitted);
  assert.deepEqual(paso.finals, []);
  assert.equal(paso.interim, "hola");

  paso = processRecognitionResults([interimResult("hola como estás")], emitted);
  assert.equal(paso.interim, "hola como estás");

  paso = processRecognitionResults([finalResult("hola, ¿cómo estás?", 0.93)], emitted);
  assert.deepEqual(paso.finals, [{ text: "hola, ¿cómo estás?", confidence: 0.93 }]);
  assert.equal(paso.interim, "");

  // El mismo final en un evento posterior NO se re-emite.
  paso = processRecognitionResults([finalResult("hola, ¿cómo estás?", 0.93), interimResult("sigo hablando")], emitted);
  assert.deepEqual(paso.finals, []);
  assert.equal(paso.interim, "sigo hablando");
});

test("VARIOS interinos pendientes a la vez: el rescate ve el texto completo", () => {
  // El caso que perdia palabras: dos resultados provisorios coexistiendo.
  // Antes se leia solo desde resultIndex y el rescate del corte veia uno solo.
  const emitted = new Set<number>();
  const paso = processRecognitionResults(
    [interimResult("aprobar el artículo "), interimResult("veintinueve del código")],
    emitted
  );
  assert.deepEqual(paso.finals, []);
  assert.equal(paso.interim, "aprobar el artículo veintinueve del código");
});

test("un interino viejo finaliza mientras hay otro pendiente", () => {
  const emitted = new Set<number>();
  processRecognitionResults([interimResult("la comisión "), interimResult("resuelve")], emitted);

  const paso = processRecognitionResults([finalResult("la comisión", 0.9), interimResult("resuelve aprobar")], emitted);
  assert.deepEqual(paso.finals, [{ text: "la comisión", confidence: 0.9 }]);
  assert.equal(paso.interim, "resuelve aprobar");
});

test("confianza 0 o ausente queda como desconocida (null), no como dudosa", () => {
  const emitted = new Set<number>();
  const paso = processRecognitionResults([finalResult("sin medir", 0), finalResult("tampoco medida")], emitted);
  assert.deepEqual(paso.finals, [
    { text: "sin medir", confidence: null },
    { text: "tampoco medida", confidence: null }
  ]);
});

test("finales vacios o de puro espacio no emiten nada (pero quedan marcados)", () => {
  const emitted = new Set<number>();
  const paso = processRecognitionResults([finalResult("   ")], emitted);
  assert.deepEqual(paso.finals, []);
  assert.equal(emitted.has(0), true);
});

test("una sesion larga acumula finales por indice sin repetir ninguno", () => {
  const emitted = new Set<number>();
  const historia: Result[] = [];
  const emitidos: string[] = [];
  for (let i = 1; i <= 30; i += 1) {
    historia.push(finalResult(`frase ${i}`, 0.85));
    const { finals } = processRecognitionResults(historia, emitted);
    emitidos.push(...finals.map((f) => f.text));
  }
  assert.equal(emitidos.length, 30);
  assert.equal(new Set(emitidos).size, 30);
  assert.equal(emitidos[0], "frase 1");
  assert.equal(emitidos[29], "frase 30");
});
