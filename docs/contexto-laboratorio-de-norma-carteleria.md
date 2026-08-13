# Contexto para replicar la "Fábrica de Normas" de UrbanIA en CarteleríIA

> **Cómo usar este archivo:** adjuntalo como primer mensaje del chat nuevo, junto con la carpeta del proyecto CarteleríIA conectada. Está escrito para que un asistente que NO vio UrbanIA pueda construir el módulo sin adivinar.

---

## 0. El pedido, en una línea

El jefe dijo:

> *"Te voy a pasar una ordenanza ahí para que la procesemos y haya un segmento como **laboratorio de norma** y podamos preguntar cosas de esta propuesta."*

Traducido a requisitos:

1. **Subir** una ordenanza (PDF) desde la UI de CarteleríIA.
2. **Procesarla**: extraer el texto, entenderla, indexarla.
3. **Un segmento nuevo ("Laboratorio de Norma")** donde esa ordenanza vive como objeto de trabajo.
4. **Preguntarle cosas a ESA ordenanza** en un chat, con respuestas ancladas al texto real (citas verificables, no inventadas).

Es decir: **ingesta de documento + RAG acotado a ese documento + una pantalla que los une**.

Esto ya existe, funcionando en producción, en el proyecto **UrbanIA** (misma dirección, mismo stack). Este documento describe cómo está hecho allá para portarlo acá.

---

## 1. Qué es la Fábrica de Normas en UrbanIA (para entender de dónde sale esto)

UrbanIA es la plataforma GovTech de la Municipalidad de San Miguel de Tucumán para la reforma del Código de Planeamiento Urbano. La **Fábrica de Normas** es su módulo central:

- Un **"código nuevo"** (`NormativeReform`) agrupa las **normas** que se van redactando.
- Cada **norma** es un artículo en construcción (se modela como `Project` con `reformId`).
- Se le pueden **importar PDFs** aportados por colegios profesionales, ONGs, universidades: el importador lee el PDF, la IA propone qué normas contiene, una persona revisa y acepta.
- Cada norma pasa por **IA en dos pasos**: *Formalizar* (redactar el articulado) → *Diagnosticar* (compararlo contra el código viejo).
- Aparte, existe **Consulta al CPU** (`/consulta-cpu`): un chat RAG sobre toda la base normativa, con citas resaltables.

**Para CarteleríIA no hace falta todo eso.** El "Laboratorio de Norma" es la intersección de dos piezas: el **importador/ingesta de PDF** y el **chat RAG con citas**. El resto (formalizar, diagnosticar, dictámenes, export con membrete, demanda ciudadana) queda fuera del alcance salvo que Lucas diga lo contrario.

---

## 2. Stack de UrbanIA (verificar qué coincide con CarteleríIA antes de escribir código)

| Pieza | UrbanIA |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Estilos | Tailwind 3.4 |
| ORM / DB | Prisma 5.22 + Postgres (Supabase) con extensiones **pgvector** y **unaccent** |
| Archivos | Supabase Storage (bucket público, subida con signed URL directa del browser) |
| LLM | OpenRouter vía SDK `openai` (`openai/gpt-4o` para lectura de documentos, `gpt-4o-mini` para tareas livianas) |
| Embeddings | **locales y gratis**: `@huggingface/transformers` con `Xenova/multilingual-e5-small`, 384 dims |
| PDF | `pdfjs-dist` (build legacy `.mjs`) |
| Validación | `zod` en todos los bordes |
| Deploy | Vercel |

**Primera tarea del chat nuevo:** leer `package.json`, `prisma/schema.prisma` y la estructura de `app/` y `lib/` de CarteleríIA y reportar diferencias. Si el stack no coincide, hay que traducir el patrón, no copiar archivos.

---

## 3. La arquitectura a construir

```
[1] Subida            browser --signed URL--> Supabase Storage (bucket)
                                 |
[2] Extracción        pdfjs-dist -> texto con marcadores [Página N]
                                 |
                    +------------+------------+
                    |                         |
[3a] Análisis IA     LLM -> ficha estructurada  [3b] Indexado
     (qué es, qué      (JSON validado con zod)        chunking ~1000 chars
      propone)         + verificación de citas        + e5-small (384d)
                                 |                    + guardado en pgvector
                                 |                         |
[4] Pantalla "Laboratorio de Norma": ficha + visor + chat
                                 |
[5] Chat            pregunta -> retrieval híbrido (vector + full-text, RRF)
                    ACOTADO A ESE DOCUMENTO -> LLM -> respuesta + cita textual
                    -> la cita se localiza en el fragmento y se resalta en la UI
```

### La diferencia clave con UrbanIA

En UrbanIA el RAG es **global**: recupera de toda la base documental (`KnowledgeChunk` de todas las fuentes). En CarteleríIA el laboratorio es **por documento**: cada consulta debe filtrar por el `sourceId` de la ordenanza que se está mirando. Es un `WHERE k."sourceId" = $x` agregado a las dos queries de retrieval. **Sin ese filtro el laboratorio miente**: contesta con normativa de otro expediente.

Decidir también si se ofrece un modo "ampliar a toda la base" (útil para preguntar "¿esto contradice algo vigente?"). Recomendación: dejarlo para después, pero que el retrieval reciba el scope como parámetro desde el día uno.

---

## 4. Modelo de datos mínimo (Prisma)

Portar tal cual estos dos modelos — son el corazón del RAG y están probados:

```prisma
model KnowledgeSource {
  id          String              @id @default(cuid())
  kind        KnowledgeSourceKind
  externalId  String?             // clave estable, ej. "ordenanza:<docId>"
  title       String
  sourceUrl   String?
  mimeType    String?
  status      ProcessingStatus    @default(PENDING)
  rawText     String?
  summary     String?
  metadata    Json                @default("{}")
  wordCount   Int                 @default(0)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  processedAt DateTime?
  chunks      KnowledgeChunk[]

  @@unique([kind, externalId])
  @@index([kind])
  @@index([status])
}

model KnowledgeChunk {
  id            String                      @id @default(cuid())
  sourceId      String
  chunkIndex    Int
  content       String
  tokenEstimate Int                         @default(0)
  metadata      Json                        @default("{}")
  embedding     Unsupported("vector(384)")?
  createdAt     DateTime                    @default(now())
  source        KnowledgeSource             @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@unique([sourceId, chunkIndex])
  @@index([sourceId, chunkIndex])
}

enum KnowledgeSourceKind { REGULATION REPORT WEB_PAGE MEETING FILE MANUAL }
enum ProcessingStatus    { PENDING PROCESSING READY ERROR }
```

Más, propio de CarteleríIA, un modelo para el documento subido (equivalente a `ReformDocument`):

```prisma
model <Ordenanza|LabDocument> {
  id           String   @id @default(cuid())
  name         String
  type         String
  url          String?
  storagePath  String?     // ruta en el bucket: permite borrar el archivo real
  sizeBytes    Int?
  pageCount    Int?
  summary      String?     // qué es el documento, 2-4 oraciones (IA, editable)
  documentKind String?     // clasificación
  sha256       String?     // avisar "este PDF ya estaba subido"
  knowledgeSourceId String? // link al índice RAG
  uploadedBy   String?
  uploadedAt   DateTime @default(now())
}
```

Y para el chat, el par conversación/mensaje (en UrbanIA son `CpuConversation` / `CpuMessage`, con `citations` y `retrieved` como `Json`).

### Migraciones SQL que hay que escribir a mano

Prisma no maneja `vector`; estas van como SQL crudo:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
```

HNSW y no ivfflat: no requiere entrenamiento previo ni fijar `lists` según el número de filas, así que rinde bien con pocos documentos y escala sin re-tuning. Coseno porque los vectores de e5 vienen normalizados.

---

## 5. Los archivos de UrbanIA a portar (mapa de referencia)

Si el chat nuevo tiene acceso a la carpeta de UrbanIA (`C:\Users\lucas\Trabajo\Proyectos Dia\UrbanIA`), estos son los archivos a leer y adaptar, en orden de importancia:

**Núcleo, portar casi tal cual:**

| Archivo | Qué hace |
|---|---|
| `lib/ai/embeddings.ts` | e5-small local, prefijos `passage:`/`query:`, `toVectorLiteral` |
| `lib/ai/rag.ts` | Retrieval híbrido (vector + full-text) con RRF, armado del contexto, contrato de salida JSON con cita, `buildAnswerSource` |
| `lib/ai/openrouter.ts` | Cliente OpenRouter (30 líneas) |
| `lib/pdf/extract-text.ts` | Extracción con marcadores `[Página N]`, `sanitizePdfText`, `collapseSpacedLetters` |
| `lib/pdf/node-polyfills.ts` | Globals que pdfjs necesita fuera del browser |
| `lib/knowledge/ingest-hearing-report.ts` | **Chunking + embedding + upsert de la fuente.** Es el archivo a copiar para la ingesta |
| `lib/text/locate-quote.ts` / `lib/text/normalize-quote.ts` | Localizar una cita dentro de un fragmento (resaltado) y verificar que aparezca textual |

**Referencia de diseño, adaptar:**

| Archivo | Qué mirar |
|---|---|
| `lib/normas/analyze-document.ts` | El prompt de análisis y la validación zod tolerante. **El mejor archivo del módulo**: leerlo entero |
| `lib/cpu/api/query.ts` | El handler del chat: retrieval → prompt → extracción de citas → persistencia |
| `lib/normas/api/documents.ts` | Las 3 acciones del importador (`upload-url` / `analyze` / `confirm`) |
| `lib/storage/supabase.ts` | Signed URLs, descarga server-side, URLs públicas |
| `lib/ai/attachment.ts` | Bloque de prompt para un documento adjunto (alternativa liviana al RAG) |
| `lib/ai/migue-intent.ts` | Reescritor de intención: convierte una pregunta informal en query de búsqueda |
| `components/normas/importar/import-document.tsx` | UI del importador en 3 pasos con barra de progreso |
| `components/cpu/cpu-chat-workspace.tsx` | UI del chat con panel de fuentes y resaltado |
| `prisma/ingest-knowledge.ts` | Script de ingesta por CLI (útil para cargar la primera ordenanza a mano) |

---

## 6. El pipeline, paso a paso

### Paso 1 — Subida

Signed URL: el server firma, el archivo va **directo del browser al bucket**. No pasa por la función serverless (evita el límite de payload de Vercel y no consume tiempo de función).

Validaciones del server al firmar: solo `.pdf`, tope 30 MB, y el `storagePath` lo genera el server y arranca con el id del contenedor (`<contenedorId>/<archivo>`), para que nadie pueda leer el PDF de otro expediente pasando una ruta a mano.

### Paso 2 — Extracción de texto

```ts
const extracted = await extractPdfText(bytes, { maxPages: 120, maxChars: 40_000, collapseSpaced: true });
const documentText = sanitizePdfText(extracted.text);
```

- Cada página se prefija con `[Página N]`. **Esos marcadores son la base de la trazabilidad**: permiten decir de qué página salió cada afirmación.
- `collapseSpacedLetters` junta las corridas de letras sueltas que dejan las tablas mal extraídas (`"L A M U N I C I"` → `"LAMUNICI"`). Es deliberadamente conservador: solo colapsa 4+ tokens de un carácter, dentro de una misma línea. Preferimos texto feo a texto inventado.
- **Bug conocido y ya resuelto:** pdfjs *transfiere* el buffer que recibe y lo deja detachado. Hay que pasarle una copia (`new Uint8Array(buffer)`) o la segunda llamada revienta.
- Si el texto útil queda por debajo de ~200 caracteres, el PDF es un escaneo: eso **no es un error del sistema**, es un caso esperado. Se guarda el archivo igual como antecedente y se avisa. (Si hace falta, UrbanIA tiene `lib/pdf/ocr.ts`.)

### Paso 3a — Análisis IA (la ficha del documento)

Un solo llamado al LLM con `response_format: json_object`, `temperature: 0.1`, y un system prompt largo y muy explícito. El resultado se valida con zod y **no se persiste**: se le muestra a una persona para que revise y acepte.

Lo que hace bueno a este prompt (replicar el criterio, no el texto):

1. **"Devolver lista vacía es una respuesta VÁLIDA y FRECUENTE."** Se le dice explícitamente al modelo que la mayoría de los documentos no contienen lo que busca. Sin esta regla el modelo fabrica hallazgos para llenar el formulario.
2. **Un test operacional, no una definición.** Para distinguir una propuesta real de un enunciado de tema: *"si no podés escribir la regla en una oración del tipo 'se permite / se prohíbe / se exige / el máximo es', no es una propuesta"*. Con ejemplos de ambos lados, y el lado negativo más largo que el positivo, porque es lo que más se va a encontrar.
3. **`evidenceQuote` obligatoria y textual.** *"Copiada carácter por carácter. Si el texto dice 'PO ZOENLAM ATERN ID AD', la cita dice exactamente eso."*
4. **Verificación en código, no confianza en el prompt.** Después de validar el JSON, cada hallazgo cuya cita no aparezca textualmente en el texto extraído **se descarta** y se agrega un warning. Esto es lo que efectivamente impide que el modelo invente. La verificación compara contra el **mismo string saneado** que vio el modelo — si vieran textos distintos, toda cita válida se descartaría por una diferencia invisible.
5. **Tolerancia asimétrica en zod.** Los campos cosméticos (clasificación, áreas, confianza) se normalizan y caen a un default seguro si no matchean: una etiqueta rara no justifica tirar a la basura un análisis que costó plata y un minuto de espera, y además una persona los revisa en un desplegable. Los campos de evidencia (título, resumen, cita) **no se aflojan nunca**.
6. **`confidence` arranca en "baja" por default**, no en "media": ante la duda el hallazgo aparece descartado en la revisión y aceptarlo tiene que ser un acto deliberado.
7. **`warnings`** para lo que la persona debe saber: páginas ilegibles, tablas rotas, secciones que parecen tener contenido y salieron vacías (mapas, planos).

Para una ordenanza, la ficha probablemente deba ser distinta a la de UrbanIA. Sugerencia de campos a discutir con Lucas: tipo de norma, número y año, objeto, artículos detectados (número + sumilla + texto), normas que modifica o deroga, plazos y sanciones, obligaciones que crea, autoridad de aplicación.

### Paso 3b — Indexado para el chat (RAG)

Copiar el núcleo de `ingest-hearing-report.ts`:

- **Chunking**: ventanas de ~1000 caracteres con 150 de solape, respetando párrafos. Un párrafo enorme se parte duro. El solape evita cortar una idea justo en el borde.
- **Embedding**: `embedPassages(chunks)` — e5-small local, prefijo `passage:`. **Al texto de cada chunk se le antepone el título de la fuente** antes de embeber: le da contexto al modelo de embedding.
- **Guardado**: los vectores van por SQL crudo (`UPDATE ... SET embedding = v.emb::vector FROM (SELECT unnest($1::text[]) ...)`) porque Prisma no puede setear el tipo `vector`. En lotes de 32.
- **Upsert por `kind + externalId`** con reindexado limpio: si la fuente se re-ingesta, se borran sus chunks y se rehacen. Idempotente.
- El `status` de la fuente va `PROCESSING → READY`, y a `ERROR` en el catch. La UI necesita ese estado para no dejar preguntar sobre un documento a medio indexar.

**Para una ordenanza vale la pena considerar un chunking por artículo** en lugar de por ventana de caracteres: la unidad natural de cita es el artículo, y tener `metadata.articleNumber` en cada chunk hace que las citas salgan como "Artículo 12" en vez de "página 3". UrbanIA hace exactamente eso para el CPU (`lib/normative/parser.ts` parsea artículos con regex). Es más trabajo y más frágil; decidir con Lucas si la primera versión lo necesita.

### Paso 4 — La pantalla "Laboratorio de Norma"

Layout sugerido (a validar): ficha del documento arriba (qué es, número, resumen, estado de indexado), el visor del PDF o el texto extraído a la izquierda, el chat a la derecha. Cuando una respuesta cita algo, resaltar la cita en el panel de la izquierda.

### Paso 5 — El chat

Handler (basado en `lib/cpu/api/query.ts`):

1. Validar con zod (pregunta de 3 a 2000 chars, `conversationId` opcional).
2. Cargar historial: **las últimas 8 mensajes**, excluyendo los que fueron error.
3. *(Opcional pero recomendado)* **Reescritor de intención**: un llamado barato a `gpt-4o-mini` que convierte la pregunta informal ("¿y eso qué implica para los carteles chicos?") en una consulta de búsqueda con términos concretos. Sin esto, el retrieval falla con preguntas que dependen del contexto conversacional.
4. **Retrieval híbrido, filtrado por el `sourceId` de esta ordenanza:**
   - Rama vectorial: `embedQuery(pregunta)` → `ORDER BY k.embedding <=> $1::vector`.
   - Rama full-text: `to_tsvector('spanish', unaccent(content)) @@ to_tsquery(...)`. La query se arma con semántica **OR** (`plainto_tsquery` exige TODAS las palabras y falla con preguntas largas), sacando stop-words y agregando cada token con y sin tilde.
   - Fusión con **Reciprocal Rank Fusion** (`score = 1/(60 + rank)`), sumando los scores de ambas ramas.
   - **Ambas ramas van en `Promise.all` con `.catch` individual.** Si el embedding local no está disponible, la búsqueda de texto sigue sola. Degradar no es tumbar todo — sin ese catch, un fallo del vectorial tiraba el `Promise.all` entero y el asistente contestaba "no hay evidencia" aunque el texto tuviera la respuesta. **Fue un bug de producción real.**
   - Filtro de pertinencia: un chunk entra si su similitud coseno supera **0.8** *o* si además matcheó por full-text. (Las similitudes de e5-small quedan comprimidas: ~0.75 fuera de tema, ~0.86+ muy relevante. Ese umbral es específico de este modelo; si se cambia el modelo hay que recalibrarlo.)
5. **Prompt**: system con las reglas + historial + user con los fragmentos numerados y sus referencias.
6. **Contrato de salida.** El modelo devuelve JSON `{answer, cita}`. La `cita` es la frase textual copiada del fragmento en el que se apoyó. Después:
   - Se localiza la cita en los fragmentos y se parte el texto en `before / match / after` para resaltarla en la UI.
   - **Si la cita no se encuentra, no se resalta nada.** Fallback seguro.
   - **Si la cita viene vacía, no se muestra ninguna fuente.** Esto importa más de lo que parece: una fuente al lado de un "la ordenanza no regula eso" le hace creer al usuario que ese artículo responde su consulta.
   - La regla que se le da al modelo para decidir la cita: *"si borraras los fragmentos y tu respuesta seguiría siendo la misma, la cita va vacía; si perderías una afirmación, esa afirmación es la que tenés que citar."*
7. Persistir pregunta y respuesta con sus citas.

Reglas del system prompt que no hay que perder:

- *"Respondés EXCLUSIVAMENTE con base en las fuentes que el sistema te entrega."*
- *"Nunca inventes números de artículo, ordenanzas, cifras ni contenido que no aparezca en las fuentes."*
- *"Analizá cada fragmento y descartá los que no sean pertinentes, aunque hayan sido recuperados."*
- *"Si dos fragmentos se contradicen, explicá ambas versiones sin elegir una sin evidencia."*
- *"Si la respuesta no está en las fuentes, decilo explícitamente. No completes con suposiciones."*
- Cierre con una línea `Fuentes:`, y tono profesional. **La IA orienta; la validación legal la hace el equipo municipal.**

---

## 7. Decisiones no obvias que ya se pagaron caras (no volver a descubrirlas)

1. **Vercel plan Hobby: 12 funciones serverless por deploy, y cada `route.ts` cuenta como una.** Por eso las tres acciones del importador viven en UNA sola ruta discriminadas por un campo `action`, en vez de una ruta por operación. Feo pero defendible: son tres pasos del mismo flujo sobre el mismo recurso. Verificar en qué plan está CarteleríIA antes de diseñar las rutas.
2. **En Vercel, `process.cwd()` es `/var/task` y es de SOLO LECTURA.** El modelo de embeddings ni siquiera podía descargarse y el retrieval vectorial moría en cada consulta. La caché va a `/tmp`: `env.cacheDir = process.env.VERCEL ? "/tmp/transformers-cache" : join(process.cwd(), ".cache", "transformers")`. El modelo (~110 MB) se baja una vez por instancia tibia.
3. **Supabase: pooler en modo TRANSACCIÓN (puerto 6543, `pgbouncer=true`) para la app; modo sesión (5432) solo para migraciones** (`DIRECT_URL`). En modo sesión cada cliente reserva una conexión real, el tope son 15, y producción se cae apenas hay unas pocas lambdas vivas.
4. **`unaccent` en AMBOS lados de la comparación full-text.** El usuario escribe "automoviles", el texto dice "Automóviles".
5. **Los prefijos de e5 (`passage:` / `query:`) no son opcionales.** Sin ellos la calidad del retrieval cae notablemente.
6. **`extract-text.ts` y el ingestor NO llevan `import "server-only"`**, a propósito: los usan scripts de backfill que corren por `tsx` fuera de Next, donde `server-only` tira.
7. **pdfjs: usar la build legacy `.mjs`.** La `.js` no resuelve en este entorno.
8. **Guardar el `sha256` del archivo.** Con documentos cargados de a uno, duplicar es facilísimo.
9. **El texto que ve el modelo y el texto contra el que se verifican las citas tienen que ser el MISMO string.** Sanear una sola vez.

---

## 8. Qué NO traer de UrbanIA

- Formalizar / Diagnosticar (los dos pasos de IA para redactar articulado). Es otro problema.
- Dictámenes de áreas, apoyos, votación.
- Export PDF con membrete institucional (`lib/brand/document-shell.ts` + puppeteer). Vale la pena, pero después.
- Todo lo de audiencias públicas: transcripción, ASR, YouTube, matching en vivo.
- Panel de demanda ciudadana, mapa, GIS.
- El vocabulario "reforma / código nuevo / norma". CarteleríIA tiene su propio dominio; nombrar las cosas por lo que son ahí.

---

## 9. Lo que hay que preguntarle a Lucas antes de escribir código

1. **¿Qué es exactamente "la ordenanza" que va a pasar el jefe?** ¿Una ordenanza vigente de cartelería, o un proyecto de ordenanza nuevo que se está discutiendo? Cambia el encuadre: analizar una norma vigente vs. evaluar una propuesta.
2. **¿Una sola ordenanza o varias?** Si es una sola y fija, la primera versión puede ser un script de ingesta por CLI + la pantalla de chat, sin el flujo de subida. Mucho menos trabajo y sirve para validar el concepto con el jefe esta semana.
3. **¿Quién pregunta?** ¿Solo el equipo interno, o también inspectores / vecinos / comercios? Define si hace falta el filtro `publicOnly` del retrieval y qué se muestra.
4. **¿"Preguntar cosas de esta propuesta" incluye preguntas comparativas** ("¿esto contradice la ordenanza vigente?", "¿qué cambia respecto de lo que hay hoy?")? Si sí, el retrieval necesita scope múltiple desde el principio.
5. **¿CarteleríIA ya tiene Postgres con pgvector?** Si no, hay que habilitarlo o buscar alternativa.
6. **¿Ya hay auth y roles en CarteleríIA?** Los endpoints de UrbanIA validan sesión y rol staff antes de todo.
7. **¿Hay bucket de Storage configurado?**

---

## 10. Orden de trabajo sugerido

1. Leer CarteleríIA y reportar el diff de stack contra la tabla de la sección 2.
2. Habilitar `vector` + `unaccent`, agregar `KnowledgeSource` / `KnowledgeChunk`, migrar.
3. Portar `embeddings.ts`, `extract-text.ts` + polyfills, `openrouter.ts`.
4. Portar el ingestor (chunk + embed + upsert) y hacer un **script CLI** que ingeste un PDF desde disco. **Probarlo con la ordenanza real antes de tocar una sola línea de UI.**
5. Portar `rag.ts` con el filtro por `sourceId` agregado.
6. Endpoint del chat + UI mínima. **Acá ya se puede mostrar algo funcionando.**
7. Recién entonces: subida por UI, análisis IA del documento, ficha, visor con resaltado.

El punto 4 es el hito real: si el retrieval sobre la ordenanza devuelve fragmentos pertinentes, el resto es plomería.

---

## 11. Variables de entorno necesarias

```env
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres?sslmode=require"

NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""      # firma las signed URLs de subida
SUPABASE_<...>_BUCKET=""          # bucket público para los PDFs

OPENROUTER_API_KEY=""
OPENROUTER_MODEL="openai/gpt-4o-mini"   # tareas livianas (reescritor de intención)
OPENROUTER_CPU_MODEL="openai/gpt-4o"    # lectura de documentos y consulta normativa
OPENROUTER_SITE_URL="http://localhost:3000"
OPENROUTER_APP_NAME="CarteleriIA"
```

Los embeddings no requieren API key: corren locales.

---

## 12. Identidad visual

CarteleríIA es un producto de la Municipalidad de San Miguel de Tucumán, igual que UrbanIA. Aplica el sistema de diseño municipal: azul institucional `#1f89f6` como primario, celeste `#35aeea`, amarillo del isotipo `#f6d500`, verde `#81fc87` solo como acento de estado positivo, fondo dark `#06121f`, panel `#0d1b2a`, texto `#eef7ff`. Logo municipal presente. Debe sentirse como un sistema administrativo para gabinete, no como una landing.

---

## Prompt para arrancar el chat nuevo

> Adjunto el contexto del módulo que quiero replicar. Es la "Fábrica de Normas" de UrbanIA (otro proyecto de la misma dirección) y quiero traer a CarteleríIA la parte de **ingesta de un PDF + chat RAG sobre ese documento**, que acá se va a llamar **Laboratorio de Norma**.
>
> Antes de escribir código: leé CarteleríIA y decime qué del stack coincide con UrbanIA y qué no, y hacéme las preguntas de la sección 9 que no puedas responder mirando el repo. Después armamos el plan.
