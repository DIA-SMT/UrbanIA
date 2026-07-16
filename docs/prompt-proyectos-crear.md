# Prompt para Code — Módulo "Proyectos" con creación asistida por IA

> Pegar todo lo que sigue (desde "## Contexto" hasta el final) como prompt en Claude Code, trabajando sobre el repo UrbanIA.

---

## Contexto

Trabajás sobre UrbanIA, plataforma GovTech de la Municipalidad de San Miguel de Tucumán (Next.js App Router + TypeScript + Prisma/PostgreSQL + PostGIS + Tailwind). Leé `AGENTS.md` antes de empezar y respetá su identidad visual y criterio frontend.

Hoy `/proyectos` es una vista read-only que lista `Proposal` filtrando por los estados de `PROJECT_STATUSES` (`APPROVED`, `IN_PROGRESS`, `COMPLETED`). No existe forma de crear un proyecto desde la UI: solo nacen indirectamente cuando se aprueba un aporte ciudadano desde Participación.

**Objetivo:** convertir `/proyectos` en el módulo de cartera de proyectos, con un modelo `Project` propio y un flujo de creación asistido por IA con normativa anclada.

## Estado actual del código (verificado — no lo re-descubras)

**Modelos Prisma relevantes:** `Proposal`, `CitizenContribution`, `NormativeDocument`, `NormativeChapter`, `NormativeArticle`, `NormativeLink`, `Ordinance`, `ArticleVersion`, `District`, `LandUse`, `DistrictLandUseRule`, `UrbanLayer`, `MapFeature`, `User`, `CabinetMeeting`, `CabinetIdea`, `Meeting`, `TranscriptSegment`, `KnowledgeSource`, `KnowledgeChunk`, `AiQuery`.

**Enums relevantes:** `UserRole` (`ADMIN | OFFICIAL | TECHNICIAN | CITIZEN`), `ProposalStatus`, `ProposalSource` (`CITIZEN | OFFICIAL | CABINET | TECHNICAL_TEAM`), `NormativeStatus`, `NormativeRelationshipType` (`APPLIES | MODIFIES | REFERENCES | POTENTIAL_CONFLICT | SUPPORTS | REQUIRES_REVIEW`), `IdeaStatus`, `GeometryType`.

**Librerías internas que DEBÉS reutilizar (no reimplementar):**

- `lib/db/prisma.ts` → cliente `prisma`
- `lib/ai/openrouter.ts` → `askUrbanAssistant(messages, { model, json, maxTokens, temperature })`, `hasOpenRouterConfig()`, tipos `UrbanAssistantMessage` / `UrbanAssistantResponse`
- `lib/ai/rag.ts` → `retrieveRelevantFragments`, `buildRagContextBlock`, `buildAnswerSource`, tipos `RagRetrieval` / `AnswerSource`
- `lib/normative/data.ts` → **`getNormativeExplorerData(): Promise<NormativeExplorerData>`** y tipos `NormativeExplorerData` / `NormativeExplorerArticle`
- `lib/normative/search.ts` → `retrieveRelevantArticles(articles, question, limit)`, tipo `RetrievedArticle`
- `lib/auth/session.ts` → `readSessionToken`, `sessionCookieName`, `canAccessAdmin(role)`
- `lib/proposals/shared.ts` → `proposalStatusLabels`, `proposalSourceLabels`, `PROJECT_STATUSES`, `ProposalListItem`
- `lib/proposals/data.ts` → `listProposals`, `listProjectProposals`, `toProjectListItem`

**Componentes existentes:** `components/shell.tsx` (`AppShell`), `components/brand.tsx`, `components/projects/project-detail.tsx`, `components/map/urban-map-shell.tsx` (`UrbanMapShell`), `components/map/urban-leaflet-map.tsx` (`UrbanLeafletMap`), `components/normative/normative-explorer.tsx`, `components/assistant/markdown-text.tsx`, `components/assistant/source-citation.tsx`.

**Clases CSS del sistema (en `app/globals.css`):** `.urban-card`, `.urban-lift`, `.urban-button`, `.eyebrow`, color `bg-civic-blue`. Usalas; no inventes un sistema visual nuevo. Soportar dark y light (`html.urban-light`).

**Convenciones de API observadas** (seguí el patrón de `app/api/citizen-contributions/route.ts`):

- Validación con `zod` (v3, ya está en `package.json`)
- `NextResponse.json(...)`
- Si no hay `process.env.DATABASE_URL`, el **GET** degrada devolviendo la colección vacía con clave namespaced: `{ projects: [], isLive: false }` (así lo hace esa ruta con `{ contributions: [], isLive: false }` — no uses una clave genérica `data`)
- El **POST** en cambio no degrada: devuelve `503` con `{ error, detail }`
- `try/catch` con `console.error` y fallback degradado

---

## Referencia de diseño

El patrón viene de un gestor de consultas legales que funciona bien. La ficha de una consulta tiene, en orden vertical: header con estado editable → texto libre de hechos → contexto adjunto → chips de áreas → **anclaje de normativa con buscador y pins** → diagnóstico IA estructurado → observaciones humanas → toggle condicional → presupuesto con cálculo automático → acciones de export y conversión a expediente.

La idea clave a replicar: **el usuario ancla los documentos normativos exactos y la IA razona sobre ese texto, no sobre lo que recuerda**. UrbanIA ya tiene la normativa en la base (`NormativeArticle.content`), así que el anclaje es real, no decorativo.

---

## Tarea 1 — Modelo de datos

### 1.a Reutilizar `NormativeLink` para el anclaje (NO crear un modelo nuevo)

El anclaje de normativa **ya existe en el schema** y no hay que reinventarlo:

```prisma
model NormativeLink {
  id               String                    @id @default(cuid())
  sourceType       String                    // "project" ya está contemplado
  sourceId         String
  articleId        String
  relationshipType NormativeRelationshipType
  notes            String?
  createdBy        String?
  createdAt        DateTime                  @default(now())
  article          NormativeArticle          @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([sourceType, sourceId, articleId, relationshipType])
}
```

`app/api/normativa/links/route.ts` **ya valida `sourceType: z.enum(["project", ...])`** y hace `upsert`. Un artículo anclado a un proyecto es un `NormativeLink` con `sourceType: "project"`, `sourceId: project.id` y `relationshipType` elegido por el usuario. El enum `NormativeRelationshipType` es más rico que un pin plano: permite anclar un artículo marcándolo como `APPLIES` o como `POTENTIAL_CONFLICT`, y eso alimenta mejor al diagnóstico.

No agregues `ProjectNormativeAnchor` ni nada equivalente. Extendé la ruta existente con `GET` (por `sourceType`+`sourceId`) y `DELETE` (por `id`), conservando el `POST` tal cual está.

### 1.b Modelos nuevos

Agregá a `prisma/schema.prisma`:

```prisma
model Project {
  id             String            @id @default(cuid())
  code           String            @unique          // correlativo tipo PRY-2026-0001
  title          String
  summary        String                             // descripción libre (equivalente a "hechos del caso")
  status         ProjectStatus     @default(DRAFT)
  stage          ProjectStage      @default(FORMULATION)
  source         ProposalSource    @default(TECHNICAL_TEAM)
  areas          MunicipalArea[]                     // chips multi-select
  requiresEIA    Boolean           @default(false)  // toggle condicional: impacto ambiental
  eiaNotes       String?

  // Origen / trazabilidad
  proposalId     String?
  proposal       Proposal?         @relation(fields: [proposalId], references: [id], onDelete: SetNull)

  // Ubicación
  latitude       Float?
  longitude      Float?
  addressLabel   String?
  districtId     String?
  district       District?         @relation(fields: [districtId], references: [id], onDelete: SetNull)

  // Observaciones humanas (complementan el diagnóstico IA)
  officialNotes  String?

  createdById    String?
  createdBy      User?             @relation(fields: [createdById], references: [id])
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  diagnoses      ProjectDiagnosis[]
  budgetItems    ProjectBudgetItem[]
  attachments    ProjectAttachment[]
  cabinetIdeas   CabinetIdea[]

  @@index([status])
  @@index([stage])
  @@index([createdAt])
  @@index([proposalId])
}

// Diagnóstico IA versionado: nunca pisar el anterior, apilar versiones.
model ProjectDiagnosis {
  id             String            @id @default(cuid())
  projectId      String
  version        Int               @default(1)
  feasibility    FeasibilityLevel                    // reemplaza "probabilidad media"
  scope          String                              // equivalente a "fuero": ámbito de intervención
  objective      String                              // equivalente a "pretensión"
  analysis       String                              // texto largo fundamentado
  actions        Json              @default("[]")    // string[] acciones recomendadas
  risks          Json              @default("[]")    // string[] riesgos
  citedArticles  Json              @default("[]")    // [{ articleId, articleNumber, quote }]
  model          String?                             // modelo usado
  editedByHuman  Boolean           @default(false)
  createdAt      DateTime          @default(now())
  project        Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, version])
  @@index([projectId, createdAt])
}

model ProjectBudgetItem {
  id            String        @id @default(cuid())
  projectId     String
  concept       String
  costType      BudgetCostType
  baseAmount    Decimal       @db.Decimal(14, 2)
  multiplier    Float         @default(1)
  fundingSource String?
  amount        Decimal       @db.Decimal(14, 2)     // baseAmount * multiplier, calculado en el server
  createdAt     DateTime      @default(now())
  project       Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}

model ProjectAttachment {
  id          String   @id @default(cuid())
  projectId   String
  kind        String                                  // "documento" | "apunte" | "acta"
  name        String
  excerpt     String?
  meetingId   String?
  meeting     Meeting? @relation(fields: [meetingId], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}

enum ProjectStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  IN_PROGRESS
  SUSPENDED
  COMPLETED
  ARCHIVED
}

enum ProjectStage {
  FORMULATION
  TECHNICAL_REVIEW
  CABINET_REVIEW
  TENDER
  EXECUTION
  CLOSED
}

enum MunicipalArea {
  PLANEAMIENTO
  OBRAS_PUBLICAS
  AMBIENTE
  MOVILIDAD
  ESPACIO_PUBLICO
  DESARROLLO_SOCIAL
  HACIENDA
  LEGAL
  OTRA
}

enum FeasibilityLevel {
  HIGH
  MEDIUM
  LOW
  BLOCKED
}

enum BudgetCostType {
  OBRA
  ESTUDIO_PROYECTO
  EQUIPAMIENTO
  MANTENIMIENTO
  EXPROPIACION
  OTRO
}
```

### 1.c Cambios en modelos existentes

- `CabinetIdea`: agregar `projectId String?` **con su `@relation` a `Project`** (hoy `proposalId` existe pero está suelto, sin relation — no repitas ese error). Ojo: `CabinetIdea.meetingId` es **obligatorio**, así que no se puede crear una idea de gabinete sin una `CabinetMeeting` existente. Tenelo en cuenta en la Tarea 6.
- Agregar los campos inversos correspondientes en `User`, `Proposal`, `District` y `Meeting`.

Generá la migración con `npx prisma migrate dev --name add_project_module`. **No** rompas los estados de `Proposal` ni el flujo de Participación: `Project` convive con `Proposal`, y `Project.proposalId` es la trazabilidad al origen.

Actualizá `prisma/seed.ts` con 3–4 proyectos de ejemplo realistas de San Miguel de Tucumán (uno en cada estado, al menos uno con diagnóstico y con `NormativeLink` de `sourceType: "project"`).

## Tarea 2 — Capa de datos y vocabulario

Creá `lib/projects/shared.ts` espejando el estilo de `lib/proposals/shared.ts`:

- `projectStatusLabels: Record<ProjectStatus, string>` → Borrador, En revisión, Aprobado, En ejecución, Suspendido, Finalizado, Archivado
- `projectStageLabels: Record<ProjectStage, string>`
- `municipalAreaLabels: Record<MunicipalArea, string>`
- `relationshipTypeLabels: Record<NormativeRelationshipType, string>` → Aplica, Modifica, Refiere, Posible conflicto, Respalda, Requiere revisión
- `feasibilityLabels` y `feasibilityStyles` (clases Tailwind por nivel: HIGH verde, MEDIUM ámbar, LOW naranja, BLOCKED rojo)
- `budgetCostTypeLabels` + montos base de referencia por tipo (constantes editables en un solo lugar)
- Tipos `ProjectListItem` y `ProjectDetail`

Creá `lib/projects/data.ts` espejando `lib/proposals/data.ts`:

- `listProjects(filters?)` con filtros por status, stage y área
- `getProject(id)` con anchors (query a `normativeLink` por `sourceType: "project"`), último diagnosis, budgetItems, attachments
- `createProject(input)` — genera `code` correlativo `PRY-{año}-{secuencia}`. Generalo dentro de una transacción para evitar colisiones de correlativo.
- `updateProject(id, input)`, `toProjectListItem(...)`, `toProjectDetail(...)`
- `getProjectAnchors(projectId)` → trae los `NormativeLink` con `include: { article: true }`

Creá `lib/projects/diagnosis.ts`:

- `buildDiagnosisPrompt({ project, anchoredArticles, complementaryArticles })` → arma los `UrbanAssistantMessage[]`
- `generateProjectDiagnosis(projectId)` → orquesta: trae los anchors vía `NormativeLink`, llama a **`getNormativeExplorerData()`** para obtener el array completo de artículos y se lo pasa a `retrieveRelevantArticles(articles, project.summary, 6)` para la normativa complementaria, invoca `askUrbanAssistant` con `{ json: true }`, valida la salida con zod, y persiste un `ProjectDiagnosis` nuevo con `version = ultima + 1`

> Nota de tipos: `retrieveRelevantArticles` **necesita el array de artículos en memoria**; sin `getNormativeExplorerData()` no tenés de dónde sacarlo. Y su tipo de retorno `RetrievedArticle` usa el campo **`number`**, no `articleNumber` (el campo `articleNumber` es del modelo Prisma `NormativeArticle`, no del tipo de la lib). No los confundas al mapear.

**Reglas del prompt de diagnóstico (importante):**

- System prompt: sos analista técnico-urbano de la Municipalidad de SMT. Fundás cada afirmación normativa en los artículos provistos.
- Los artículos anclados se inyectan **completos y textuales**, marcados como fuente prioritaria y de cita obligatoria, junto con su `relationshipType` (que le dice a la IA con qué intención se ancló: `POTENTIAL_CONFLICT` no se lee igual que `APPLIES`).
- Los artículos recuperados por búsqueda van en un bloque secundario, marcados como referencia complementaria.
- Prohibido citar artículos que no estén en el contexto. Si falta información normativa para concluir, debe decirlo explícitamente en `analysis` y bajar `feasibility`.
- Salida JSON estricta: `{ feasibility, scope, objective, analysis, actions[], risks[], citedArticles[{ articleId, articleNumber, quote }] }`
- `quote` debe ser un fragmento textual del artículo, no una paráfrasis. En la validación, descartá las citas cuyo `articleId` no esté en el contexto **y** aquellas cuyo `quote` no aparezca literalmente en el `content` del artículo.
- Si `hasOpenRouterConfig()` es false, devolver un error controlado (503), no romper la página.

## Tarea 3 — API routes

- `GET /api/projects` → listado con filtros por query params. Sin `DATABASE_URL` → `{ projects: [], isLive: false }`.
- `POST /api/projects` → crea. Body validado con zod. Requiere sesión con rol `ADMIN`, `OFFICIAL` o `TECHNICIAN` (leer cookie `sessionCookieName` con `readSessionToken`). Rol `CITIZEN` → 403.
- `GET|PATCH|DELETE /api/projects/[id]` → detalle, edición parcial, borrado (solo `ADMIN`).
- `POST /api/projects/[id]/diagnose` → dispara `generateProjectDiagnosis`, devuelve el diagnóstico nuevo.
- `PATCH /api/projects/[id]/diagnosis/[diagnosisId]` → edición humana del diagnóstico, marca `editedByHuman = true`.
- `GET|POST|DELETE /api/projects/[id]/budget` → ítems de presupuesto. En POST calcular `amount = baseAmount * multiplier` **en el server**; nunca confiar en el monto que manda el cliente.
- **Anclaje:** extendé `app/api/normativa/links/route.ts` con `GET` (query params `sourceType` + `sourceId`) y `DELETE` (por `id`). No crees `/api/projects/[id]/anchors`: duplicaría el `POST` que ya existe y ya hace `upsert` correctamente.
- `GET /api/normativa/search?q=` → **ruta nueva** (no existe; la que hay es `/api/normativa/links`). Buscador para el anclaje: combina `retrieveRelevantArticles` sobre `getNormativeExplorerData()` con match exacto por número de artículo y por `NormativeDocument.ordinanceNumber` (para que buscar "Ordenanza 2648" traiga sus artículos). Máximo 20 resultados. Contrato de salida:

  ```ts
  { articles: Array<{ id, number, title, excerpt, documentTitle, score }>, isLive: boolean }
  ```

  `number` (no `articleNumber`) para alinearse con `RetrievedArticle`. `excerpt` lo derivás vos recortando `content` a ~180 caracteres alrededor del match. Debounce del lado del cliente.

  > No hagas un tab "Ordenanzas" que busque con `retrieveRelevantArticles`: `Ordinance` solo tiene `number`/`title`/`description`, no texto articulado. El anclaje es siempre sobre `NormativeArticle` (que es lo único que `NormativeLink.articleId` acepta). Buscar por ordenanza filtra artículos de ese documento.

## Tarea 4 — Pantalla de listado `/proyectos`

Reescribí `app/proyectos/page.tsx` para leer de `Project` en vez de `Proposal`:

- Mantené el hero con las métricas, pero ahora: Total, En revisión, En ejecución, Finalizados.
- Agregá un **`FilterBar`** con chips visibles de estado, etapa y área municipal (el criterio de `AGENTS.md` pide filtros con etiquetas visibles).
- Botón primario **"Crear proyecto"** (`bg-civic-blue`, con icono `Plus`) bien visible en el hero, que lleva a `/proyectos/nuevo`. Solo se muestra si el rol es `ADMIN | OFFICIAL | TECHNICIAN`.
- Las cards de proyecto muestran: código, título, badge de estado, badge de etapa, chips de áreas, monto total del presupuesto, cantidad de artículos anclados, badge de factibilidad del último diagnóstico si existe.
- **Extraé el `EmptyState` a `components/ui/empty-state.tsx`.** Hoy en `app/proyectos/page.tsx` es JSX inline, y hay copias locales sin exportar en `components/cpu/cpu-chat.tsx` y `components/hearings/hearings-board.tsx`. `AGENTS.md` lo pide como componente reutilizable: hacelo compartido y migrá esos tres usos. Props: `icon`, `title`, `description`, `action?`.

## Tarea 5 — Creación `/proyectos/nuevo`

Creá `app/proyectos/nuevo/page.tsx` + `components/projects/project-form.tsx` (client component).

**Formato: una sola pantalla con bloques apilados, no wizard.** El valor del patrón de referencia es ver todo el expediente de un vistazo y que el diagnóstico se regenere sobre lo que ya cargaste. Un wizard esconde el contexto justo cuando la IA lo necesita.

Bloques en orden:

1. **Identificación** — título, origen (`ProposalSource`), vínculo opcional a una `Proposal` existente (selector con búsqueda).
2. **Descripción del proyecto** — textarea grande, autoexpandible, placeholder que invite a escribir en crudo: *"Contá la situación: qué se quiere hacer, dónde, por qué, qué antecedentes hay. Escribí libre, después la IA lo ordena."* Este es el input principal, tiene que respirar.
3. **Contexto adicional** — lista de adjuntos con chip de tipo (documento/apunte/acta) + botón "Agregar documento / apunte" + selector "Vincular acta de reunión" que lee de `Meeting`. Cada adjunto se puede eliminar.
4. **Áreas municipales involucradas** — chips toggleables multi-select con `municipalAreaLabels`. Estilo: chip inactivo con borde tenue, activo con `bg-civic-blue/15` y borde azul.
5. **Ubicación** — input de dirección + selector de punto en mapa.

   > **Ojo:** `UrbanMapShell` y `UrbanLeafletMap` hoy **no reciben props** (`export function UrbanMapShell()`). Para usarlos como picker tenés que extenderlos con props **todas opcionales** — `mode?: "explore" | "pick"`, `value?: { lat, lng } | null`, `onPick?: (coords) => void` — de modo que los call sites actuales sigan funcionando sin cambios. Cargá el mapa con `dynamic(..., { ssr: false })`.
   >
   > **Distrito derivado:** `District.geometry` es `Unsupported("geometry")?`, así que la contención **no se resuelve con el cliente Prisma**: hace falta `prisma.$queryRaw` con PostGIS (`ST_Contains(geometry, ST_SetSRID(ST_MakePoint($lng, $lat), 4326))`). Además `District.id` es `String @id` **sin `@default`** (IDs externos tipo `R2`). Tratalo como best-effort: si la query falla o no hay geometría cargada, dejá `districtId` en null y no bloquees el formulario. Si resuelve, mostralo como dato derivado ("Distrito detectado: R2").

6. **Normativa de referencia** — el bloque más importante. Buscador con debounce sobre `/api/normativa/search`, resultados en dropdown, click ancla el artículo creando un `NormativeLink` (`sourceType: "project"`) vía el `POST` existente de `/api/normativa/links`. Al anclar, el usuario elige el `relationshipType` (default `APPLIES`) y puede dejar una nota corta en `notes`. Los pins se listan con número de artículo, título, badge del tipo de relación y botón de quitar. Contador "N anclados" arriba a la derecha. Estado vacío que explique el para qué: *"Anclá artículos para que el diagnóstico use su texto exacto en vez de una interpretación."*

   > El anclaje necesita un `sourceId`, o sea un `Project.id` real. Por eso el proyecto se persiste como `DRAFT` apenas hay título + descripción válidos (ver "Comportamiento clave").

7. **Diagnóstico técnico** — botón "Generar diagnóstico" (deshabilitado hasta que haya título + descripción de al menos 40 caracteres). Mientras corre, skeleton con estado de progreso. Resultado: badge de factibilidad, ámbito, objetivo, análisis, y dos columnas — Acciones recomendadas (icono check, verde) y Riesgos (icono alerta, ámbar). Botones "Editar" y "Regenerar diagnóstico".

   > **No reutilices `source-citation.tsx` para los artículos citados.** Su prop es `AnswerSource` (`{ reference, title, before, match, after }`), que se construye con `buildAnswerSource` a partir de fragmentos RAG de `KnowledgeChunk` — no encaja con `citedArticles[{ articleId, articleNumber, quote }]` ni sirve de adaptador. Creá `components/projects/article-citation.tsx`, tomándolo como referencia visual: muestra número + título, resalta el `quote` textual, y es un link al artículo en el explorador normativo (`source-citation` es un colapsable, no navega).

8. **Observaciones del equipo municipal** — textarea. Copy: *"Agregá lo que el diagnóstico IA omitió o lo que quieras dejar asentado."* Es el bloque que mantiene al humano como autor final; no lo escondas.
9. **Impacto ambiental** — toggle "¿Requiere evaluación de impacto ambiental?". Al activarse despliega el textarea `eiaNotes`.
10. **Presupuesto estimado** — por ítem: concepto, `BudgetCostType` como cards seleccionables mostrando el monto base de referencia, multiplicador (select 0.5× a 5×), fuente de financiamiento. Muestra el monto calculado destacado en grande. Botón "Agregar otro ítem" y total general del proyecto. Formato de moneda `es-AR` con `Intl.NumberFormat`.

**Acciones finales (sticky bottom bar):** "Guardar borrador" (secundario) · "Crear proyecto" (primario `bg-civic-blue`) · "Exportar diagnóstico PDF" (habilitado solo si ya existe diagnóstico).

**Comportamiento clave:** el proyecto se persiste como `DRAFT` apenas hay título + descripción de 40+ caracteres (o al generar el primer diagnóstico, lo que ocurra primero). Esto es necesario para tener un `Project.id` con el que anclar `NormativeLink`, y además evita perder el trabajo de la IA si el usuario cierra la pestaña. A partir de ahí el formulario opera en modo edición sobre un `id` real.

## Tarea 6 — Detalle `/proyectos/[id]`

Actualizá `app/proyectos/[id]/page.tsx` y `components/projects/project-detail.tsx`:

- Header estilo la referencia: breadcrumb "← Proyectos / {título}", código y título, subtítulo `{área principal} · {etapa}`, dropdown de estado editable inline, botones editar y eliminar.
- Mismos bloques que el formulario pero en modo lectura, con edición inline por bloque.
- Historial de diagnósticos: si hay más de una versión, selector de versión con fecha y badge si fue editado por humano. La trazabilidad es un requisito de `AGENTS.md`, no un extra.
- Acciones al pie: "Diagnóstico PDF" · "Presupuesto PDF" · **"Elevar a gabinete"** (equivalente a "Convertir a expediente").

  > **Cómo implementar "Elevar a gabinete":** `CabinetIdea.meetingId` es **obligatorio** (relation a `CabinetMeeting`), así que no podés crear la idea suelta. El botón abre un modal que lista las `CabinetMeeting` futuras o recientes y obliga a elegir una (con opción de crear una nueva reunión si no hay ninguna). Recién ahí creás el `CabinetIdea` con `projectId` (el campo nuevo de la Tarea 1.c), `title` y `description` derivados del proyecto, y pasás `project.stage` a `CABINET_REVIEW`.

## Restricciones

- Componentes chicos y separados por responsabilidad. `project-form.tsx` orquesta; cada bloque va en su propio archivo bajo `components/projects/form/`. No quiero un componente de 900 líneas.
- Tipado estricto, sin `any`. Reutilizá los tipos generados de `@prisma/client`.
- Todo el copy en español rioplatense institucional, sin tildes faltantes.
- Azul como color primario. Verde solo para estados positivos puntuales.
- Toda mutación valida rol en el server. No alcanza con ocultar el botón en el cliente.
- El diagnóstico IA nunca es la palabra final: siempre editable y siempre acompañado del bloque de observaciones humanas.
- Sin `DATABASE_URL` o sin `OPENROUTER_API_KEY`, la app degrada con mensaje claro; no tira excepción.
- Corré `npx tsc --noEmit` y `npm run lint` al terminar y dejá todo limpio.

## Entregables

1. Migración Prisma aplicada + seed actualizado (incluye `CabinetIdea.projectId`)
2. `lib/projects/{shared,data,diagnosis}.ts`
3. API routes de projects, budget, diagnose; `GET`/`DELETE` agregados a `normativa/links`; ruta nueva `normativa/search`
4. `/proyectos` con filtros, botón de creación y `EmptyState` extraído a componente compartido
5. `/proyectos/nuevo` con los 10 bloques
6. `/proyectos/[id]` con edición inline e historial de diagnósticos
7. `UrbanMapShell` / `UrbanLeafletMap` extendidos con props opcionales de picker, sin romper call sites
8. Typecheck y lint en verde
