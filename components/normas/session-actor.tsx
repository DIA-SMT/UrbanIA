"use client";

import { createContext, useContext } from "react";
import { UserCircle2 } from "lucide-react";

/**
 * Quien esta trabajando: la cuenta con la que se inicio sesion, y nada mas.
 *
 * Antes esto era un selector: la persona elegia su nombre de una lista y quedaba
 * en sessionStorage. Existia porque las direcciones compartian una cuenta
 * institucional y el voto se contaba por nombre declarado, asi que el sistema no
 * tenia otra forma de saber quien estaba adentro. Con Cidituc como unico acceso
 * cada persona entra con su propia cuenta, y declarar el nombre paso a ser al
 * mismo tiempo redundante y falsificable.
 *
 * Va por contexto y no por fetch: SupportControls se monta una vez por card del
 * tablero, y un fetch por card serian quince pedidos a /api/auth para averiguar
 * lo mismo. La pagina ya resuelve la sesion en el servidor, asi que el dato baja
 * como prop y se comparte desde aca.
 */

export type SessionActor = {
  userId: string;
  /** Nombre de la cuenta, tal como queda sellado en el voto o la devolucion. */
  name: string;
};

const ActorContext = createContext<SessionActor | null>(null);

export function SessionActorProvider({ actor, children }: { actor: SessionActor | null; children: React.ReactNode }) {
  return <ActorContext.Provider value={actor}>{children}</ActorContext.Provider>;
}

/**
 * null cuando la pantalla se monta sin sesion resuelta. Los componentes que votan
 * o firman lo tratan como "no puede actuar", igual que antes hacian con el nombre
 * sin elegir.
 */
export function useSessionActor(): SessionActor | null {
  return useContext(ActorContext);
}

/**
 * Con quien estas actuando. Es informativo y no se puede cambiar desde aca: para
 * actuar como otra persona hay que cerrar sesion y entrar con la otra cuenta.
 */
export function SessionActorBar() {
  const actor = useSessionActor();
  if (!actor) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
        <UserCircle2 className="h-4 w-4 text-[#1f89f6]" />
        Trabajás como
      </span>
      <span className="text-sm font-bold text-slate-100">{actor.name}</span>
      <span className="text-[11px] leading-5 text-slate-500">
        Tus votos y devoluciones quedan firmados con esta cuenta.
      </span>
    </div>
  );
}
