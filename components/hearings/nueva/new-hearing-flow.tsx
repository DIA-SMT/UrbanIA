"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HearingForm } from "@/components/hearings/nueva/hearing-form";
import type { ReformOption } from "@/lib/hearings/shared";

/**
 * Flujo de nueva audiencia: ficha (paso 1) -> sesion en vivo. Al crear la ficha
 * se navega a /audiencias/[id]/en-vivo, que es direccionable: si el operador
 * sale, puede retomar la audiencia desde su detalle.
 */
export function NewHearingFlow({
  reforms,
  dbAvailable
}: {
  reforms: ReformOption[];
  dbAvailable: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Link href="/audiencias" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Audiencias públicas
      </Link>
      <HearingForm
        reforms={reforms}
        dbAvailable={dbAvailable}
        onCreated={(meeting) => router.push(`/audiencias/${meeting.id}/en-vivo`)}
      />
    </div>
  );
}
