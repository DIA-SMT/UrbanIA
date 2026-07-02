"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Brain,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Download,
  FileText,
  Link2,
  ListChecks,
  Lock,
  MapPin,
  MessageSquareText,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  Upload,
  X
} from "lucide-react";
import {
  publicHearings,
  type HearingModality,
  type HearingStatus,
  type PublicHearing,
  type TopicImportance
} from "@/lib/demo/public-hearings";

const STORAGE_KEY = "urbania-public-hearings";
const statuses: Array<HearingStatus | "Todos"> = ["Todos", "Programada", "En curso", "Finalizada", "Reprogramada", "Suspendida"];
const modalities: HearingModality[] = ["Presencial", "Virtual", "Mixta"];
const origins: PublicHearing["proposalOrigin"][] = ["Concejo", "Ciudadania", "Codigo urbano"];
const actorTypes = ["Concejal", "Planeamiento Urbano", "Vecino", "Colegio profesional", "Universidad", "Camara empresarial", "Organizacion barrial", "Especialista tecnico", "Funcionario municipal"];

const statusStyles: Record<HearingStatus, string> = {
  Programada: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  "En curso": "border-sky-300/20 bg-sky-300/10 text-sky-200",
  Finalizada: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  Reprogramada: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  Suspendida: "border-rose-300/20 bg-rose-300/10 text-rose-200"
};

const importanceStyles: Record<TopicImportance, string> = {
  Bajo: "bg-slate-400/15 text-slate-200",
  Medio: "bg-cyan-400/15 text-cyan-100",
  Alto: "bg-amber-400/15 text-amber-100",
  Critico: "bg-rose-400/15 text-rose-100"
};

type DetailTab = "Resumen" | "Debate" | "Aportes" | "Participantes" | "Documentos" | "Conclusiones" | "Temas observados" | "IA";

type HearingForm = {
  title: string;
  date: string;
  time: string;
  place: string;
  modality: HearingModality;
  status: HearingStatus;
  mainTopic: string;
  secondaryTopics: string;
  recordNumber: string;
  recordTitle: string;
  relatedProposal: string;
  proposalOrigin: PublicHearing["proposalOrigin"];
  promotingArea: string;
  recordStatus: string;
  recordDocument: string;
  relatedArticles: string;
  participantNames: string;
  participantInstitution: string;
  participantRole: string;
  participantType: string;
  participantIntervention: string;
  documents: string[];
  summary: string;
  agreements: string;
  disagreements: string;
  nextSteps: string;
  recommendations: string;
  decisions: string;
  proposalStatusAfter: string;
  observedTopics: string;
  topicImportance: TopicImportance;
  technicalObservation: string;
  citizenObservation: string;
};

const emptyForm: HearingForm = {
  title: "",
  date: "",
  time: "10:00",
  place: "Concejo Deliberante",
  modality: "Presencial",
  status: "Programada",
  mainTopic: "",
  secondaryTopics: "",
  recordNumber: "",
  recordTitle: "",
  relatedProposal: "",
  proposalOrigin: "Concejo",
  promotingArea: "Comision de Planeamiento Urbano",
  recordStatus: "En tratamiento",
  recordDocument: "",
  relatedArticles: "",
  participantNames: "",
  participantInstitution: "",
  participantRole: "Participante",
  participantType: "Vecino",
  participantIntervention: "",
  documents: [],
  summary: "Pendiente de deliberacion.",
  agreements: "Pendiente de deliberacion.",
  disagreements: "Pendiente de deliberacion.",
  nextSteps: "Publicar convocatoria y documentacion base.",
  recommendations: "Pendiente de revision tecnica.",
  decisions: "Sin decisiones registradas.",
  proposalStatusAfter: "En tratamiento",
  observedTopics: "",
  topicImportance: "Medio",
  technicalObservation: "",
  citizenObservation: ""
};

export function HearingsBoard() {
  const [hearings, setHearings] = useState<PublicHearing[]>(publicHearings);
  const [selectedId, setSelectedId] = useState(publicHearings[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<HearingStatus | "Todos">("Todos");
  const [topic, setTopic] = useState("Todas");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<HearingForm>(emptyForm);
  const [detailTab, setDetailTab] = useState<DetailTab>("IA");
  const [processedHearingIds, setProcessedHearingIds] = useState<string[]>([]);
  const agendaRef = useRef<HTMLElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const userHearings = JSON.parse(stored) as PublicHearing[];
      setHearings([...userHearings, ...publicHearings]);
      setSelectedId(userHearings[0]?.id ?? publicHearings[0]?.id ?? "");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const userHearings = useMemo(() => hearings.filter((hearing) => hearing.id.startsWith("hearing-")), [hearings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userHearings));
  }, [userHearings]);

  const topics = useMemo(
    () => ["Todas", ...Array.from(new Set(hearings.flatMap((hearing) => [hearing.mainTopic, ...hearing.secondaryTopics]))).sort()],
    [hearings]
  );

  const filteredHearings = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return hearings
      .filter((hearing) => {
        const searchable = [hearing.title, hearing.recordNumber, hearing.recordTitle, hearing.relatedProposal, hearing.promotingArea, hearing.mainTopic];
        const matchesQuery = !normalized || searchable.some((value) => value.toLowerCase().includes(normalized));
        const matchesStatus = status === "Todos" || hearing.status === status;
        const matchesTopic = topic === "Todas" || hearing.mainTopic === topic || hearing.secondaryTopics.includes(topic);
        return matchesQuery && matchesStatus && matchesTopic;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [hearings, query, status, topic]);

  const selectedHearing = filteredHearings.find((hearing) => hearing.id === selectedId) ?? filteredHearings[0] ?? hearings[0];
  const selectedHearingWasProcessed = selectedHearing ? processedHearingIds.includes(selectedHearing.id) || Boolean(selectedHearing.aiSummary) : false;

  function updateForm<K extends keyof HearingForm>(key: K, value: HearingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openAgenda() {
    agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const articles = splitList(form.relatedArticles);
    const topicNames = splitList(form.observedTopics);
    const participantNames = splitList(form.participantNames);
    const hearing: PublicHearing = {
      id: `hearing-${Date.now()}`,
      title: form.title.trim(),
      date: form.date,
      time: form.time,
      place: form.place.trim(),
      modality: form.modality,
      status: form.status,
      mainTopic: form.mainTopic.trim(),
      secondaryTopics: splitList(form.secondaryTopics),
      recordNumber: form.recordNumber.trim(),
      recordTitle: form.recordTitle.trim(),
      relatedProposal: form.relatedProposal.trim(),
      proposalOrigin: form.proposalOrigin,
      promotingArea: form.promotingArea.trim(),
      recordStatus: form.recordStatus.trim(),
      recordDocument: form.recordDocument.trim(),
      relatedArticles: articles,
      participants: participantNames.map((name) => ({
        name,
        institution: form.participantInstitution.trim() || "Sin institucion informada",
        role: form.participantRole.trim() || "Participante",
        actorType: form.participantType,
        attended: form.status === "Finalizada",
        intervention: form.participantIntervention.trim() || "Intervencion pendiente de registrar."
      })),
      documents: form.documents.map((name) => ({
        name,
        type: inferDocumentType(name),
        uploadedAt: new Date().toISOString().slice(0, 10),
        uploadedBy: form.promotingArea.trim() || "UrbanIA",
        description: "Documento adjunto al registrar la audiencia."
      })),
      debateMessages: [],
      contributions: [],
      conclusions: {
        summary: form.summary.trim(),
        agreements: form.agreements.trim(),
        disagreements: form.disagreements.trim(),
        nextSteps: form.nextSteps.trim(),
        technicalRecommendations: form.recommendations.trim(),
        decisions: form.decisions.trim(),
        proposalStatusAfter: form.proposalStatusAfter.trim()
      },
      observedTopics: topicNames.map((observedTopic, index) => ({
        topic: observedTopic,
        description: `Tema registrado en la memoria de la audiencia sobre ${form.mainTopic.trim().toLowerCase()}.`,
        importance: form.topicImportance,
        relatedArticle: articles[index] ?? articles[0] ?? "Sin articulo vinculado",
        relatedProposal: form.relatedProposal.trim(),
        technicalObservation: form.technicalObservation.trim() || "Pendiente de observacion tecnica.",
        citizenObservation: form.citizenObservation.trim() || "Pendiente de observacion ciudadana."
      }))
    };

    setHearings((current) => [hearing, ...current]);
    setSelectedId(hearing.id);
    setDetailTab("IA");
    setForm(emptyForm);
    setIsFormOpen(false);
    setQuery("");
    setStatus("Todos");
    setTopic("Todas");
  }

  function updateHearing(nextHearing: PublicHearing) {
    setHearings((current) => current.map((hearing) => hearing.id === nextHearing.id ? nextHearing : hearing));
  }

  function handleAnalyze(nextHearing: PublicHearing) {
    updateHearing(nextHearing);
    setProcessedHearingIds((current) => current.includes(nextHearing.id) ? current : [...current, nextHearing.id]);
    setDetailTab("IA");
  }

  return (
    <div className="space-y-4">
      <section className="urban-card overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
              <Brain className="h-4 w-4" />
              Audiencias con IA
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">Analisis inteligente de audiencias publicas</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">
              Carga una grabacion de audio o video para que UrbanIA ordene la audiencia: participantes, topicos, propuestas, puntos fuertes y relacion con el Codigo de Planeamiento Urbano.
            </p>
            <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
              <ActionButton icon={Plus} label="Nueva audiencia" primary onClick={() => setIsFormOpen(true)} />
              <ActionButton icon={CalendarDays} label="Ver agenda" onClick={openAgenda} />
            </div>
          </div>

          <div className="grid gap-3">
            <WorkflowStep index="1" title="Subir grabacion" text="Audio o video de la audiencia." />
            <WorkflowStep index="2" title="Procesar con IA" text="Transcripcion, actores y temas." />
            <WorkflowStep index="3" title="Vincular decision" text="Codigo urbano, proyectos y mapa." />
          </div>
        </div>
      </section>

      {selectedHearing ? <HearingAiIntake hearing={selectedHearing} onAnalyze={handleAnalyze} /> : null}

      {isFormOpen ? <HearingFormPanel form={form} onClose={() => setIsFormOpen(false)} onSubmit={handleSubmit} onUpdate={updateForm} /> : null}

      <section ref={agendaRef} className="grid scroll-mt-4 gap-4 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
        <div className="urban-card min-w-0 rounded-lg p-4 lg:p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Agenda publica</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h2 className="text-2xl font-black text-white">Audiencias por fecha</h2>
              <span className="text-xs font-semibold text-slate-500">{filteredHearings.length} resultados</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="relative block sm:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                ref={queryRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar audiencia, propuesta o expediente..."
                className="h-11 w-full rounded-md border border-white/10 bg-slate-950/70 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
              />
            </label>
            <SelectFilter value={status} options={statuses} onChange={(value) => setStatus(value as HearingStatus | "Todos")} label="Estado" />
            <SelectFilter inputRef={topicRef} value={topic} options={topics} onChange={setTopic} label="Tematica" />
          </div>

          <div className="mt-4 space-y-3">
            {filteredHearings.map((hearing) => (
              <HearingCard
                key={hearing.id}
                hearing={hearing}
                selected={selectedHearing?.id === hearing.id}
                onSelect={() => {
                  setSelectedId(hearing.id);
                  setDetailTab("IA");
                }}
              />
            ))}
            {!filteredHearings.length ? (
              <div className="rounded-md border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
                No encontramos audiencias con esos filtros.
              </div>
            ) : null}
          </div>
        </div>

        {selectedHearing ? (
          selectedHearingWasProcessed ? (
            <HearingDetail hearing={selectedHearing} activeTab={detailTab} onTabChange={setDetailTab} onUpdate={updateHearing} />
          ) : (
            <PendingAnalysisPanel hearing={selectedHearing} />
          )
        ) : null}
      </section>
    </div>
  );
}

function HearingCard({ hearing, selected, onSelect }: { hearing: PublicHearing; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`urban-lift w-full min-w-0 rounded-md border p-4 text-left transition ${
        selected ? "border-sky-300/35 bg-sky-300/[0.08]" : "border-white/8 bg-white/[0.025] hover:border-white/15"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
            <span>{formatDate(hearing.date)}</span>
            <span className="text-slate-700">/</span>
            <span>{hearing.time} hs</span>
          </div>
          <h3 className="mt-2 break-words text-base font-black leading-6 text-white">{hearing.title}</h3>
        </div>
        <ChevronRight className={`mt-1 h-5 w-5 shrink-0 ${selected ? "text-sky-300" : "text-slate-600"}`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status={hearing.status} />
        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-300">{hearing.mainTopic}</span>
      </div>
      <div className="mt-3 grid gap-1.5 text-xs text-slate-400">
        <span className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{hearing.recordNumber}</span></span>
        <span className="flex min-w-0 items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{hearing.place}</span></span>
      </div>
    </button>
  );
}

function WorkflowStep({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <div className="urban-lift rounded-md border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-300/10 text-sm font-black text-sky-200">{index}</span>
        <div>
          <h3 className="text-sm font-black text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
        </div>
      </div>
    </div>
  );
}

function HearingAiIntake({ hearing, onAnalyze }: { hearing: PublicHearing; onAnalyze: (hearing: PublicHearing) => void }) {
  const [fileName, setFileName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  function analyzeRecording() {
    if (!fileName) return;
    setIsAnalyzing(true);
    window.setTimeout(() => {
      const analysis = buildHearingAiAnalysis(hearing);
      onAnalyze({ ...hearing, aiSummary: analysis.summary, aiKeyPoints: analysis.keyPoints });
      setIsAnalyzing(false);
    }, 650);
  }

  const analysisReady = Boolean(hearing.aiSummary);

  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Procesamiento de audiencia</p>
          <h2 className="mt-2 text-2xl font-black text-white">Grabacion a memoria publica</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            La carga queda preparada para conectar transcripcion real. En esta version, el analisis simula el resultado estructurado sobre la audiencia seleccionada.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="urban-button flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-dashed border-sky-300/25 bg-sky-300/[0.04] px-4 py-3">
              <Upload className="h-5 w-5 shrink-0 text-sky-200" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{fileName || "Subir audio o video"}</span>
                <span className="block text-xs text-slate-500">MP3, WAV, MP4, MOV</span>
              </span>
              <input
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
              />
            </label>
            <button
              onClick={analyzeRecording}
              disabled={!fileName || isAnalyzing}
              className="urban-button inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {isAnalyzing ? "Analizando..." : analysisReady ? "Reanalizar" : "Analizar con IA"}
            </button>
          </div>
          {!fileName ? <p className="mt-2 text-xs font-semibold text-amber-200">Primero subi una grabacion para habilitar el analisis.</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AnalysisResultCard icon={Users} label="Participantes" value={`${hearing.participants.length} detectados`} active={analysisReady} />
          <AnalysisResultCard icon={MessageSquareText} label="Topicos" value={`${1 + hearing.secondaryTopics.length} temas`} active={analysisReady} />
          <AnalysisResultCard icon={ListChecks} label="Propuestas" value={hearing.relatedProposal || "Pendiente"} active={analysisReady} />
          <AnalysisResultCard icon={BookOpen} label="Codigo urbano" value={hearing.relatedArticles[0] ?? "Sin articulo"} active={analysisReady} />
        </div>
      </div>
    </section>
  );
}

function PendingAnalysisPanel({ hearing }: { hearing: PublicHearing }) {
  return (
    <article className="urban-card min-w-0 rounded-lg p-5">
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-lg bg-sky-300/10 text-sky-200">
          <Upload className="h-7 w-7" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-sky-300">Pendiente de procesamiento</p>
        <h2 className="mt-2 max-w-xl text-2xl font-black leading-tight text-white">{hearing.title}</h2>
        <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">
          Los participantes, topicos, propuestas, puntos fuertes y relacion normativa se van a mostrar cuando cargues una grabacion arriba y ejecutes el analisis IA.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">{hearing.recordNumber}</span>
          <span className="rounded-md border border-sky-300/15 bg-sky-300/[0.06] px-3 py-2 text-xs font-bold text-sky-100">{hearing.mainTopic}</span>
        </div>
      </div>
    </article>
  );
}

function AnalysisResultCard({ icon: Icon, label, value, active }: { icon: typeof Users; label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-md border p-4 ${active ? "border-sky-300/20 bg-sky-300/[0.05]" : "border-white/8 bg-white/[0.025]"}`}>
      <Icon className={`h-5 w-5 ${active ? "text-sky-200" : "text-slate-500"}`} />
      <p className="mt-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-black leading-5 text-white">{value}</p>
    </div>
  );
}

function HearingDetail({ hearing, activeTab, onTabChange, onUpdate }: {
  hearing: PublicHearing;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onUpdate: (hearing: PublicHearing) => void;
}) {
  const isClosed = hearing.status === "Finalizada" || hearing.status === "Suspendida";
  const tabs: Array<{ label: DetailTab; icon: typeof Users; count?: number }> = [
    { label: "IA", icon: Brain },
    { label: "Participantes", icon: Users, count: hearing.participants.length },
    { label: "Temas observados", icon: AlertTriangle, count: hearing.observedTopics.length },
    { label: "Conclusiones", icon: CheckCircle2 },
    { label: "Resumen", icon: BookOpen }
  ];

  function closeHearing() {
    if (!window.confirm("Finalizar esta audiencia bloqueara nuevos mensajes y aportes. Continuar?")) return;
    onUpdate({ ...hearing, status: "Finalizada" });
  }

  return (
    <article className="urban-card min-w-0 overflow-hidden rounded-lg">
      <header className="border-b border-white/8 p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={hearing.status} />
            <span className="rounded-md bg-sky-400/15 px-2.5 py-1 text-xs font-black text-sky-200">{hearing.mainTopic}</span>
            <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-slate-300">Origen: {hearing.proposalOrigin}</span>
          </div>
          {!isClosed ? (
            <button onClick={closeHearing} className="urban-button inline-flex items-center gap-2 rounded-md border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-xs font-black text-rose-100">
              <Lock className="h-4 w-4" /> Finalizar audiencia
            </button>
          ) : null}
        </div>
        <h2 className="mt-4 break-words text-2xl font-black leading-tight text-white lg:text-3xl">{hearing.title}</h2>
        <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-3">
          <InlineFact icon={CalendarDays} text={`${formatDate(hearing.date)} - ${hearing.time} hs`} />
          <InlineFact icon={MapPin} text={hearing.place} />
          <InlineFact icon={MessageSquareText} text={hearing.modality} />
        </div>
      </header>

      {isClosed ? (
        <div className="flex items-center gap-3 border-b border-white/8 bg-white/[0.025] px-4 py-3 text-sm text-slate-300 lg:px-5">
          <Lock className="h-4 w-4 shrink-0 text-slate-400" />
          La audiencia esta cerrada. El debate y los aportes permanecen disponibles como memoria publica.
        </div>
      ) : null}

      <div className="urban-scrollbar overflow-x-auto border-b border-white/8 px-4 lg:px-5">
        <div className="flex min-w-max gap-1 py-2">
          {tabs.map(({ label, icon: Icon, count }) => (
            <button
              key={label}
              onClick={() => onTabChange(label)}
              className={`urban-button inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-black ${
                activeTab === label ? "bg-sky-400/15 text-sky-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label === "IA" ? "Analisis IA" : label}
              {count !== undefined ? <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">{count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-5">
        {activeTab === "Resumen" ? <SummaryTab hearing={hearing} /> : null}
        {activeTab === "Debate" ? <DebateTab hearing={hearing} isClosed={isClosed} onUpdate={onUpdate} /> : null}
        {activeTab === "Aportes" ? <ContributionsTab hearing={hearing} isClosed={isClosed} onUpdate={onUpdate} /> : null}
        {activeTab === "Participantes" ? <ParticipantsTab hearing={hearing} /> : null}
        {activeTab === "Documentos" ? <DocumentsTab hearing={hearing} /> : null}
        {activeTab === "Conclusiones" ? <ConclusionsTab hearing={hearing} /> : null}
        {activeTab === "Temas observados" ? <ObservedTopicsTab hearing={hearing} /> : null}
        {activeTab === "IA" ? <AiTab hearing={hearing} onUpdate={onUpdate} /> : null}
      </div>
    </article>
  );
}

function SummaryTab({ hearing }: { hearing: PublicHearing }) {
  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Datos generales" title="Audiencia" />
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailBlock label="Tematica principal" value={hearing.mainTopic} />
        <DetailBlock label="Tematicas secundarias" value={hearing.secondaryTopics.join(", ") || "Sin tematicas secundarias"} />
      </div>

      <div className="rounded-md border border-sky-300/15 bg-sky-300/[0.05] p-4">
        <div className="flex items-center gap-2 text-sm font-black text-sky-200"><Link2 className="h-4 w-4" /> Expediente relacionado</div>
        <h3 className="mt-3 text-xl font-black text-white">{hearing.recordNumber}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">{hearing.recordTitle}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailBlock label="Propuesta vinculada" value={hearing.relatedProposal} />
          <DetailBlock label="Autor o area impulsora" value={hearing.promotingArea} />
          <DetailBlock label="Estado del expediente" value={hearing.recordStatus} />
          <DetailBlock label="Documento o enlace" value={hearing.recordDocument || "Sin documento adjunto"} />
        </div>
        {hearing.linkedProjectId ? (
          <Link
            href={`/proyectos/${hearing.linkedProjectId}`}
            className="urban-button mt-4 inline-flex w-full items-center justify-between rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white sm:w-auto sm:min-w-64"
          >
            Abrir ficha de proyecto
            <ExternalLink className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Articulos del Codigo vinculados</p>
        <div className="flex flex-wrap gap-2">
          {hearing.relatedArticles.length ? hearing.relatedArticles.map((article) => (
            <span key={article} className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-xs font-bold text-cyan-100">{article}</span>
          )) : <span className="text-sm text-slate-400">Sin articulos vinculados.</span>}
        </div>
      </div>
    </div>
  );
}

function DebateTab({ hearing, isClosed, onUpdate }: { hearing: PublicHearing; isClosed: boolean; onUpdate: (hearing: PublicHearing) => void }) {
  const [message, setMessage] = useState("");
  const [author, setAuthor] = useState("Usuario UrbanIA");
  const timeline = [
    ...(hearing.debateMessages ?? []).map((item) => ({ ...item, kind: "Mensaje" as const })),
    ...(hearing.contributions ?? []).map((item) => ({
      id: item.id,
      authorName: item.participantName,
      content: item.content || item.fileNames.join(", "),
      createdAt: item.createdAt,
      kind: "Aporte" as const
    }))
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  function addMessage() {
    const trimmedMessage = message.trim();
    const trimmedAuthor = author.trim();
    if (!trimmedMessage || !trimmedAuthor || isClosed) return;

    onUpdate({
      ...hearing,
      debateMessages: [
        ...(hearing.debateMessages ?? []),
        { id: `message-${Date.now()}`, authorName: trimmedAuthor, content: trimmedMessage, createdAt: new Date().toISOString() }
      ]
    });
    setMessage("");
  }

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Intercambio cronologico" title="Debate de la audiencia" />
      <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-md border border-white/8 bg-slate-950/30 p-3">
        {!timeline.length ? <EmptyState icon={MessageSquareText} text="Todavia no hay intervenciones en el debate." /> : null}
        {timeline.map((item) => (
          <div key={item.id} className={`rounded-md border p-3 ${item.kind === "Aporte" ? "border-cyan-300/15 bg-cyan-300/[0.05]" : "border-white/8 bg-white/[0.03]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-300">{item.authorName}</span>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-black ${item.kind === "Aporte" ? "bg-cyan-400/15 text-cyan-100" : "bg-white/[0.06] text-slate-400"}`}>{item.kind}</span>
                <span className="text-[10px] text-slate-500">{formatDateTime(item.createdAt)}</span>
              </div>
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-slate-300">{item.content}</p>
          </div>
        ))}
      </div>

      {!isClosed ? (
        <div className="rounded-md border border-sky-300/15 bg-sky-300/[0.04] p-3">
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
            <input value={author} onChange={(event) => setAuthor(event.target.value)} aria-label="Autor del mensaje" className="h-11 min-w-0 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50" />
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addMessage();
                }
              }}
              aria-label="Mensaje para el debate"
              placeholder="Escribi una observacion para el debate..."
              className="h-11 min-w-0 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
            />
            <button onClick={addMessage} disabled={!message.trim() || !author.trim()} aria-label="Enviar mensaje" className="urban-button grid h-11 w-11 place-items-center rounded-md bg-civic-blue text-white disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContributionsTab({ hearing, isClosed, onUpdate }: { hearing: PublicHearing; isClosed: boolean; onUpdate: (hearing: PublicHearing) => void }) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const contributions = hearing.contributions ?? [];

  function addContribution() {
    const trimmedAuthor = author.trim();
    const trimmedContent = content.trim();
    if (!trimmedAuthor || (!trimmedContent && !fileNames.length) || isClosed) return;
    const now = new Date().toISOString();
    const newDocuments = fileNames.map((name) => ({
      name,
      type: inferDocumentType(name),
      uploadedAt: now.slice(0, 10),
      uploadedBy: trimmedAuthor,
      description: "Archivo asociado a un aporte formal de la audiencia."
    }));

    onUpdate({
      ...hearing,
      contributions: [
        ...contributions,
        { id: `contribution-${Date.now()}`, participantName: trimmedAuthor, content: trimmedContent, createdAt: now, fileNames }
      ],
      documents: [...hearing.documents, ...newDocuments]
    });
    setAuthor("");
    setContent("");
    setFileNames([]);
    setFileInputKey((current) => current + 1);
  }

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Presentaciones formales" title="Aportes a la audiencia" />
      {!isClosed ? (
        <div className="rounded-md border border-sky-300/15 bg-sky-300/[0.04] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Autor del aporte" value={author} onChange={setAuthor} placeholder="Persona, institucion u organizacion" />
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Documento adjunto</span>
              <input key={fileInputKey} type="file" multiple accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={(event) => setFileNames(Array.from(event.target.files ?? []).map((file) => file.name))} className="h-11 w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1.5 text-xs font-semibold text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-cyan-400/15 file:px-2 file:py-1.5 file:font-bold file:text-cyan-100" />
            </label>
          </div>
          <div className="mt-3">
            <TextArea label="Contenido del aporte" value={content} onChange={setContent} />
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={addContribution} disabled={!author.trim() || (!content.trim() && !fileNames.length)} className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Upload className="h-4 w-4" /> Publicar aporte</button>
          </div>
        </div>
      ) : null}

      {!contributions.length ? <EmptyState icon={FileText} text="Todavia no hay aportes formales registrados." /> : (
        <div className="space-y-3">
          {contributions.slice().reverse().map((item) => (
            <div key={item.id} className="rounded-md border border-white/8 bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-white">{item.participantName}</h3>
                <span className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
              </div>
              {item.content ? <p className="mt-3 break-words text-sm leading-6 text-slate-300">{item.content}</p> : null}
              {item.fileNames.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.fileNames.map((name) => <span key={name} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-400/10 px-2.5 py-1.5 text-xs font-bold text-cyan-100"><Paperclip className="h-3.5 w-3.5" /> {name}</span>)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AiTab({ hearing, onUpdate }: { hearing: PublicHearing; onUpdate: (hearing: PublicHearing) => void }) {
  function generateAnalysis() {
    const analysis = buildHearingAiAnalysis(hearing);
    onUpdate({ ...hearing, aiSummary: analysis.summary, aiKeyPoints: analysis.keyPoints });
  }

  function downloadReport() {
    const content = buildHearingReport(hearing);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Audiencia_${hearing.recordNumber.replace(/[^a-zA-Z0-9-]/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Lectura asistida" title="Sintesis de deliberacion" />
        {hearing.aiSummary ? <button onClick={downloadReport} className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200"><Download className="h-4 w-4" /> Descargar reporte</button> : null}
      </div>

      <div className="rounded-md border border-sky-300/15 bg-sky-300/[0.04] p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sky-400/15 text-sky-200"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-white">Resultado esperado del analisis</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">La IA organiza la grabacion en participantes, topicos, propuestas, puntos fuertes y relacion normativa.</p>
            <button onClick={generateAnalysis} className="urban-button mt-3 inline-flex items-center gap-2 rounded-md bg-civic-blue px-3 py-2 text-xs font-black text-white"><Brain className="h-4 w-4" /> {hearing.aiSummary ? "Regenerar sintesis" : "Generar sintesis"}</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AiFindingCard
          title="Participantes"
          icon={Users}
          items={hearing.participants.map((participant) => `${participant.name} - ${participant.actorType}`)}
          empty="Sin participantes detectados."
        />
        <AiFindingCard
          title="Topicos"
          icon={MessageSquareText}
          items={[hearing.mainTopic, ...hearing.secondaryTopics]}
          empty="Sin topicos detectados."
        />
        <AiFindingCard
          title="Propuestas"
          icon={ListChecks}
          items={[hearing.relatedProposal, hearing.conclusions.nextSteps].filter(Boolean)}
          empty="Sin propuestas extraidas."
        />
        <AiFindingCard
          title="Puntos fuertes"
          icon={CheckCircle2}
          items={[hearing.conclusions.agreements, hearing.conclusions.technicalRecommendations].filter(Boolean)}
          empty="Sin puntos fuertes identificados."
        />
      </div>

      <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
        <div className="flex items-center gap-2 text-sm font-black text-cyan-100"><BookOpen className="h-4 w-4" /> Relacion con Codigo de Planeamiento Urbano</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {hearing.relatedArticles.length ? hearing.relatedArticles.map((article) => (
            <span key={article} className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.08] px-3 py-2 text-xs font-bold text-cyan-100">{article}</span>
          )) : <span className="text-sm text-slate-400">Sin articulos vinculados.</span>}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {hearing.observedTopics[0]?.technicalObservation ?? "El cruce normativo queda pendiente de completar cuando se incorpore la base estructurada del Codigo de Planeamiento."}
        </p>
      </div>

      {hearing.aiSummary ? (
        <div className="rounded-md border border-white/8 bg-white/[0.025] p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Resumen generado</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">{hearing.aiSummary}</p>
        </div>
      ) : null}
      {hearing.aiKeyPoints?.length ? (
        <div className="rounded-md border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center gap-2 text-sm font-black text-white"><ListChecks className="h-4 w-4 text-cyan-100" /> Puntos clave</div>
          <div className="mt-3 space-y-2">
            {hearing.aiKeyPoints.map((point, index) => <div key={`${point}-${index}`} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-cyan-400/10 text-xs font-black text-cyan-100">{index + 1}</span><span>{point}</span></div>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AiFindingCard({ title, icon: Icon, items, empty }: { title: string; icon: typeof Users; items: string[]; empty: string }) {
  const visibleItems = items.filter(Boolean).slice(0, 4);

  return (
    <div className="rounded-md border border-white/8 bg-white/[0.025] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-white"><Icon className="h-4 w-4 text-sky-200" /> {title}</div>
      <div className="mt-3 space-y-2">
        {visibleItems.length ? visibleItems.map((item, index) => (
          <div key={`${item}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
            <span>{item}</span>
          </div>
        )) : <p className="text-sm text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function ParticipantsTab({ hearing }: { hearing: PublicHearing }) {
  if (!hearing.participants.length) return <EmptyState icon={Users} text="Todavia no hay participantes registrados." />;

  return (
    <div className="space-y-3">
      <SectionTitle eyebrow="Registro de actores" title={`${hearing.participants.length} participantes`} />
      {hearing.participants.map((participant, index) => (
        <div key={`${participant.name}-${index}`} className="rounded-md border border-white/8 bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words font-black text-white">{participant.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{participant.institution}</p>
            </div>
            <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${participant.attended ? "bg-sky-400/15 text-sky-200" : "bg-amber-400/15 text-amber-100"}`}>
              {participant.attended ? "Asistio" : "Convocado"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-slate-300">{participant.actorType}</span>
            <span className="rounded-md bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-100">{participant.role}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">{participant.intervention}</p>
        </div>
      ))}
    </div>
  );
}

function DocumentsTab({ hearing }: { hearing: PublicHearing }) {
  if (!hearing.documents.length) return <EmptyState icon={Paperclip} text="Todavia no hay documentos asociados." />;

  return (
    <div className="space-y-3">
      <SectionTitle eyebrow="Trazabilidad documental" title={`${hearing.documents.length} documentos`} />
      {hearing.documents.map((document, index) => (
        <div key={`${document.name}-${index}`} className="flex min-w-0 items-start gap-3 rounded-md border border-white/8 bg-white/[0.025] p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cyan-400/10 text-cyan-100"><FileText className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="break-words font-black text-white">{document.name}</h3>
                <p className="mt-1 text-xs font-semibold text-cyan-100">{document.type}</p>
              </div>
              {document.url ? <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" /> : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{document.description}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(document.uploadedAt)} - Subido por {document.uploadedBy}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConclusionsTab({ hearing }: { hearing: PublicHearing }) {
  const fields = [
    ["Resumen general", hearing.conclusions.summary],
    ["Acuerdos alcanzados", hearing.conclusions.agreements],
    ["Desacuerdos detectados", hearing.conclusions.disagreements],
    ["Proximos pasos", hearing.conclusions.nextSteps],
    ["Recomendaciones tecnicas", hearing.conclusions.technicalRecommendations],
    ["Decisiones tomadas", hearing.conclusions.decisions],
    ["Estado posterior de la propuesta", hearing.conclusions.proposalStatusAfter]
  ];

  return (
    <div>
      <SectionTitle eyebrow="Memoria de cierre" title="Conclusiones" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value], index) => (
          <div key={label} className={`rounded-md border border-white/8 bg-white/[0.025] p-4 ${index === 0 ? "sm:col-span-2" : ""}`}>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObservedTopicsTab({ hearing }: { hearing: PublicHearing }) {
  if (!hearing.observedTopics.length) return <EmptyState icon={AlertTriangle} text="Todavia no hay temas observados registrados." />;

  return (
    <div className="space-y-3">
      <SectionTitle eyebrow="Cruce urbano y normativo" title={`${hearing.observedTopics.length} temas observados`} />
      {hearing.observedTopics.map((item, index) => (
        <div key={`${item.topic}-${index}`} className="rounded-md border border-white/8 bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-white">{item.topic}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
            </div>
            <span className={`rounded-md px-2.5 py-1 text-xs font-black ${importanceStyles[item.importance]}`}>{item.importance}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailBlock label="Articulo relacionado" value={item.relatedArticle} />
            <DetailBlock label="Propuesta relacionada" value={item.relatedProposal} />
            <DetailBlock label="Observacion tecnica" value={item.technicalObservation} />
            <DetailBlock label="Observacion ciudadana" value={item.citizenObservation} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HearingFormPanel({ form, onClose, onSubmit, onUpdate }: {
  form: HearingForm;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof HearingForm>(key: K, value: HearingForm[K]) => void;
}) {
  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Nueva audiencia</p>
          <h2 className="mt-2 text-2xl font-black text-white">Registro de deliberacion publica</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Completa la convocatoria, el expediente y la memoria inicial. Las conclusiones pueden actualizarse al finalizar.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="urban-button rounded-md border border-white/10 bg-white/[0.04] p-2 text-slate-300"><X className="h-4 w-4" /></button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <FormSection title="Datos generales">
          <div className="grid gap-3 lg:grid-cols-2">
            <TextInput label="Titulo de la audiencia" value={form.title} onChange={(value) => onUpdate("title", value)} required />
            <TextInput label="Tematica principal" value={form.mainTopic} onChange={(value) => onUpdate("mainTopic", value)} placeholder="Movilidad, patrimonio, uso de suelo..." required />
            <TextInput label="Fecha" type="date" value={form.date} onChange={(value) => onUpdate("date", value)} required />
            <TextInput label="Hora" type="time" value={form.time} onChange={(value) => onUpdate("time", value)} required />
            <TextInput label="Lugar" value={form.place} onChange={(value) => onUpdate("place", value)} required />
            <TextInput label="Tematicas secundarias" value={form.secondaryTopics} onChange={(value) => onUpdate("secondaryTopics", value)} placeholder="Separadas por comas" />
            <SelectInput label="Modalidad" value={form.modality} options={modalities} onChange={(value) => onUpdate("modality", value as HearingModality)} />
            <SelectInput label="Estado" value={form.status} options={statuses.slice(1)} onChange={(value) => onUpdate("status", value as HearingStatus)} />
          </div>
        </FormSection>

        <FormSection title="Expediente y normativa">
          <div className="grid gap-3 lg:grid-cols-2">
            <TextInput label="Numero de expediente" value={form.recordNumber} onChange={(value) => onUpdate("recordNumber", value)} placeholder="EXP-2026-00000" required />
            <TextInput label="Titulo del expediente" value={form.recordTitle} onChange={(value) => onUpdate("recordTitle", value)} required />
            <TextInput label="Propuesta relacionada" value={form.relatedProposal} onChange={(value) => onUpdate("relatedProposal", value)} required />
            <SelectInput label="Origen de la propuesta" value={form.proposalOrigin} options={origins} onChange={(value) => onUpdate("proposalOrigin", value as PublicHearing["proposalOrigin"])} />
            <TextInput label="Autor o area impulsora" value={form.promotingArea} onChange={(value) => onUpdate("promotingArea", value)} required />
            <TextInput label="Estado del expediente" value={form.recordStatus} onChange={(value) => onUpdate("recordStatus", value)} required />
            <TextInput label="Documento o enlace" value={form.recordDocument} onChange={(value) => onUpdate("recordDocument", value)} />
            <TextInput label="Articulos del Codigo" value={form.relatedArticles} onChange={(value) => onUpdate("relatedArticles", value)} placeholder="Articulo 12, Articulo 18" required />
          </div>
        </FormSection>

        <FormSection title="Participacion y documentos">
          <div className="grid gap-3 lg:grid-cols-2">
            <TextInput label="Participantes" value={form.participantNames} onChange={(value) => onUpdate("participantNames", value)} placeholder="Nombres separados por comas" />
            <TextInput label="Institucion" value={form.participantInstitution} onChange={(value) => onUpdate("participantInstitution", value)} />
            <TextInput label="Rol" value={form.participantRole} onChange={(value) => onUpdate("participantRole", value)} />
            <SelectInput label="Tipo de actor" value={form.participantType} options={actorTypes} onChange={(value) => onUpdate("participantType", value)} />
          </div>
          <TextArea label="Intervencion prevista o realizada" value={form.participantIntervention} onChange={(value) => onUpdate("participantIntervention", value)} />
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Documentos adjuntos</span>
            <input type="file" multiple onChange={(event) => onUpdate("documents", Array.from(event.target.files ?? []).map((file) => file.name))} className="w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-sky-400/15 file:px-3 file:py-2 file:font-bold file:text-sky-200" />
            <span className="text-xs text-slate-500">Actas, informes, fotos, planos, mapas, dictamenes, notas o transcripciones.</span>
          </label>
        </FormSection>

        <FormSection title="Conclusiones y temas observados">
          <div className="grid gap-3 lg:grid-cols-2">
            <TextArea label="Resumen general" value={form.summary} onChange={(value) => onUpdate("summary", value)} />
            <TextArea label="Acuerdos alcanzados" value={form.agreements} onChange={(value) => onUpdate("agreements", value)} />
            <TextArea label="Desacuerdos detectados" value={form.disagreements} onChange={(value) => onUpdate("disagreements", value)} />
            <TextArea label="Proximos pasos" value={form.nextSteps} onChange={(value) => onUpdate("nextSteps", value)} />
            <TextArea label="Recomendaciones tecnicas" value={form.recommendations} onChange={(value) => onUpdate("recommendations", value)} />
            <TextArea label="Decisiones tomadas" value={form.decisions} onChange={(value) => onUpdate("decisions", value)} />
            <TextInput label="Estado posterior de la propuesta" value={form.proposalStatusAfter} onChange={(value) => onUpdate("proposalStatusAfter", value)} />
            <TextInput label="Temas observados" value={form.observedTopics} onChange={(value) => onUpdate("observedTopics", value)} placeholder="Altura, densidad, accesibilidad..." />
            <SelectInput label="Importancia de los temas" value={form.topicImportance} options={["Bajo", "Medio", "Alto", "Critico"]} onChange={(value) => onUpdate("topicImportance", value as TopicImportance)} />
            <div />
            <TextArea label="Observacion tecnica" value={form.technicalObservation} onChange={(value) => onUpdate("technicalObservation", value)} />
            <TextArea label="Observacion ciudadana" value={form.citizenObservation} onChange={(value) => onUpdate("citizenObservation", value)} />
          </div>
        </FormSection>

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/8 pt-5">
          <button type="button" onClick={onClose} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">Cancelar</button>
          <button type="submit" className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white"><Plus className="h-4 w-4" /> Registrar audiencia</button>
        </div>
      </form>
    </section>
  );
}

function ActionButton({ icon: Icon, label, primary, onClick }: { icon: typeof Plus; label: string; primary?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`urban-button inline-flex w-full items-center justify-center gap-2 rounded-md px-3.5 py-2.5 text-sm font-black sm:w-auto ${primary ? "bg-civic-blue text-white" : "border border-white/10 bg-white/[0.04] text-slate-200"}`}><Icon className="h-4 w-4" />{label}</button>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CalendarDays }) {
  return <div className="urban-lift rounded-md border border-white/10 bg-slate-950/45 p-4"><Icon className="h-4 w-4 text-civic-sky" /><p className="mt-3 text-2xl font-black text-white">{value}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p></div>;
}

function StatusBadge({ status }: { status: HearingStatus }) {
  return <span className={`rounded-md border px-2.5 py-1 text-xs font-black ${statusStyles[status]}`}>{status}</span>;
}

function InlineFact({ icon: Icon, text }: { icon: typeof CalendarDays; text: string }) {
  return <span className="flex min-w-0 items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" /><span className="break-words">{text}</span></span>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">{eyebrow}</p><h3 className="mt-1 text-xl font-black text-white">{title}</h3></div>;
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 break-words text-sm leading-6 text-slate-300">{value}</p></div>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return <div className="grid min-h-52 place-items-center rounded-md border border-dashed border-white/15 p-8 text-center"><div><Icon className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 text-sm text-slate-400">{text}</p></div></div>;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="space-y-3"><legend className="mb-3 text-sm font-black text-white">{title}</legend>{children}</fieldset>;
}

function TextInput({ label, value, onChange, placeholder, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string }) {
  return <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold leading-6 text-slate-100 outline-none transition focus:border-sky-300/50" /></label>;
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-300/50">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function SelectFilter({ inputRef, label, value, options, onChange }: { inputRef?: React.RefObject<HTMLSelectElement | null>; label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5"><span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span><select ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-200 outline-none transition focus:border-sky-300/50">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(value));
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function inferDocumentType(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("acta")) return "Acta de audiencia";
  if (normalized.includes("plano")) return "Plano";
  if (normalized.includes("mapa")) return "Mapa";
  if (normalized.includes("dictamen")) return "Dictamen";
  if (normalized.includes("foto")) return "Foto";
  return "Documento adjunto";
}

function buildHearingAiAnalysis(hearing: PublicHearing) {
  const messages = hearing.debateMessages ?? [];
  const contributions = hearing.contributions ?? [];
  const actors = Array.from(new Set([
    ...hearing.participants.map((item) => item.name),
    ...messages.map((item) => item.authorName),
    ...contributions.map((item) => item.participantName)
  ]));
  const criticalTopics = hearing.observedTopics.filter((item) => item.importance === "Alto" || item.importance === "Critico");
  const sourceCount = messages.length + contributions.length;
  const articleText = hearing.relatedArticles.length ? hearing.relatedArticles.join(", ") : "sin articulos asociados";
  const summary = `La memoria de la audiencia ${hearing.recordNumber} consolida ${actors.length} participantes detectados${sourceCount ? ` y ${sourceCount} intervenciones registradas` : ""}. El intercambio se concentra en ${hearing.mainTopic.toLowerCase()} y su relacion con ${articleText}. ${hearing.conclusions.summary} La revision automatica recomienda contrastar propuestas, puntos fuertes y observaciones normativas antes de modificar el estado del expediente.`;
  const keyPoints = [
    `${actors.length} participantes identificados: ${actors.slice(0, 4).join(", ")}${actors.length > 4 ? "..." : ""}.`,
    criticalTopics.length ? `Temas prioritarios: ${criticalTopics.map((item) => item.topic).join(", ")}.` : `Tema principal: ${hearing.mainTopic}.`,
    `Propuesta vinculada: ${hearing.relatedProposal}.`,
    `Normativa vinculada: ${articleText}.`,
    `Proximo paso institucional: ${hearing.conclusions.nextSteps}`
  ];

  return { summary, keyPoints };
}

function buildHearingReport(hearing: PublicHearing) {
  const messages = hearing.debateMessages ?? [];
  const contributions = hearing.contributions ?? [];
  const lines = [
    `URBANIA - MEMORIA DE AUDIENCIA`,
    `Titulo: ${hearing.title}`,
    `Fecha: ${formatDate(hearing.date)} ${hearing.time} hs`,
    `Expediente: ${hearing.recordNumber} - ${hearing.recordTitle}`,
    `Estado: ${hearing.status}`,
    `Normativa: ${hearing.relatedArticles.join(", ") || "Sin articulos vinculados"}`,
    "",
    "RESUMEN IA",
    hearing.aiSummary || "Sin sintesis generada.",
    "",
    "PUNTOS CLAVE",
    ...(hearing.aiKeyPoints?.map((point, index) => `${index + 1}. ${point}`) ?? ["Sin puntos clave generados."]),
    "",
    "DEBATE",
    ...messages.map((item) => `- ${formatDateTime(item.createdAt)} | ${item.authorName}: ${item.content}`),
    "",
    "APORTES FORMALES",
    ...contributions.map((item) => `- ${formatDateTime(item.createdAt)} | ${item.participantName}: ${item.content}${item.fileNames.length ? ` [${item.fileNames.join(", ")}]` : ""}`),
    "",
    "CONCLUSIONES",
    `Acuerdos: ${hearing.conclusions.agreements}`,
    `Desacuerdos: ${hearing.conclusions.disagreements}`,
    `Proximos pasos: ${hearing.conclusions.nextSteps}`,
    `Decisiones: ${hearing.conclusions.decisions}`
  ];

  return lines.join("\n");
}
