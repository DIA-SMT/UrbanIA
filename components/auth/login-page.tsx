"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";

type LoginMode = "login" | "register";

type LoginPageProps = {
  initialError?: string;
  initialMode?: LoginMode;
};

const errorMessages: Record<string, string> = {
  minor: "Para presentar propuestas o reclamos tenes que ser mayor de 18 anios.",
  birthdate: "Revisa la fecha de nacimiento: no parece una fecha valida.",
  dni: "El DNI tiene que tener entre 7 y 9 numeros.",
  dni_taken: "Ese DNI ya esta registrado en otra cuenta.",
  missing: "Completa todos los campos. La contrasena debe tener al menos 6 caracteres.",
  credentials: "El correo o la contrasena no son correctos. Si tu cuenta todavia no tiene contrasena, elegi Registrarte para activarla.",
  exists: "Esta cuenta ya tiene una contrasena. Ingresa con tus credenciales.",
  unavailable: "El acceso no esta disponible por un problema de configuracion del servidor."
};

export function LoginPage({ initialError, initialMode = "login" }: LoginPageProps) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const errorMessage = initialError ? errorMessages[initialError] : null;

  return (
    <main className="min-h-screen bg-[#eff7fb] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-bold text-sky-800 transition hover:bg-sky-50">
            <ArrowLeft className="h-4 w-4" />
            Volver al portal
          </Link>

          <div className="mb-8 flex items-center gap-3">
            <Image
              src="/brand/logo-municipalidad-smt-transparent.png"
              alt="Municipalidad de San Miguel de Tucuman"
              width={48}
              height={48}
              priority
              className="h-12 w-12 object-contain"
            />
            <div>
              <p className="text-xl font-black leading-none text-slate-950">UrbanIA</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">
                {mode === "login" ? "Ingresar" : "Registro ciudadano"}
              </p>
            </div>
          </div>

          {mode === "login" ? (
            <>
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-800">
                <LockKeyhole className="h-4 w-4" />
                Ingresar
              </div>
              <h1 className="text-2xl font-black leading-tight text-slate-950">Ingresar</h1>
              {errorMessage ? <AuthErrorMessage message={errorMessage} /> : null}

              <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
                <TextField label="Correo electronico" name="email" type="email" placeholder="nombre@correo.com" />
                <TextField label="Contrasena" name="password" type="password" placeholder="Ingresar contrasena" />

                <button
                  type="submit"
                  className="urban-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0284c7] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(2,132,199,0.22)] hover:bg-[#0369a1]"
                >
                  <LogIn className="h-4 w-4" />
                  Ingresar
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-600">
                No tenes cuenta?{" "}
                <button type="button" onClick={() => setMode("register")} className="font-black text-sky-700 hover:text-sky-900">
                  Registrarte
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-800">
                <UserPlus className="h-4 w-4" />
                Registrarte
              </div>
              <h1 className="text-2xl font-black leading-tight text-slate-950">Crear cuenta</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Las cuentas nuevas se crean como usuario comun.
              </p>
              {errorMessage ? <AuthErrorMessage message={errorMessage} /> : null}

              {/* Orden: primero quien sos (identidad), despues a que te dedicas y por
                  ultimo como entras. Los datos de identidad se piden una sola vez aca,
                  asi el formulario de propuestas no vuelve a pedirlos. */}
              <form action="/api/auth/register" method="post" className="mt-6 space-y-4">
                <FieldGroup title="Tus datos">
                  <TextField label="Nombre y apellido" name="name" type="text" placeholder="Tu nombre completo" />
                  <TextField label="DNI" name="dni" type="text" placeholder="Ej: 30123456" inputMode="numeric" />
                  <TextField
                    label="Fecha de nacimiento"
                    name="birthDate"
                    type="date"
                    placeholder=""
                    hint="Para presentar propuestas o reclamos tenes que ser mayor de 18 anios."
                  />
                  <TextField
                    label="Profesion u ocupacion"
                    name="occupation"
                    type="text"
                    placeholder="Ej: docente, comerciante, jubilada, estudiante"
                  />
                </FieldGroup>

                <FieldGroup title="Datos de acceso">
                  <TextField label="Correo electronico" name="email" type="email" placeholder="nombre@correo.com" />
                  <TextField label="Contrasena" name="password" type="password" placeholder="Minimo 6 caracteres" />
                </FieldGroup>

                <button
                  type="submit"
                  className="urban-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0284c7] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(2,132,199,0.22)] hover:bg-[#0369a1]"
                >
                  <UserPlus className="h-4 w-4" />
                  Registrarte
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-600">
                Ya tenes cuenta?{" "}
                <button type="button" onClick={() => setMode("login")} className="font-black text-sky-700 hover:text-sky-900">
                  Ingresar
                </button>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function AuthErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-5 text-amber-900">
      {message}
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function TextField({
  label,
  name,
  type,
  placeholder,
  inputMode,
  hint
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  inputMode?: "numeric";
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-800">{label}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-600"
      />
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}
