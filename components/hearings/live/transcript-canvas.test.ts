import { deepStrictEqual } from "node:assert";
import { test } from "node:test";
import { dubiousRanges } from "./transcript-canvas";

// Correr con: npx tsx --test components/hearings/live/transcript-canvas.test.ts

test("una frase, una aparicion", () => {
  deepStrictEqual(dubiousRanges("hola mundo cruel", ["mundo"]), [[5, 10]]);
});

test("frase repetida: marca todas las apariciones", () => {
  deepStrictEqual(dubiousRanges("si si no si", ["si"]), [[0, 2], [3, 5], [9, 11]]);
});

test("frases solapadas se fusionan en un solo rango", () => {
  // "altura maxima" y "maxima permitida" se pisan en "maxima".
  deepStrictEqual(dubiousRanges("la altura maxima permitida", ["altura maxima", "maxima permitida"]), [[3, 26]]);
});

test("frase corregida (ya no aparece): sin rangos", () => {
  deepStrictEqual(dubiousRanges("el texto ya fue corregido", ["frase vieja"]), []);
});

test("frase vacia no rompe ni loopea", () => {
  deepStrictEqual(dubiousRanges("algo de texto", [""]), []);
});

test("frase con caracteres especiales de regex se busca literal", () => {
  deepStrictEqual(dubiousRanges("valor (aprox.) de 3.5", ["(aprox.)"]), [[6, 14]]);
});

test("rangos ordenados aunque las frases lleguen desordenadas", () => {
  deepStrictEqual(dubiousRanges("uno dos tres", ["tres", "uno"]), [[0, 3], [8, 12]]);
});
