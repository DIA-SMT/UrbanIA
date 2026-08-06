import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  KeyRound,
  Map,
  MessageCircle,
  MessagesSquare,
  Scale,
  Send,
  UserRound,
  Users
} from "lucide-react";

/**
 * Contenido del centro de ayuda (/ayuda). SOLO texto y datos: la presentacion
 * vive en tool-guide-card y help-center.
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
    ctaLabel: "Crear cuenta o ingresar",
    oneLiner: "Una cuenta gratuita con tu DNI para participar con nombre y apellido.",
    paraQue:
      "La cuenta ciudadana sirve para presentar propuestas y reclamos. Que cada aporte tenga un vecino real detrás es lo que le da peso frente al equipo municipal.",
    pasos: [
      "Entrá a Ingresar y elegí «Registrarte».",
      "Completá tus datos (nombre, DNI, correo) y elegí una contraseña.",
      "Listo: ya podés presentar propuestas y reclamos con tu cuenta."
    ]
  }
];

/* --------------------------- Equipo municipal ------------------------------ */

export const staffTools: ToolGuide[] = [
  {
    icon: KeyRound,
    name: "Ingresar con la cuenta municipal",
    href: "/ingresar",
    oneLiner: "La sesión que habilita las herramientas de gestión.",
    paraQue:
      "Las herramientas internas exigen sesión con rol municipal. Los roles son tres: Administración (gestiona todo, incluidas las cuentas), Usuario CPU (crea y edita contenido) y Observador/a (ve el sistema interno en solo lectura). Sin sesión, la plataforma muestra solo la cara pública.",
    pasos: [
      "Entrá a Ingresar con el correo y la contraseña de tu cuenta municipal.",
      "Verificá tu rol en el menú de usuario (arriba a la derecha): define qué podés hacer.",
      "Cerrá sesión desde ese mismo menú cuando termines, sobre todo en computadoras compartidas."
    ],
    tips: [
      "Algunas acciones son solo de Administración (por ejemplo, eliminar una audiencia). Si un botón no aparece, suele ser por el rol."
    ]
  },
  {
    icon: MessagesSquare,
    name: "Consulta al CPU",
    href: "/consulta-cpu",
    oneLiner: "Migue en modo interno, con acceso al material de trabajo.",
    access: { tone: "warn", label: "Requiere rol municipal (el acceso se controla en el ingreso)" },
    paraQue:
      "La misma IA que responde a los vecinos, pero con acceso al conocimiento interno: además del Código, recupera informes y transcripciones de audiencias. Sirve para preparar informes, verificar normativa y rastrear qué se dijo sobre un tema.",
    pasos: [
      "Entrá a Consulta al CPU con tu sesión municipal.",
      "Escribí la consulta como se la harías a un asesor: tema, zona, qué necesitás saber.",
      "Revisá las fuentes de la respuesta: el Código se cita por artículo y las audiencias por fecha.",
      "Si necesitás que analice un documento, adjuntalo a la conversación (hasta 15 MB)."
    ]
  },
  {
    icon: Users,
    name: "Aportes ciudadanos",
    href: "/participacion",
    oneLiner: "La bandeja de trabajo sobre lo que presentan los vecinos.",
    access: { tone: "warn", label: "Requiere sesión municipal: expone datos personales de vecinos" },
    paraQue:
      "Todo lo que entra por Presentar cae acá, con los datos del vecino (nombre, DNI, zona, contacto) y el estado del trámite. Es la herramienta de triage: revisar, responder y dejar constancia del avance.",
    pasos: [
      "Abrí la bandeja y recorré los aportes pendientes.",
      "Abrí un aporte para leerlo completo, con los datos de contacto del vecino y el documento adjunto si lo hay.",
      "Si hace falta más información, contactá al vecino por los datos de su cuenta.",
      "Actualizá el estado del aporte a medida que avanza, así el resto del equipo ve el trámite al día."
    ],
    tips: ["Los datos de los vecinos son personales: se usan para el trámite, no se difunden."]
  },
  {
    icon: Scale,
    name: "Fábrica de Normas",
    href: "/normas",
    oneLiner: "Donde se redactan y evalúan los códigos nuevos, norma por norma.",
    access: { tone: "warn", label: "La gestión requiere sesión municipal" },
    paraQue:
      "Cada reforma normativa (un código nuevo) vive acá con sus normas. Sobre cada norma trabajan el diagnóstico con IA, los dictámenes de las áreas y la exportación con membrete institucional. El panel de demanda ciudadana muestra qué temas empujan los vecinos. La vieja sección «Proyectos» se reconvirtió en esta fábrica: su dirección redirige acá.",
    pasos: [
      "Creá el código nuevo (la reforma) que va a agrupar las normas.",
      "Cargá cada norma a mano, o importala desde un PDF con la herramienta de importación de la reforma.",
      "Abrí una norma para trabajarla: pedí el diagnóstico de Migue, sumá dictámenes u opiniones de las áreas y completá su información.",
      "Cuando esté lista, exportala: sale como documento imprimible con el membrete municipal.",
      "Mirá el panel de demanda por tema para cruzar lo que el equipo redacta con lo que los vecinos piden."
    ]
  },
  {
    icon: CalendarDays,
    name: "Audiencias públicas",
    href: "/audiencias",
    oneLiner: "Grabar la audiencia, transcribirla con IA y cerrar el acta.",
    access: { tone: "warn", label: "La gestión requiere sesión municipal" },
    paraQue:
      "El registro completo de las audiencias del ciclo. La audiencia en vivo se GRABA (el audio se sube solo, por tramos, mientras transcurre) y después un botón genera la transcripción con oradores, los cruces con las normas del código en debate, el resumen y las conclusiones. Migue aprende de cada acta.",
    pasos: [
      "Creá la audiencia en «Nueva audiencia» y completá la ficha inicial.",
      "En la pantalla en vivo, apretá «Comenzar a grabar» cuando arranque la audiencia. El audio se sube solo cada 5 minutos: el indicador de tramos guardados es tu tranquilidad.",
      "Mientras se graba, anotá en el lienzo de notas lo que la grabación no puede captar (quién habla, momentos clave) y completá la Ficha 1.",
      "Al terminar, «Finalizar audiencia». Si queda audio por subir, la pantalla te avisa antes de cerrar.",
      "En el detalle, apretá «Analizar audio»: transcribe los tramos (con progreso), separa oradores, cruza el debate con las normas y genera resumen y conclusiones. Tarda varios minutos: no cierres la pestaña.",
      "Revisá y firmá la ficha y las conclusiones desde el mismo detalle; adjuntá los documentos de la audiencia.",
      "«Descargar audio» te baja la grabación completa en un MP3 (la primera vez tarda un par de minutos; después es instantáneo).",
      "Para audiencias ya ocurridas, usá «Cargar audiencia»: acepta transcripciones (TXT/VTT/SRT), videos de YouTube o archivos de audio."
    ],
    tips: [
      "No cierres la pestaña mientras graba: la grabación vive en esa pantalla. Si algo falla, al volver a entrar la audiencia se retoma donde iba.",
      "Eliminar una audiencia es solo de Administración y borra también su grabación: la app pide una confirmación aparte que dice cuántos minutos de audio se pierden.",
      "El resumen ejecutivo en PDF se genera desde el detalle, con la identidad institucional."
    ]
  },
  {
    icon: Map,
    name: "Mapa territorial",
    href: "/admin",
    oneLiner: "El territorio del municipio con sus capas de información.",
    access: { tone: "warn", label: "Requiere rol municipal (el acceso se controla en el ingreso)" },
    // TODO: confirmar flujo — documentar las capas y acciones del mapa cuando el
    // modulo quede estable; por ahora se describe solo el acceso y el uso general.
    paraQue:
      "La vista territorial de la plataforma: el mapa de San Miguel de Tucumán con las capas de información cargadas por el municipio, para mirar la ciudad mientras se discuten las normas.",
    pasos: [
      "Entrá a Mapa territorial con tu sesión municipal.",
      "Navegá el mapa y activá las capas disponibles para ver la información sobre el territorio."
    ]
  }
];
