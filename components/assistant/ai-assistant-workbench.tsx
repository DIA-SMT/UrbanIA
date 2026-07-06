"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  FileText,
  GitBranch,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { MigueCard } from "@/components/assistant/migue-card";
import { MarkdownText } from "@/components/assistant/markdown-text";
import { migueCapabilities, type MigueModule } from "@/lib/ai/migue";

type AssistantMode = "natural" | "normativa" | "gabinete" | "escenario" | "audiencias" | "documentos";

type AssistantPrompt = {
  id: string;
  mode: AssistantMode;
  label: string;
  query: string;
};

type AssistantAnswer = {
  title: string;
  summary: string;
  findings: string[];
  sources: Array<{ label: string; detail: string; href?: string }>;
  actions: Array<{ label: string; href?: string }>;
  caveat: string;
};

type LiveAssistantAnswer = {
  answer: string;
  model: string;
  provider: "openrouter";
};

const prompts: AssistantPrompt[] = [
  {
    id: "lenguaje-natural",
    mode: "natural",
    label: "Lenguaje natural",
    query: "Migue, tengo una idea medio desordenada sobre mejorar una plaza barrial. Ayudame a convertirla en una propuesta clara."
  },
  {
    id: "cpu-alturas",
    mode: "normativa",
    label: "CPU y alturas",
    query: "Que puntos del Codigo de Planeamiento deberiamos revisar para la propuesta de alturas en corredor norte?"
  },
  {
    id: "resumen-gabinete",
    mode: "gabinete",
    label: "Resumen de reunion",
    query: "Resumi la reunion de gabinete sobre corredor Aconquija y separa decisiones, riesgos y pendientes."
  },
  {
    id: "escenario-aconquija",
    mode: "escenario",
    label: "Escenario de decision",
    query: "Converti la ciclovia de Av. Aconquija en una recomendacion ejecutiva para gabinete."
  },
  {
    id: "aportes-cidituc",
    mode: "gabinete",
    label: "Aportes ciudadanos",
    query: "Que aportes ciudadanos deberiamos mirar antes de elevar una propuesta a audiencia publica?"
  },
  {
    id: "audiencia-plaza",
    mode: "audiencias",
    label: "Audiencia publica",
    query: "Resumi una audiencia sobre renovacion de una plaza y separa reclamos, compromisos, objeciones y preguntas pendientes."
  },
  {
    id: "documentos-aportados",
    mode: "documentos",
    label: "Documentos",
    query: "Analiza documentos aportados por vecinos sobre arbolado urbano y extrae puntos clave, evidencia y datos faltantes."
  }
];

const answers: Record<string, AssistantAnswer> = {
  "lenguaje-natural": {
    title: "Idea ciudadana convertida en propuesta",
    summary:
      "Migue puede recibir una frase informal y transformarla en una propuesta presentable: problema, ubicacion, solucion, beneficiarios, evidencia necesaria y proximos pasos.",
    findings: [
      "No exige comandos: interpreta lenguaje natural y ordena la intencion del usuario.",
      "Si faltan datos, pide solo lo necesario: barrio, ubicacion, problema y evidencia disponible.",
      "Puede adaptar la salida para vecino, empleado o administrador.",
      "La respuesta debe separar dato aportado, inferencia y recomendacion."
    ],
    sources: [
      { label: "Modo ciudadano", detail: "Guia simple para participacion publica", href: "/participacion" },
      { label: "Propuestas", detail: "Estructura esperada para ideas ciudadanas", href: "/propuestas" },
      { label: "Migue", detail: "Entrada libre en lenguaje natural", href: "/asistente" }
    ],
    actions: [
      { label: "Crear borrador de propuesta", href: "/propuestas" },
      { label: "Revisar participacion", href: "/participacion" },
      { label: "Pedir datos faltantes" }
    ],
    caveat: "Migue ordena y sugiere. La propuesta final debe ser enviada o validada por el usuario responsable."
  },
  "cpu-alturas": {
    title: "Revision normativa preliminar sobre alturas",
    summary:
      "La propuesta deberia revisarse como expediente urbanistico antes de cualquier decision ejecutiva. El foco inicial no es solo la altura maxima, sino la compatibilidad entre distrito, capacidad de servicios, morfologia urbana y procedimiento deliberativo.",
    findings: [
      "Validar distrito, usos permitidos, FOT/FOS, retiros y altura maxima aplicable.",
      "Cruzar la propuesta con capacidad vial, servicios, infraestructura critica y presion inmobiliaria del sector.",
      "Si el cambio afecta condiciones urbanas sensibles, conviene preparar audiencia publica y dictamen legal previo.",
      "La decision deberia quedar trazada como escenario, no como aprobacion directa."
    ],
    sources: [
      { label: "Codigo de Planeamiento Urbano", detail: "Articulos vinculados a distrito, alturas y retiros", href: "/normativa" },
      { label: "Reunion de gabinete", detail: "Revision normativa de alturas", href: "/gabinete" },
      { label: "Escenario", detail: "Revision de alturas permitidas", href: "/escenarios/codigo-alturas" }
    ],
    actions: [
      { label: "Abrir escenario normativo", href: "/escenarios/codigo-alturas" },
      { label: "Revisar acta de gabinete", href: "/gabinete" },
      { label: "Preparar matriz legal" }
    ],
    caveat: "Respuesta demo. En produccion debe citar articulos reales del CPU y documentos oficiales cargados."
  },
  "resumen-gabinete": {
    title: "Sintesis ejecutiva de reunion",
    summary:
      "La reunion sobre Av. Aconquija dejo una posible intervencion piloto, pero condicionada a relevamiento vial, gestion con frentistas y definicion de tramos. La conversacion no cerro una obra: ordeno los pasos para convertir la idea en escenario medible.",
    findings: [
      "Decision principal: solicitar relevamiento vial y preparar una alternativa piloto.",
      "Riesgo central: conflicto con estacionamiento y resistencia comercial inicial.",
      "Pendientes: mapa de conflictos, costo por tramo y antecedentes comparables.",
      "Comunicacion deberia participar antes de anunciar cualquier traza."
    ],
    sources: [
      { label: "Acta de gabinete", detail: "Movilidad y corredor Aconquija", href: "/gabinete" },
      { label: "Proyecto vinculado", detail: "Nueva ciclovia en Av. Aconquija", href: "/proyectos/ciclovia-aconquija" },
      { label: "Escenario", detail: "Escenario ciclovia Aconquija", href: "/escenarios/ciclovia-aconquija" }
    ],
    actions: [
      { label: "Abrir registro de gabinete", href: "/gabinete" },
      { label: "Abrir escenario", href: "/escenarios/ciclovia-aconquija" },
      { label: "Generar informe de reunion" }
    ],
    caveat: "Respuesta generada desde mocks de acta. Luego deberia salir de transcripcion, notas y documentos adjuntos."
  },
  "escenario-aconquija": {
    title: "Recomendacion ejecutiva para escenario Aconquija",
    summary:
      "La recomendacion es avanzar con un piloto controlado, no con una obra integral inmediata. El piloto permite medir impacto, reducir exposicion politica y ajustar el diseno antes de comprometer presupuesto mayor.",
    findings: [
      "Alternativa sugerida: piloto por tramo con medicion antes/despues.",
      "Indicadores iniciales: seguridad vial, ocupacion de estacionamiento, flujo ciclista y percepcion comercial.",
      "Areas requeridas: Movilidad, Planeamiento, Obras Publicas y Comunicacion.",
      "Antes de gabinete final: cerrar costo estimado, tramos y estrategia de comunicacion."
    ],
    sources: [
      { label: "Escenario de decision", detail: "Ciclovia Av. Aconquija", href: "/escenarios/ciclovia-aconquija" },
      { label: "Proyecto", detail: "Ficha territorial de la propuesta", href: "/proyectos/ciclovia-aconquija" },
      { label: "Mapa", detail: "Punto territorial vinculado", href: "/mapa" }
    ],
    actions: [
      { label: "Abrir escenario", href: "/escenarios/ciclovia-aconquija" },
      { label: "Ver proyecto", href: "/proyectos/ciclovia-aconquija" },
      { label: "Armar minuta para gabinete" }
    ],
    caveat: "No usa todavia modelos de transito ni GIS real. Es simulacion estrategica para decision."
  },
  "aportes-cidituc": {
    title: "Lectura preliminar de aportes ciudadanos",
    summary:
      "Antes de elevar una propuesta a audiencia, conviene mirar aportes por zona, recurrencia del problema, actores afectados y objeciones tempranas. UrbanIA deberia tomar esos insumos desde Cidituc sin duplicar la participacion ciudadana.",
    findings: [
      "Agrupar aportes por barrio, tema urbano y propuesta vinculada.",
      "Separar apoyos, objeciones, reclamos historicos y propuestas alternativas.",
      "Marcar temas sensibles que requieran audiencia o comunicacion previa.",
      "Usar esos patrones como evidencia, no como decision automatica."
    ],
    sources: [
      { label: "Aportes Cidituc", detail: "Integracion ciudadana prevista", href: "/participacion" },
      { label: "Audiencias", detail: "Agenda deliberativa", href: "/audiencias" },
      { label: "Gabinete", detail: "Decisiones y pendientes", href: "/gabinete" }
    ],
    actions: [
      { label: "Ver aportes", href: "/participacion" },
      { label: "Abrir audiencias", href: "/audiencias" },
      { label: "Crear resumen ciudadano" }
    ],
    caveat: "Cuando exista conexion con Cidituc, esta lectura deberia usar datos reales y filtros por territorio."
  },
  "audiencia-plaza": {
    title: "Procesamiento inteligente de audiencias",
    summary:
      "Migue puede trabajar sobre transcripciones, actas o notas de audiencia para convertir intervenciones dispersas en una minuta clara con trazabilidad.",
    findings: [
      "Extrae temas principales, participantes, reclamos, compromisos, objeciones y preguntas sin responder.",
      "Clasifica posiciones: apoyo, objecion, neutral o requiere revision.",
      "Vincula menciones a barrios, calles, proyectos, propuestas y documentos cargados.",
      "Genera una version ciudadana y otra ejecutiva para equipos internos."
    ],
    sources: [
      { label: "Audiencias", detail: "Agenda deliberativa y materiales asociados", href: "/audiencias" },
      { label: "Gabinete", detail: "Decisiones, riesgos y pendientes", href: "/gabinete" },
      { label: "Documentos", detail: "Actas, anexos y transcripciones aportadas" }
    ],
    actions: [
      { label: "Abrir audiencias", href: "/audiencias" },
      { label: "Generar minuta ejecutiva" },
      { label: "Listar acciones pendientes" }
    ],
    caveat: "Para citar con precision necesita transcripcion, acta o documentos cargados. Sin fuente real, solo puede proponer una estructura de analisis."
  },
  "documentos-aportados": {
    title: "Lectura de documentos aportados",
    summary:
      "Migue puede resumir documentacion, extraer entidades y responder preguntas con evidencia, cuidando no inventar datos ni reemplazar dictamen tecnico o legal.",
    findings: [
      "Procesa PDFs, actas, informes, notas vecinales, ordenanzas, anexos y memorias descriptivas.",
      "Extrae fechas, responsables, calles, barrios, instituciones, obligaciones y riesgos.",
      "Compara documentos para detectar contradicciones o informacion faltante.",
      "Crea versiones simples para vecinos y sintesis tecnicas para equipos municipales."
    ],
    sources: [
      { label: "Normativa", detail: "Ordenanzas y Codigo de Planeamiento", href: "/normativa" },
      { label: "Audiencias", detail: "Documentacion presentada por participantes", href: "/audiencias" },
      { label: "RAG", detail: "Base documental pendiente de conexion vectorial" }
    ],
    actions: [
      { label: "Preparar resumen documental" },
      { label: "Extraer evidencia citada" },
      { label: "Detectar datos faltantes" }
    ],
    caveat: "Cuando se conecte el repositorio documental, cada respuesta debe incluir fuente, fragmento o referencia verificable."
  }
};

const modeStyles: Record<AssistantMode, string> = {
  natural: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  normativa: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  gabinete: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  escenario: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  audiencias: "border-violet-300/20 bg-violet-300/10 text-violet-100",
  documentos: "border-rose-300/20 bg-rose-300/10 text-rose-100"
};

const moduleByMode: Record<AssistantMode, MigueModule> = {
  natural: "asistente",
  normativa: "planeamiento",
  gabinete: "dashboard",
  escenario: "gemelo_digital",
  audiencias: "audiencias",
  documentos: "documentos"
};

export function AiAssistantWorkbench() {
  const [selectedPromptId, setSelectedPromptId] = useState(prompts[0].id);
  const [customQuestion, setCustomQuestion] = useState(prompts[0].query);
  const [liveAnswer, setLiveAnswer] = useState<LiveAssistantAnswer | null>(null);
  const [liveError, setLiveError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId) ?? prompts[0];
  const answer = answers[selectedPrompt.id];

  const relatedPrompts = useMemo(
    () => prompts.filter((prompt) => prompt.mode === selectedPrompt.mode && prompt.id !== selectedPrompt.id),
    [selectedPrompt]
  );

  function selectPrompt(prompt: AssistantPrompt) {
    setSelectedPromptId(prompt.id);
    setCustomQuestion(prompt.query);
    setLiveAnswer(null);
    setLiveError("");
  }

  async function handleLiveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = customQuestion.trim();

    if (question.length < 3) {
      setLiveError("Escribi una consulta un poco mas especifica para Migue.");
      return;
    }

    setIsAsking(true);
    setLiveError("");
    setLiveAnswer(null);

    try {
      const response = await fetch("/api/assistant/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          assistantContext: {
            mode: "internal",
            module: moduleByMode[selectedPrompt.mode],
            role: "admin",
            page: "Analisis IA de UrbanIA",
            intent: selectedPrompt.label
          },
          context: "Pantalla de Analisis IA de UrbanIA. El sistema trabaja con propuestas, normativa, gabinete, audiencias, mapa urbano, escenarios y participacion ciudadana."
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "No se pudo consultar a Migue.");
      }

      setLiveAnswer(payload as LiveAssistantAnswer);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "No se pudo consultar a Migue.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
              <Bot className="h-4 w-4" />
              Migue conectado
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">Migue, IA para decisiones urbanas</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Consulta en lenguaje natural normativa, propuestas, reuniones, audiencias, documentos y escenarios con un asistente pensado para gestion municipal clara.
            </p>
          </div>

          <MigueCard />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatusItem label="Entrada" value="Lenguaje natural" icon={MessageSquare} />
        <StatusItem label="Fuentes objetivo" value="Audiencias, docs, CPU" icon={BookOpen} />
        <StatusItem label="Proxima etapa" value="RAG + citas reales" icon={GitBranch} />
      </section>

      <section className="urban-card rounded-lg p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Funciones de Migue</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Capacidades principales</h2>
          </div>
          <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100">
            Manejo por lenguaje natural
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {migueCapabilities.map((capability) => (
            <div key={capability.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-black text-white">{capability.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{capability.summary}</p>
              <div className="mt-4 space-y-2">
                {capability.items.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm leading-5 text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="urban-card rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-white">Consultas sugeridas</h2>
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs font-bold text-slate-300">Lenguaje natural</span>
          </div>
          <div className="space-y-3">
            {prompts.map((prompt) => {
              const isSelected = prompt.id === selectedPrompt.id;

              return (
                <button
                  key={prompt.id}
                  type="button"
              onClick={() => selectPrompt(prompt)}
                  className={`urban-lift w-full rounded-lg border p-4 text-left transition ${
                    isSelected ? "border-sky-300/35 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:border-sky-300/25"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[11px] font-black ${modeStyles[prompt.mode]}`}>{prompt.mode}</span>
                    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-300">{prompt.label}</span>
                  </div>
                  <p className="text-sm font-semibold leading-6 text-slate-200">{prompt.query}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="grid gap-4">
          <section className="urban-card rounded-lg p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sky-300/10 text-sky-200">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Consulta</p>
                <p className="mt-2 text-lg font-black leading-7 text-white">{selectedPrompt.query}</p>
              </div>
            </div>
            <form onSubmit={handleLiveQuestion} className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-500">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={customQuestion}
                onChange={(event) => setCustomQuestion(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-2 font-semibold text-slate-200 outline-none placeholder:text-slate-500"
                placeholder="Escribi una consulta urbana, normativa o de gabinete..."
              />
              <button
                type="submit"
                disabled={isAsking}
                className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isAsking ? "Consultando" : "Preguntar"}
              </button>
            </form>
          </section>

          {liveAnswer || liveError ? (
            <section className={`urban-card rounded-lg p-5 ${liveAnswer ? "border-sky-300/30" : "border-amber-300/30"}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-black text-white">
                  <Bot className="h-5 w-5 text-sky-300" />
                  Migue responde
                </h2>
                {liveAnswer ? (
                  <span className="rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-black text-sky-100">
                    OpenRouter - {liveAnswer.model}
                  </span>
                ) : null}
              </div>
              {liveAnswer ? (
                <MarkdownText text={liveAnswer.answer} />
              ) : (
                <p className="text-sm leading-6 text-amber-100">{liveError}</p>
              )}
            </section>
          ) : null}

          <section className="urban-card urban-lift rounded-lg p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-white">
                <Sparkles className="h-5 w-5 text-sky-300" />
                {answer.title}
              </h2>
              <span className={`rounded-md border px-3 py-1 text-xs font-black ${modeStyles[selectedPrompt.mode]}`}>Respuesta simulada</span>
            </div>
            <p className="text-sm leading-7 text-slate-300">{answer.summary}</p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Panel title="Hallazgos" icon={CheckCircle2}>
                <List items={answer.findings} />
              </Panel>
              <Panel title="Fuentes citadas" icon={FileText}>
                <div className="grid gap-3">
                  {answer.sources.map((source) => (
                    <SourceCard key={source.label} source={source} />
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Panel title="Acciones sugeridas" icon={ArrowRight}>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
                {answer.actions.map((action) =>
                  action.href ? (
                    <Link key={action.label} href={action.href} className="urban-button inline-flex items-center justify-between gap-3 rounded-md border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm font-black text-sky-100">
                      {action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <button key={action.label} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-black text-slate-200">
                      {action.label}
                    </button>
                  )
                )}
              </div>
            </Panel>

            <aside className="urban-card rounded-lg p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-white">
                <ShieldAlert className="h-5 w-5 text-amber-300" />
                Validacion humana
              </h2>
              <p className="text-sm leading-6 text-slate-300">{answer.caveat}</p>
              <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
                La IA propone. Gabinete valida, edita y aprueba antes de generar documentos oficiales.
              </div>
            </aside>
          </section>

          {relatedPrompts.length ? (
            <section className="urban-card rounded-lg p-5">
              <h2 className="mb-4 text-lg font-black text-white">Consultas relacionadas</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {relatedPrompts.map((prompt) => (
                  <button key={prompt.id} onClick={() => selectPrompt(prompt)} className="urban-lift rounded-md border border-white/10 bg-white/[0.03] p-3 text-left text-sm font-semibold leading-6 text-slate-300">
                    {prompt.query}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatusItem({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Sparkles }) {
  return (
    <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
      <Icon className="mb-2 h-4 w-4 text-civic-sky" />
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof CheckCircle2; children: React.ReactNode }) {
  return (
    <div className="urban-card rounded-lg p-4">
      <h3 className="mb-3 flex items-center gap-2 text-base font-black text-white">
        <Icon className="h-4 w-4 text-civic-sky" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-300" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function SourceCard({ source }: { source: AssistantAnswer["sources"][number] }) {
  const content = (
    <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
      <p className="text-sm font-black text-white">{source.label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{source.detail}</p>
    </div>
  );

  if (!source.href) {
    return content;
  }

  return <Link href={source.href}>{content}</Link>;
}
