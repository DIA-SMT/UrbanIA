"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  FileText,
  Landmark,
  LogIn,
  MapPin,
  Moon,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  TreePine,
  UserRound
} from "lucide-react";
import { MigueFloatingChat } from "@/components/assistant/migue-floating-chat";

type ThemeMode = "dark" | "light";
type ContributionKind = "Propuesta" | "Reclamo" | "Aporte";

type Axis = {
  label: string;
  description: string;
  tone: "sky" | "cyan" | "amber";
  icon: typeof TreePine;
};

type ParticipationAnalysis = {
  axis: string;
  confidence: string;
  summary: string;
  nextStep: string;
};

type PlanningCodeSection = {
  title: string;
  axis: Axis["label"];
  reference: string;
  summary: string;
  topics: string[];
};

type SavedContribution = {
  id: string;
  kind: ContributionKind;
  name: string;
  dni: string;
  zone: string;
  text: string;
  fileName: string;
  axis: string;
  confidence: string;
  status?: string;
  createdAt: string;
};

const urbanAxes: Axis[] = [
  {
    label: "Ambiente",
    description: "Arbolado, espacios verdes, drenaje, calor urbano y cuidado ambiental.",
    tone: "sky",
    icon: TreePine
  },
  {
    label: "Movilidad",
    description: "Transito, bicisendas, transporte, estacionamiento y seguridad vial.",
    tone: "sky",
    icon: MapPin
  },
  {
    label: "Uso del suelo",
    description: "Alturas, construcciones, habilitaciones, retiros y compatibilidad de usos.",
    tone: "cyan",
    icon: Building2
  },
  {
    label: "Espacio publico",
    description: "Veredas, plazas, iluminacion, convivencia y equipamiento barrial.",
    tone: "amber",
    icon: Landmark
  }
];

const planningCodeSections: PlanningCodeSection[] = [
  {
    title: "Usos del suelo",
    axis: "Uso del suelo",
    reference: "Distritos, compatibilidades y restricciones",
    summary: "Orienta que actividades pueden desarrollarse en cada zona y bajo que condiciones urbanas.",
    topics: ["distritos", "habilitaciones", "compatibilidad", "residencial", "comercial"]
  },
  {
    title: "Alturas y retiros",
    axis: "Uso del suelo",
    reference: "Parametros edilicios",
    summary: "Reune criterios para revisar altura maxima, retiro de frente, retiro lateral y relacion con el entorno.",
    topics: ["altura", "retiro", "edificio", "morfologia", "construccion"]
  },
  {
    title: "Movilidad y accesibilidad",
    axis: "Movilidad",
    reference: "Calles, transporte y circulacion",
    summary: "Agrupa criterios vinculados a circulacion, transporte, estacionamiento, bicisendas y accesibilidad.",
    topics: ["transito", "bicisenda", "colectivo", "estacionamiento", "calle"]
  },
  {
    title: "Ambiente urbano",
    axis: "Ambiente",
    reference: "Arbolado, drenaje y areas verdes",
    summary: "Organiza temas ambientales para revisar sombra, arbolado, plazas, drenaje urbano y mitigacion del calor.",
    topics: ["arbolado", "verde", "plaza", "calor", "drenaje"]
  },
  {
    title: "Espacio publico",
    axis: "Espacio publico",
    reference: "Veredas, plazas y convivencia",
    summary: "Permite ubicar criterios sobre veredas, equipamiento, iluminacion, ruido y uso cotidiano del espacio comun.",
    topics: ["vereda", "iluminacion", "ruido", "convivencia", "equipamiento"]
  }
];

export function CitizenPortalLanding() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [codeQuery, setCodeQuery] = useState("");
  const [activeAxis, setActiveAxis] = useState<Axis["label"] | "Todos">("Todos");
  const [contributionKind, setContributionKind] = useState<ContributionKind>("Propuesta");
  const [citizenName, setCitizenName] = useState("");
  const [citizenDni, setCitizenDni] = useState("");
  const [citizenZone, setCitizenZone] = useState("");
  const [citizenText, setCitizenText] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [analysis, setAnalysis] = useState<ParticipationAnalysis | null>(null);
  const [savedContributions, setSavedContributions] = useState<SavedContribution[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSavingContribution, setIsSavingContribution] = useState(false);

  const detectedAxis = useMemo(() => detectAxis(citizenText), [citizenText]);
  const visibleCodeSections = useMemo(() => {
    const normalizedQuery = codeQuery.trim().toLowerCase();

    return planningCodeSections.filter((section) => {
      const matchesAxis = activeAxis === "Todos" || section.axis === activeAxis;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        section.title.toLowerCase().includes(normalizedQuery) ||
        section.reference.toLowerCase().includes(normalizedQuery) ||
        section.summary.toLowerCase().includes(normalizedQuery) ||
        section.topics.some((topic) => topic.includes(normalizedQuery));

      return matchesAxis && matchesQuery;
    });
  }, [activeAxis, codeQuery]);
  const isLight = theme === "light";

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("urbania-portal-theme") === "dark" ? "dark" : "light";

    setTheme(savedTheme);
    applyTheme(savedTheme);

    let isMounted = true;

    async function loadContributions() {
      try {
        const response = await fetch("/api/citizen-contributions", { cache: "no-store" });
        const data = (await response.json()) as { contributions?: SavedContribution[] };

        if (isMounted && response.ok) {
          setSavedContributions(data.contributions ?? []);
        }
      } catch {
        if (isMounted) {
          setSavedContributions([]);
        }
      }
    }

    loadContributions();

    return () => {
      isMounted = false;
      document.documentElement.classList.remove("urban-light");
      document.documentElement.style.colorScheme = "light";
    };
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("urbania-portal-theme", nextTheme);
    applyTheme(nextTheme);
  }

  async function handleParticipationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = citizenText.trim();
    const name = citizenName.trim();
    const dni = citizenDni.trim();
    const zone = citizenZone.trim();
    const confidence = text.length > 80 ? "Alta" : "Media";
    const nextAnalysis = {
      axis: detectedAxis.label,
      confidence,
      summary:
        text.length > 0
          ? `El aporte se vincula principalmente con ${detectedAxis.label.toLowerCase()} y puede ordenarse como insumo ciudadano para revisar criterios urbanos.`
          : "Completando la propuesta, UrbanIA puede vincular el aporte con un eje del Codigo de Planeamiento.",
      nextStep: "Agrupar con aportes similares, revisar normativa aplicable y derivar a evaluacion tecnica."
    };

    setAnalysis(nextAnalysis);

    if (!name || !dni || !zone || text.length < 10) {
      setSaveError("Completa nombre, DNI, barrio o zona y una descripcion de al menos 10 caracteres para guardar.");
      setSaveSuccess("");
      return;
    }

    setIsSavingContribution(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch("/api/citizen-contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: contributionKind,
          name,
          dni,
          zone,
          text,
          fileName: selectedFile,
          axis: detectedAxis.label,
          confidence
        })
      });
      const result = (await response.json().catch(() => ({}))) as {
        contribution?: SavedContribution;
        error?: string;
      };

      if (!response.ok || !result.contribution) {
        throw new Error(result.error ?? "No pudimos guardar el aporte ciudadano.");
      }

      const savedContribution = result.contribution;
      setSavedContributions((current) => [savedContribution, ...current]);
      setSaveSuccess("Guardado correctamente. Ya queda disponible para revision interna.");
      setCitizenText("");
      setSelectedFile("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No pudimos guardar el aporte ciudadano.");
    } finally {
      setIsSavingContribution(false);
    }
  }

  return (
    <main
      className={
        isLight
          ? "min-h-screen bg-[#eff7fb] text-slate-950"
          : "min-h-screen bg-[#06121f] text-slate-100"
      }
    >
      <header className={`sticky top-0 z-20 border-b backdrop-blur ${isLight ? "border-slate-200 bg-white/90" : "border-white/10 bg-[#06121f]/90"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/brand/logo-municipalidad-smt-transparent.png"
              alt="Municipalidad de San Miguel de Tucuman"
              width={44}
              height={44}
              priority
              className="h-11 w-11 object-contain"
            />
            <div className="min-w-0">
              <p className={isLight ? "text-lg font-black leading-none text-slate-950" : "text-lg font-black leading-none text-white"}>UrbanIA</p>
              <p className={isLight ? "mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-700" : "mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-200/80"}>
                Portal ciudadano
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <a href="#top" className={navLinkClass(isLight)}>Inicio</a>
            <a href="#consulta" className={navLinkClass(isLight)}>Codigo</a>
            <a href="#participacion" className={navLinkClass(isLight)}>Participacion</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={toggleTheme}
              className={controlClass(isLight)}
              aria-label={isLight ? "Activar modo oscuro" : "Activar modo claro"}
              title={isLight ? "Modo oscuro" : "Modo claro"}
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link href="/ingresar" className={`${controlClass(isLight)} gap-2 px-3 text-sm font-black`}>
              <LogIn className="h-4 w-4" />
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 md:py-8">
        <section className={`overflow-hidden rounded-xl border ${isLight ? "border-slate-200 bg-white shadow-[0_18px_46px_rgba(15,23,42,0.08)]" : "border-white/10 bg-slate-950/55 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"}`}>
          <div className="grid gap-8 p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_390px]">
            <div>
              <div className={eyebrowClass(isLight, "sky")}>
                <Landmark className="h-4 w-4" />
                Municipalidad de San Miguel de Tucuman
              </div>
              <h1 className={isLight ? "mt-5 max-w-4xl text-3xl font-black leading-tight text-slate-950 md:text-5xl" : "mt-5 max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl"}>
                Visualizador del Codigo de Planeamiento Urbano
              </h1>
              <p className={isLight ? "mt-4 max-w-3xl text-sm leading-7 text-slate-700 md:text-base" : "mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base"}>
                Consulta dinamica de normativa, ejes urbanos y aportes ciudadanos vinculados al funcionamiento de la ciudad.
              </p>
              <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                <a href="#consulta" className={primaryButtonClass()}>
                  <Search className="h-4 w-4" />
                  Explorar codigo
                </a>
                <a href="#participacion" className={secondaryButtonClass(isLight)}>
                  <UserRound className="h-4 w-4" />
                  Participar
                </a>
              </div>
            </div>

            <div className={heroStatsClass(isLight)}>
              <p className={isLight ? "text-xs font-black uppercase tracking-[0.18em] text-sky-700" : "text-xs font-black uppercase tracking-[0.18em] text-sky-200"}>
                San Miguel de Tucuman
              </p>
              <div className="mt-5 grid gap-3">
                <SignalCard label="Cobertura" value="Toda la ciudad" isLight={isLight} icon={MapPin} />
                <SignalCard label="Normativa" value="Codigo urbano" isLight={isLight} icon={BookOpenCheck} />
                <SignalCard label="Secciones" value="5 categorias" isLight={isLight} icon={FileText} />
                <SignalCard label="Lectura" value="4 ejes urbanos" isLight={isLight} icon={Sparkles} />
              </div>
            </div>
          </div>
        </section>

        <section id="consulta" className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className={panelClass(isLight)}>
            <div className="mb-5">
              <div className={eyebrowClass(isLight, "sky")}>
                <BookOpenCheck className="h-4 w-4" />
                Archivo digital
              </div>
              <h2 className={sectionTitleClass(isLight)}>Biblioteca del Codigo de Planeamiento</h2>
              <p className={bodyTextClass(isLight)}>
                Normativa urbana organizada por categorias para ubicar rapidamente temas de uso del suelo, ambiente, movilidad y espacio publico.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className={labelClass(isLight)}>Buscar dentro del codigo</span>
                <span className={searchWrapClass(isLight)}>
                  <Search className={isLight ? "h-4 w-4 text-slate-500" : "h-4 w-4 text-slate-400"} />
                  <input
                    value={codeQuery}
                    onChange={(event) => setCodeQuery(event.target.value)}
                    placeholder="Buscar por altura, arbolado, movilidad, veredas..."
                    className={searchInputClass(isLight)}
                  />
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                {(["Todos", ...urbanAxes.map((axis) => axis.label)] as Array<Axis["label"] | "Todos">).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveAxis(item)}
                    className={activeAxis === item ? activeChipClass(isLight) : chipClass(isLight)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {visibleCodeSections.map((section) => {
                  const axis = urbanAxes.find((item) => item.label === section.axis) ?? urbanAxes[0];

                  return (
                    <article key={section.title} className={codeSectionCardClass(isLight)}>
                      <div className={`mb-3 inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-black ${axisToneClass(axis.tone, isLight)}`}>
                        <axis.icon className="h-4 w-4" />
                        {section.axis}
                      </div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={statusPillClass(isLight)}>Normativa</span>
                        <span className={availablePillClass(isLight)}>Disponible</span>
                      </div>
                      <h3 className={isLight ? "text-lg font-black leading-tight text-slate-950" : "text-lg font-black leading-tight text-white"}>
                        {section.title}
                      </h3>
                      <p className={isLight ? "mt-1 text-xs font-bold text-slate-500" : "mt-1 text-xs font-bold text-slate-400"}>{section.reference}</p>
                      <p className={isLight ? "mt-3 text-sm leading-6 text-slate-700" : "mt-3 text-sm leading-6 text-slate-300"}>{section.summary}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {section.topics.slice(0, 3).map((topic) => (
                          <span key={topic} className={topicPillClass(isLight)}>{topic}</span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className={panelClass(isLight)}>
            <div className={isLight ? "mb-4 grid h-11 w-11 place-items-center rounded-md bg-sky-100 text-sky-800" : "mb-4 grid h-11 w-11 place-items-center rounded-md bg-sky-300/15 text-sky-100"}>
              <ShieldCheck className="h-5 w-5" />
            </div>
              <h2 className={isLight ? "text-lg font-black text-slate-950" : "text-lg font-black text-white"}>Proxima etapa</h2>
              <p className={bodyTextClass(isLight)}>
              Migue se integrara para responder preguntas directas sobre el codigo y vincular las respuestas con articulos, documentos y criterios tecnicos.
            </p>
            <div className="mt-5 space-y-3">
              {urbanAxes.map((axis) => (
                <div key={axis.label} className={`rounded-md border p-3 ${axisToneClass(axis.tone, isLight)}`}>
                  <div className="flex items-center gap-2">
                    <axis.icon className="h-4 w-4" />
                    <p className="text-sm font-black">{axis.label}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 opacity-85">{axis.description}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section id="participacion" className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className={panelClass(isLight)}>
            <div className="mb-5">
              <div className={eyebrowClass(isLight, "sky")}>
                <UserRound className="h-4 w-4" />
                Registro ciudadano
              </div>
              <h2 className={sectionTitleClass(isLight)}>Deja tu aporte para mejorar la ciudad</h2>
              <p className={bodyTextClass(isLight)}>
                Registramos datos basicos, documento adjunto y la idea que queres proponer para relacionarla con los ejes del codigo urbano.
              </p>
            </div>

            <form onSubmit={handleParticipationSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className={labelClass(isLight)}>Tipo de registro</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["Propuesta", "Reclamo", "Aporte"] as ContributionKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setContributionKind(kind)}
                      className={contributionKind === kind ? activeChipClass(isLight) : chipClass(isLight)}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Nombre y apellido" placeholder="Ej: Maria Gomez" value={citizenName} onChange={(event) => setCitizenName(event.target.value)} isLight={isLight} />
              <Field label="DNI" placeholder="Ej: 30123456" inputMode="numeric" value={citizenDni} onChange={(event) => setCitizenDni(event.target.value)} isLight={isLight} />
              <Field label="Barrio o zona" placeholder="Ej: Barrio Sur, Centro" value={citizenZone} onChange={(event) => setCitizenZone(event.target.value)} isLight={isLight} />
              <label className="block">
                <span className={labelClass(isLight)}>Adjuntar DNI o documento</span>
                <span className={fileInputWrapClass(isLight)}>
                  <Paperclip className={isLight ? "h-4 w-4 text-slate-500" : "h-4 w-4 text-slate-400"} />
                  <input
                    type="file"
                    onChange={(event) => setSelectedFile(event.target.files?.[0]?.name ?? "")}
                    className="min-w-0 flex-1 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#0284c7] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                  />
                </span>
                {selectedFile && <span className={isLight ? "mt-2 block text-xs text-sky-700" : "mt-2 block text-xs text-sky-200"}>Archivo seleccionado: {selectedFile}</span>}
              </label>

              <label className="block md:col-span-2">
                <span className={labelClass(isLight)}>Que te gustaria que la ciudad regule, cambie o mejore?</span>
                <textarea
                  value={citizenText}
                  onChange={(event) => setCitizenText(event.target.value)}
                  rows={5}
                  className={textareaClass(isLight)}
                  placeholder="Ej: mas arbolado y sombra en avenidas con mucho calor, mejorar veredas, ordenar estacionamiento..."
                />
              </label>

              <div className="md:col-span-2">
                <div className={`mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${axisToneClass(detectedAxis.tone, isLight)}`}>
                  <detectedAxis.icon className="h-4 w-4" />
                  Eje detectado: {detectedAxis.label}
                </div>
                {saveError ? (
                  <div className={isLight ? "mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900" : "mb-4 rounded-md border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100"}>
                    {saveError}
                  </div>
                ) : null}
                {saveSuccess ? (
                  <div className={isLight ? "mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900" : "mb-4 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100"}>
                    {saveSuccess}
                  </div>
                ) : null}
                <button type="submit" disabled={isSavingContribution} className={`${primaryButtonClass()} w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto`}>
                  <CheckCircle2 className="h-4 w-4" />
                  {isSavingContribution ? "Guardando..." : `Guardar ${contributionKind.toLowerCase()}`}
                </button>
              </div>
            </form>
          </div>

          <aside className={panelClass(isLight)}>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-sky-300/15 text-sky-100">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className={isLight ? "font-black text-slate-950" : "font-black text-white"}>Clasificacion IA</h2>
                <p className={isLight ? "text-xs text-slate-500" : "text-xs text-slate-400"}>Vista previa del aporte</p>
              </div>
            </div>
            {analysis ? (
              <div className="space-y-3">
                <ResultItem label="Eje urbano" value={analysis.axis} isLight={isLight} />
                <ResultItem label="Confianza" value={analysis.confidence} isLight={isLight} />
                <ResultItem label="Resumen" value={analysis.summary} isLight={isLight} />
                <ResultItem label="Siguiente paso" value={analysis.nextStep} isLight={isLight} />
              </div>
            ) : (
              <p className={bodyTextClass(isLight)}>
                Al analizar el aporte, UrbanIA sugiere un eje urbano para ordenar la participacion antes de la revision tecnica.
              </p>
            )}
            <div className={isLight ? "mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600" : "mt-5 rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400"}>
              Las cuentas nuevas de vecinos se crean como usuario comun. El rol administrativo lo asigna el equipo municipal.
            </div>
          </aside>
        </section>

        <section className={panelClass(isLight) + " mt-5"}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className={eyebrowClass(isLight, "sky")}>
                <FileText className="h-4 w-4" />
                Aportes guardados
              </div>
              <h2 className={sectionTitleClass(isLight)}>Registro enviado al sistema interno</h2>
              <p className={bodyTextClass(isLight)}>
                Estos registros se guardan en la base de datos y quedan visibles para revision dentro del modulo de propuestas.
              </p>
            </div>
            <span className={statusPillClass(isLight)}>{savedContributions.length} guardados</span>
          </div>

          {savedContributions.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {savedContributions.map((contribution) => (
                <article key={contribution.id} className={codeSectionCardClass(isLight)}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={statusPillClass(isLight)}>{contribution.kind}</span>
                    <span className={availablePillClass(isLight)}>{contribution.axis}</span>
                    <span className={topicPillClass(isLight)}>{formatContributionDate(contribution.createdAt)}</span>
                  </div>
                  <h3 className={isLight ? "text-lg font-black leading-tight text-slate-950" : "text-lg font-black leading-tight text-white"}>
                    {contribution.zone}
                  </h3>
                  <p className={isLight ? "mt-1 text-xs font-bold text-slate-500" : "mt-1 text-xs font-bold text-slate-400"}>
                    {contribution.name} - DNI {contribution.dni}
                  </p>
                  <p className={isLight ? "mt-3 text-sm leading-6 text-slate-700" : "mt-3 text-sm leading-6 text-slate-300"}>
                    {contribution.text}
                  </p>
                  {contribution.fileName ? (
                    <p className={isLight ? "mt-3 text-xs font-bold text-sky-700" : "mt-3 text-xs font-bold text-sky-200"}>
                      Archivo adjunto: {contribution.fileName}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className={isLight ? "rounded-md border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600" : "rounded-md border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300"}>
              Todavia no hay aportes guardados. Completa el formulario de participacion y presiona guardar.
            </div>
          )}
        </section>
      </div>
      <MigueFloatingChat appearance={isLight ? "light" : "dark"} />
    </main>
  );
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("urban-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

function Field({
  label,
  placeholder,
  inputMode,
  value,
  onChange,
  isLight
}: {
  label: string;
  placeholder: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange: InputHTMLAttributes<HTMLInputElement>["onChange"];
  isLight: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass(isLight)}>{label}</span>
      <input inputMode={inputMode} placeholder={placeholder} value={value} onChange={onChange} className={inputClass(isLight)} />
    </label>
  );
}

function formatContributionDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function SignalCard({ label, value, isLight, icon: Icon }: { label: string; value: string; isLight: boolean; icon: typeof Search }) {
  return (
    <div className={isLight ? "rounded-md border border-slate-200 bg-slate-50 p-4" : "rounded-md border border-white/10 bg-slate-900/70 p-4"}>
      <Icon className={isLight ? "mb-3 h-5 w-5 text-sky-700" : "mb-3 h-5 w-5 text-sky-200"} />
      <p className={isLight ? "text-xs font-black uppercase tracking-[0.14em] text-slate-500" : "text-xs font-black uppercase tracking-[0.14em] text-slate-500"}>{label}</p>
      <p className={isLight ? "mt-2 text-xl font-black leading-tight text-slate-950" : "mt-2 text-xl font-black leading-tight text-white"}>{value}</p>
    </div>
  );
}

function ResultItem({ label, value, isLight }: { label: string; value: string; isLight: boolean }) {
  return (
    <div className={isLight ? "rounded-md border border-slate-200 bg-slate-50 p-3" : "rounded-md border border-white/10 bg-white/[0.03] p-3"}>
      <p className={isLight ? "text-xs font-black uppercase tracking-[0.14em] text-slate-500" : "text-xs font-black uppercase tracking-[0.14em] text-slate-500"}>{label}</p>
      <p className={isLight ? "mt-2 text-sm leading-6 text-slate-700" : "mt-2 text-sm leading-6 text-slate-200"}>{value}</p>
    </div>
  );
}

function detectAxis(text: string) {
  const normalized = text.toLowerCase();
  const keywords: Record<string, string[]> = {
    Ambiente: ["arbol", "arbolado", "verde", "plaza", "calor", "ambiente", "basura", "drenaje", "sombra"],
    Movilidad: ["transito", "colectivo", "bicisenda", "auto", "estacionamiento", "movilidad", "calle", "circulacion"],
    "Uso del suelo": ["altura", "edificio", "retiro", "habilitacion", "comercio", "construccion", "suelo", "zona"],
    "Espacio publico": ["vereda", "banco", "iluminacion", "seguridad", "ruido", "convivencia", "espacio", "plaza"]
  };

  return [...urbanAxes]
    .map((axis) => ({
      axis,
      score: (keywords[axis.label] ?? []).filter((keyword) => normalized.includes(keyword)).length
    }))
    .sort((a, b) => b.score - a.score)[0].axis;
}

function controlClass(isLight: boolean) {
  return `urban-button inline-flex h-10 items-center justify-center rounded-md border ${
    isLight ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50" : "border-white/10 bg-slate-950/65 text-slate-100 hover:bg-white/[0.06]"
  }`;
}

function panelClass(isLight: boolean) {
  return `rounded-xl border p-5 transition duration-200 md:p-6 ${
    isLight ? "border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.07)]" : "border-white/10 bg-slate-950/55 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
  }`;
}

function sectionTitleClass(isLight: boolean) {
  return isLight ? "mt-3 text-2xl font-black leading-tight text-slate-950 md:text-3xl" : "mt-3 text-2xl font-black leading-tight text-white md:text-3xl";
}

function bodyTextClass(isLight: boolean) {
  return isLight ? "mt-2 text-sm leading-6 text-slate-700" : "mt-2 text-sm leading-6 text-slate-400";
}

function labelClass(isLight: boolean) {
  return isLight ? "mb-2 block text-sm font-bold text-slate-800" : "mb-2 block text-sm font-bold text-slate-200";
}

function inputClass(isLight: boolean) {
  return `h-12 w-full rounded-md border px-4 text-sm outline-none transition ${
    isLight
      ? "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-sky-600"
      : "border-white/10 bg-slate-950/75 text-slate-100 placeholder:text-slate-500 focus:border-sky-300/50"
  }`;
}

function textareaClass(isLight: boolean) {
  return `w-full resize-none rounded-md border px-4 py-3 text-sm leading-6 outline-none transition ${
    isLight
      ? "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-sky-600"
      : "border-white/10 bg-slate-950/75 text-slate-100 placeholder:text-slate-500 focus:border-sky-300/50"
  }`;
}

function fileInputWrapClass(isLight: boolean) {
  return `flex min-h-12 items-center gap-3 rounded-md border px-4 text-sm ${
    isLight ? "border-slate-200 bg-white text-slate-700" : "border-white/10 bg-slate-950/75 text-slate-300"
  }`;
}

function chipClass(isLight: boolean) {
  return `urban-button rounded-md border px-3 py-2 text-left text-xs font-semibold leading-5 ${
    isLight ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white" : "border-white/10 bg-white/[0.04] text-slate-300"
  }`;
}

function activeChipClass(isLight: boolean) {
  return `urban-button rounded-md border px-3 py-2 text-left text-xs font-black leading-5 ${
    isLight ? "border-sky-200 bg-sky-50 text-sky-900" : "border-sky-300/25 bg-sky-300/10 text-sky-100"
  }`;
}

function searchWrapClass(isLight: boolean) {
  return `flex h-12 items-center gap-3 rounded-md border px-4 ${
    isLight ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950/75"
  }`;
}

function searchInputClass(isLight: boolean) {
  return `min-w-0 flex-1 bg-transparent text-sm outline-none ${
    isLight ? "text-slate-950 placeholder:text-slate-400" : "text-slate-100 placeholder:text-slate-500"
  }`;
}

function codeSectionCardClass(isLight: boolean) {
  return `group rounded-xl border p-4 transition duration-200 ${
    isLight ? "border-slate-200 bg-white hover:border-sky-200 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]" : "border-white/10 bg-white/[0.03] hover:border-sky-300/30 hover:bg-white/[0.05]"
  }`;
}

function topicPillClass(isLight: boolean) {
  return `rounded-md px-2.5 py-1 text-xs font-bold ${
    isLight ? "bg-[#eff7fb] text-slate-600 ring-1 ring-slate-200" : "bg-slate-900/80 text-slate-300 ring-1 ring-white/10"
  }`;
}

function secondaryButtonClass(isLight: boolean) {
  return `urban-button inline-flex h-12 items-center justify-center gap-2 rounded-md border px-5 text-sm font-bold ${
    isLight ? "border-slate-200 bg-white text-slate-800" : "border-white/10 bg-white/[0.05] text-slate-100"
  }`;
}

function primaryButtonClass() {
  return "urban-button inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#0284c7] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(2,132,199,0.22)] transition hover:bg-[#0369a1]";
}

function navLinkClass(isLight: boolean) {
  return `rounded-md px-3 py-2 text-sm font-bold transition ${
    isLight ? "text-slate-600 hover:bg-sky-50 hover:text-sky-800" : "text-slate-300 hover:bg-white/[0.06] hover:text-sky-100"
  }`;
}

function heroStatsClass(isLight: boolean) {
  return `rounded-xl border p-4 ${
    isLight ? "border-sky-100 bg-[#e8f5fc]" : "border-sky-300/15 bg-sky-300/[0.06]"
  }`;
}

function statusPillClass(isLight: boolean) {
  return `rounded-md px-2.5 py-1 text-xs font-bold ${
    isLight ? "bg-[#e8f5fc] text-sky-800" : "bg-sky-300/10 text-sky-100"
  }`;
}

function availablePillClass(isLight: boolean) {
  return `rounded-md px-2.5 py-1 text-xs font-bold ${
    isLight ? "bg-white text-slate-600 ring-1 ring-slate-200" : "bg-slate-900/70 text-slate-300 ring-1 ring-white/10"
  }`;
}

function axisToneClass(tone: Axis["tone"], isLight: boolean) {
  const lightTones = {
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-900",
    amber: "border-amber-200 bg-amber-50 text-amber-950"
  };
  const darkTones = {
    sky: "border-sky-300/25 bg-sky-300/10 text-sky-100",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100"
  };

  return isLight ? lightTones[tone] : darkTones[tone];
}

function eyebrowClass(isLight: boolean, tone: "sky" | "cyan") {
  const lightTone = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800"
  }[tone];
  const darkTone = {
    sky: "border-sky-300/20 bg-sky-300/10 text-sky-200",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
  }[tone];

  return `inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${isLight ? lightTone : darkTone}`;
}
