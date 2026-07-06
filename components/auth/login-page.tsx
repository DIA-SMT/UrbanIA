"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";

export function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

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

              <form action="/api/auth/register" method="post" className="mt-6 space-y-4">
                <TextField label="Nombre y apellido" name="name" type="text" placeholder="Tu nombre completo" />
                <TextField label="Correo electronico" name="email" type="email" placeholder="nombre@correo.com" />
                <TextField label="Contrasena" name="password" type="password" placeholder="Crear contrasena" />

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

function TextField({ label, name, type, placeholder }: { label: string; name: string; type: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-800">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-600"
      />
    </label>
  );
}
