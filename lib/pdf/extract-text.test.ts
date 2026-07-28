/**
 * Tests de la limpieza de texto extraido de PDFs.
 *
 * Correr: npx tsx --test lib/pdf/extract-text.test.ts
 * Usa node:test, que viene con Node (no suma dependencias).
 *
 * Los dos casos principales son texto REAL medido de los PDFs de la 1ª
 * Audiencia Publica, no ejemplos inventados.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { collapseSpacedLetters, pagesInText, sanitizePdfText } from "./extract-text";

test("caso real 1: no toca lo que no puede arreglar sin adivinar", () => {
  // PDF1 pag. 10, tabla. La frase real es "POZO EN LA MATERNIDAD S.M. DE TUCUMAN".
  const entrada = "PO ZOENLAM ATERN ID AD S.M . D ETU CU M A N";

  // Las corridas de letras sueltas aca son de 3 como maximo ("M A N"), debajo
  // del umbral. Se deja intacto A PROPOSITO: reconstruir "POZO EN LA
  // MATERNIDAD" desde "PO ZOENLAM ATERN ID AD" seria inventar. El modelo lee
  // mejor texto feo que texto falso.
  assert.equal(collapseSpacedLetters(entrada), entrada);
});

test("caso real 2: junta las corridas largas y deja el resto quieto", () => {
  // PDF3 pag. 10. La frase real es
  // "CLOACAL HASTA TANTO LA MUNICIPALIDAD NO SOLUCIONE".
  const entrada = "C LOAC A L H A STA TA N TO L A M U N I C I PA L I DA D N O SOLUCIONE";

  // "A L H A" (4) y "L A M U N I C I" (8) superan el umbral y se juntan.
  // "L I" (2) y "D N O" (3) no. El resultado NO es la frase original: es menos
  // ruido para el modelo, que es todo lo que esta heuristica promete.
  assert.equal(
    collapseSpacedLetters(entrada),
    "C LOAC ALHA STA TA N TO LAMUNICI PA L I DA D N O SOLUCIONE"
  );
});

test("no rompe prosa normal con letras sueltas", () => {
  // Casos donde una regla agresiva haria destrozos.
  assert.equal(collapseSpacedLetters("el plan A y el plan B"), "el plan A y el plan B");
  assert.equal(collapseSpacedLetters("la zona R2 y la zona C1"), "la zona R2 y la zona C1");
  assert.equal(collapseSpacedLetters("art 5 inc b"), "art 5 inc b");
});

test("falso positivo conocido: cuatro palabras de una letra se juntan", () => {
  // Documentado a proposito. Con 4 tokens de un caracter no hay senal para
  // distinguir una tabla rota de texto legitimo, y en estos PDFs la tabla rota
  // es muchisimo mas frecuente. Si aparece un caso real que esto arruine, el
  // numero a subir es MIN_RUN.
  assert.equal(collapseSpacedLetters("a b c d"), "abcd");
});

test("no cruza saltos de linea", () => {
  // Una corrida no puede formarse con tokens de dos lineas distintas: son
  // celdas o parrafos diferentes.
  assert.equal(collapseSpacedLetters("A B\nC D"), "A B\nC D");
  assert.equal(collapseSpacedLetters("A B C D\nE F G H"), "ABCD\nEFGH");
});

test("conserva los marcadores de pagina", () => {
  // Los [Página N] son la trazabilidad: si se rompen, se pierde de donde salio
  // cada propuesta.
  const entrada = "[Página 7] L A M U N I C I PA L I DA D";
  const salida = collapseSpacedLetters(entrada);
  assert.ok(salida.startsWith("[Página 7]"), `perdio el marcador: ${salida}`);
  assert.deepEqual(pagesInText(salida), [7]);
});

test("pagesInText lee todas las paginas presentes, ordenadas y sin repetir", () => {
  assert.deepEqual(pagesInText("[Página 3] hola\n\n[Página 1] chau\n\n[Página 3] otra"), [1, 3]);
  assert.deepEqual(pagesInText("sin marcadores"), []);
});

test("sanitizePdfText saca caracteres de control pero respeta saltos y tabs", () => {
  // Los de control se construyen con fromCharCode para no meter bytes crudos
  // en el fuente (ya paso una vez en este repo: un NUL literal en un .tsx).
  const NUL = String.fromCharCode(0);
  const BEL = String.fromCharCode(7);
  assert.equal(sanitizePdfText(`hola${NUL}mundo`), "holamundo");
  assert.equal(sanitizePdfText(`campo${BEL}`), "campo");
  assert.equal(sanitizePdfText("  linea1\nlinea2\tcol  "), "linea1\nlinea2\tcol");
});
