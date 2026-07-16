"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, LogIn, Paperclip, UserRound } from "lucide-react";
import { MigueFloatingChat } from "@/components/assistant/migue-floating-chat";
import {
  PortalFooter,
  PortalHeader,
  activeChipClass,
  chipClass,
  eyebrowClass,
  labelClass,
  pageClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  usePortalTheme
} from "@/components/public/portal-chrome";

type ContributionKind = "Propuesta" | "Reclamo" | "Aporte";

export function ContributionForm() {
  const { isLight, toggleTheme } = usePortalTheme();
  const [contributionKind, setContributionKind] = useState<ContributionKind>("Propuesta");
  const [citizenZone, setCitizenZone] = useState("");
  const [citizenText, setCitizenText] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // "loading" evita que el bloque de "ingresa para presentar" parpadee antes de
  // saber si hay sesion.
  const [currentUser, setCurrentUser] = useState<{ name: string } | null | "loading">("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await response.json()) as { user?: { name: string } | null };
        if (isMounted) {
          setCurrentUser(data.user ?? null);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = citizenText.trim();
    const zone = citizenZone.trim();

    if (!zone || text.length < 10) {
      setSaveError("Completa barrio o zona y una descripcion de al menos 10 caracteres para guardar.");
      setSaveSuccess("");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch("/api/citizen-contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: contributionKind, zone, text, fileName: selectedFile })
      });
      const result = (await response.json().catch(() => ({}))) as { contribution?: { id: string }; error?: string };

      if (!response.ok || !result.contribution) {
        throw new Error(result.error ?? "No pudimos guardar tu aporte.");
      }

      setSaveSuccess("Guardado correctamente. Ya queda registrado para revision del equipo municipal.");
      setCitizenText("");
      setSelectedFile("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No pudimos guardar tu aporte.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="presentar" />

      <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className={eyebrowClass(isLight)}>
          <UserRound className="h-3.5 w-3.5" />
          Registro ciudadano
        </div>
        <h1 className={`mt-4 font-display text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[2.75rem] ${isLight ? "text-slate-900" : "text-white"}`}>
          Deja tu aporte para mejorar la ciudad
        </h1>
        <p className={`mt-4 max-w-2xl text-sm leading-7 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          Contanos con tus palabras que te gustaria que la ciudad regule, cambie o mejore. Tus datos salen de tu cuenta: aca solo sumas la zona y la idea.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={panelClass(isLight)}>
            {currentUser === "loading" ? (
              <div className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm ${isLight ? "border-slate-200 text-slate-400" : "border-white/10 text-slate-500"}`}>
                Verificando tu sesion...
              </div>
            ) : currentUser === null ? (
              <div className={isLight ? "rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center" : "rounded-2xl border border-sky-300/20 bg-sky-300/[0.06] p-6 text-center"}>
                <div className={isLight ? "mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-civic-blue-deep" : "mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-sky-200"}>
                  <LogIn className="h-5 w-5" />
                </div>
                <h2 className={`mt-4 font-display text-lg font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>
                  Ingresa para presentar tu aporte
                </h2>
                <p className={`mx-auto mt-2 max-w-md text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Para presentar una propuesta o un reclamo necesitas una cuenta de vecino. Se crea en un minuto y te permite seguir despues en que quedo lo que presentaste.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/ingresar?mode=register" className={primaryButtonClass()}>
                    <UserRound className="h-4 w-4" />
                    Crear cuenta de vecino
                  </Link>
                  <Link href="/ingresar" className={secondaryButtonClass(isLight)}>
                    <LogIn className="h-4 w-4" />
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                <p className={`md:col-span-2 rounded-xl px-3 py-2 text-xs font-semibold ${isLight ? "bg-slate-50 text-slate-600" : "bg-white/[0.04] text-slate-300"}`}>
                  Presentas como <span className={isLight ? "text-slate-900" : "text-white"}>{currentUser.name}</span>. Tus datos personales no se publican en el portal.
                </p>

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

                <Field
                  label="Barrio o zona"
                  placeholder="Ej: Barrio Sur, Centro"
                  value={citizenZone}
                  onChange={(event) => setCitizenZone(event.target.value)}
                  isLight={isLight}
                />

                <label className="block">
                  <span className={labelClass(isLight)}>Adjuntar documento (opcional)</span>
                  <span className={`flex h-11 items-center gap-2.5 rounded-xl border px-3.5 text-sm ${isLight ? "border-slate-200 bg-white text-slate-600" : "border-white/10 bg-[#06121f] text-slate-300"}`}>
                    <Paperclip className={isLight ? "h-4 w-4 shrink-0 text-slate-400" : "h-4 w-4 shrink-0 text-slate-500"} />
                    <input
                      type="file"
                      onChange={(event) => setSelectedFile(event.target.files?.[0]?.name ?? "")}
                      className="min-w-0 flex-1 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-civic-blue-deep file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#ffffff]"
                    />
                  </span>
                </label>

                <label className="block md:col-span-2">
                  <span className={labelClass(isLight)}>Que te gustaria que la ciudad regule, cambie o mejore?</span>
                  <textarea
                    value={citizenText}
                    onChange={(event) => setCitizenText(event.target.value)}
                    rows={6}
                    className={`w-full resize-none rounded-xl border px-3.5 py-3 text-sm leading-6 outline-none transition ${
                      isLight
                        ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-civic-blue focus:ring-2 focus:ring-civic-blue/15"
                        : "border-white/10 bg-[#06121f] text-slate-100 placeholder:text-slate-500 focus:border-sky-300/50"
                    }`}
                    placeholder="Ej: en la plaza de mi barrio los juegos estan rotos y no hay luz de noche..."
                  />
                </label>

                <div className="md:col-span-2">
                  {saveError ? (
                    <div className={isLight ? "mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" : "mb-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100"}>
                      {saveError}
                    </div>
                  ) : null}
                  {saveSuccess ? (
                    <div className={isLight ? "mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900" : "mb-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100"}>
                      {saveSuccess}
                    </div>
                  ) : null}
                  <button type="submit" disabled={isSaving} className={`${primaryButtonClass()} w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto`}>
                    <CheckCircle2 className="h-4 w-4" />
                    {isSaving ? "Guardando..." : `Guardar ${contributionKind.toLowerCase()}`}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sin clasificacion automatica: el tema lo asigna el equipo municipal al revisar. */}
          <aside className={panelClass(isLight)}>
            <div className="flex items-center gap-3">
              <div className={isLight ? "grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-civic-blue-deep" : "grid h-10 w-10 place-items-center rounded-xl bg-sky-300/10 text-sky-200"}>
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className={`font-display font-extrabold tracking-[-0.01em] ${isLight ? "text-slate-900" : "text-white"}`}>Que pasa despues</h2>
                <p className={isLight ? "text-xs text-slate-500" : "text-xs text-slate-400"}>Recorrido de tu aporte</p>
              </div>
            </div>
            <ol className="mt-5 space-y-2.5">
              <ProcessStep step="1" title="Queda registrado" detail="Se guarda con tu nombre y tu zona, y entra al sistema interno del municipio." isLight={isLight} />
              <ProcessStep step="2" title="Lo revisa el equipo" detail="Personal municipal lo lee, lo ordena por tema y lo agrupa con aportes parecidos." isLight={isLight} />
              <ProcessStep step="3" title="Pasa a evaluacion tecnica" detail="Si corresponde, se revisa la normativa aplicable y puede derivar en un proyecto." isLight={isLight} />
            </ol>
            <div className={isLight ? "mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-5 text-slate-600" : "mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400"}>
              Escribilo con tus palabras: no hace falta que uses lenguaje tecnico ni que sepas que norma aplica. De eso se encarga el equipo municipal.
            </div>
          </aside>
        </div>

        <PortalFooter isLight={isLight} />
      </div>

      <MigueFloatingChat appearance={isLight ? "light" : "dark"} />
    </main>
  );
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
      <input
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition ${
          isLight
            ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-civic-blue focus:ring-2 focus:ring-civic-blue/15"
            : "border-white/10 bg-[#06121f] text-slate-100 placeholder:text-slate-500 focus:border-sky-300/50"
        }`}
      />
    </label>
  );
}

function ProcessStep({ step, title, detail, isLight }: { step: string; title: string; detail: string; isLight: boolean }) {
  return (
    <li className={isLight ? "flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3" : "flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${isLight ? "bg-civic-blue-deep text-[#ffffff]" : "bg-sky-300/15 text-sky-100"}`}>
        {step}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{title}</span>
        <span className={`mt-1 block text-xs leading-5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>{detail}</span>
      </span>
    </li>
  );
}
