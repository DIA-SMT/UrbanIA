import type { LucideIcon } from "lucide-react";
import { BookOpen, CalendarDays, MessageCircle, Send, UserRound } from "lucide-react";

/**
 * Contenido PUBLICO del centro de ayuda (/ayuda): lo que puede hacer un vecino.
 * SOLO texto y datos; la presentacion vive en tool-guide-card.
 *
 * El manual del equipo municipal NO vive aca: esta en staff-help-content.ts y
 * solo lo importa /admin/ayuda, para que nunca viaje en el bundle del portal.
 *
 * Regla de oro: cada paso describe lo que la app HACE HOY, verificado contra el
 * codigo. En particular: las audiencias en vivo se GRABAN y se transcriben
 * despues con "Analizar audio" (el dictado en vivo se elimino), /consulta-cpu
 * exige rol municipal (el asistente del vecino es la burbuja de Migue), y
 * /admin es el mapa territorial, no un panel de administracion.
 */

export type ToolGuide = {
  icon: LucideIcon;
  name: string;
  /** Ruta real de la herramienta. Null si no tiene pagina propia (ej: burbuja de Migue). */
  href: string | null;
  ctaLabel?: string;
  oneLiner: string;
  /** Aviso de acceso, si la herramienta lo requiere. */
  access?: { tone: "info" | "warn"; label: string };
  paraQue: string;
  pasos: string[];
  tips?: string[];
};

/* ------------------------------- Vecinos ---------------------------------- */

export const citizenTools: ToolGuide[] = [
  {
    icon: BookOpen,
    name: "Código de Planeamiento",
    href: "/codigo",
    oneLiner: "El Código de Planeamiento Urbano completo, capítulo por capítulo.",
    paraQue:
      "Acá está el texto oficial de la ordenanza que regula qué se puede construir y cómo se usa el suelo en San Miguel de Tucumán. Podés leerlo cuando quieras, sin crear ninguna cuenta.",
    pasos: [
      "Entrá a la sección Código desde el portal.",
      "Elegí un capítulo para ver los artículos que contiene.",
      "Tocá un artículo para abrir su texto completo.",
      "Si buscás un tema puntual (alturas, usos, retiros), recorré los títulos de los capítulos: están organizados por materia."
    ],
    tips: [
      "Si no sabés en qué artículo está lo que buscás, preguntale a Migue (la burbuja celeste): te responde citando los artículos que aplican."
    ]
  },
  {
    icon: MessageCircle,
    name: "Migue, el asistente de la ciudad",
    href: null,
    oneLiner: "La burbuja de chat que te acompaña en todo el portal.",
    paraQue:
      "Migue es la inteligencia artificial de UrbanIA. Le podés preguntar en tus palabras qué dice el Código sobre un tema y te responde citando las fuentes, para que puedas verificar de dónde sale cada dato.",
    pasos: [
      "Tocá la burbuja de Migue (está en la esquina de la pantalla, en todo el portal).",
      "Escribí tu consulta con datos concretos: el barrio o la calle, y qué querés hacer o saber. «¿Puedo abrir un local de comida en Barrio Sur?» funciona mejor que «¿qué dice el código?».",
      "Leé la respuesta y revisá las fuentes citadas: cada afirmación importante viene con su artículo.",
      "Podés repreguntar en la misma conversación: Migue recuerda el hilo."
    ],
    tips: [
      "Migue orienta, no reemplaza un trámite ni un asesoramiento profesional: para gestiones oficiales, acercate a la Municipalidad.",
      "Si una respuesta no cita fuentes, tomala con más cautela y repreguntá."
    ]
  },
  {
    icon: Send,
    name: "Presentar propuesta o reclamo",
    href: "/presentar",
    oneLiner: "El formulario para que tu idea o tu reclamo entren al sistema municipal.",
    access: { tone: "info", label: "Requiere cuenta ciudadana (se crea gratis en Ingresar)" },
    paraQue:
      "Lo que cargás acá no se pierde en un mail: queda registrado con tu nombre y tu zona, entra al sistema interno del municipio y el equipo lo revisa. Es la vía para pedir que la ciudad regule, cambie o mejore algo.",
    pasos: [
      "Si todavía no tenés cuenta, creala en Ingresar con tu DNI y un correo. Es un solo paso.",
      "Entrá a Presentar y elegí el tipo de registro: propuesta, reclamo o aporte.",
      "Indicá tu barrio o zona.",
      "Contá con tus palabras qué te gustaría que la ciudad regule, cambie o mejore. Cuanto más concreto, mejor lo puede evaluar el equipo.",
      "Si tenés un documento que respalde el pedido (fotos, notas, planos), adjuntalo. Es opcional.",
      "Enviá. Tu aporte queda registrado y el equipo municipal lo ve en su bandeja de trabajo."
    ],
    tips: [
      "Tus datos de contacto salen de tu cuenta: si el equipo necesita más información, te escribe por ahí.",
      "Un reclamo por cuadra con dirección exacta avanza más rápido que uno general."
    ]
  },
  {
    icon: CalendarDays,
    name: "Audiencias públicas",
    href: "/audiencias",
    ctaLabel: "Ver el registro",
    oneLiner: "El registro público de las audiencias sobre el nuevo Código.",
    paraQue:
      "Cada audiencia pública queda registrada acá: cuándo fue, de qué se habló, el acta con la transcripción y las conclusiones. Es la memoria pública del debate sobre las normas de la ciudad.",
    pasos: [
      "Entrá a Audiencias y recorré el registro: cada tarjeta es una audiencia con su fecha y su estado.",
      "Abrí una audiencia para ver su detalle: el resumen, los temas tratados y los participantes.",
      "En el acta vas a encontrar la transcripción del debate y los cruces con las normas del código nuevo que se estaba discutiendo."
    ]
  },
  {
    icon: UserRound,
    name: "Tu cuenta ciudadana",
    href: "/ingresar",
    ctaLabel: "Ingresar con Cidituc",
    oneLiner: "Tu identidad municipal para participar con nombre y apellido.",
    paraQue:
      "La cuenta ciudadana sirve para presentar propuestas y reclamos. Que cada aporte tenga un vecino real detrás es lo que le da peso frente al equipo municipal.",
    pasos: [
      "Entrá a Ingresar y seleccioná «Ingresar con Cidituc».",
      "Identificate con tu cuenta de Ciudad Digital; UrbanIA no recibe tu contraseña.",
      "En el primer acceso tu cuenta ciudadana se crea automáticamente y ya podés participar."
    ]
  }
];
