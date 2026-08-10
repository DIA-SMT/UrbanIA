import type { ToolGuide } from "@/components/help/help-content";
import {
  CalendarDays,
  KeyRound,
  Map,
  MessagesSquare,
  Scale,
  Speech,
  Users
} from "lucide-react";

/**
 * Manual operativo del EQUIPO MUNICIPAL. Vive en un archivo aparte del
 * contenido publico a proposito: asi el bundle del portal ciudadano nunca lo
 * incluye, ni siquiera como codigo muerto. Solo lo importa /admin/ayuda, que
 * exige sesion interna.
 *
 * Regla de oro: cada paso describe lo que la app HACE HOY, verificado contra el
 * codigo.
 */

export const staffTools: ToolGuide[] = [
  {
    icon: KeyRound,
    name: "Ingresar con la cuenta municipal",
    href: "/ingresar",
    oneLiner: "La sesión que habilita las herramientas de gestión.",
    paraQue:
      "Las herramientas internas exigen sesión con rol municipal. Los roles son tres: Administración (gestiona todo, incluidas las cuentas), Usuario CPU (crea y edita contenido) y Observador/a (ve el sistema interno en solo lectura). Sin sesión, la plataforma muestra solo la cara pública.",
    pasos: [
      "Entrá a Ingresar y autenticate con tu cuenta de Cidituc.",
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
  },
  {
    icon: Speech,
    name: "Foro de debates",
    href: "/foro",
    oneLiner: "Deliberar con postura antes de decidir, entre equipos.",
    access: { tone: "warn", label: "Interno: los vecinos no participan" },
    paraQue:
      "El espacio donde el equipo discute una pregunta urbana concreta surgida de una audiencia. En vez de un hilo de comentarios, cada aporte toma postura y se puede adherir a los argumentos de otros, así el peso de la discusión queda a la vista.",
    pasos: [
      "Entrá a Foro de debates y elegí uno de la lista: cada fila dice de qué audiencia nace, su estado y cuántos argumentos tiene.",
      "Leé el contexto y el resumen de la audiencia de origen, arriba de todo.",
      "Sumá tu argumento: elegí postura (a favor, en contra o aporte neutral) y escribilo con fundamento.",
      "Adherí a los argumentos que compartís. Los más adheridos suben al principio de su columna; a los propios no se puede adherir.",
      "Un administrador abre los debates (desde «Nuevo debate», eligiendo la audiencia de origen) y los cierra cuando la discusión está madura."
    ],
    tips: [
      "Con el debate cerrado, un administrador puede pedirle a Migue un análisis de toda la deliberación: lectura general, puntos de acuerdo, incongruencias, información faltante y posible camino de consenso. Es un insumo de lectura, no una conclusión oficial.",
      "La moderación oculta un argumento con motivo, nunca lo borra: el registro de la deliberación queda completo.",
      "Un debate cerrado no admite argumentos nuevos, pero se sigue leyendo: es el registro de lo que se discutió."
    ]
  },
  {
    icon: KeyRound,
    name: "Usuarios y accesos",
    href: "/admin/configuracion/usuarios",
    ctaLabel: "Ir a Configuración",
    oneLiner: "Quién entra al sistema y qué puede hacer cada cuenta.",
    access: { tone: "warn", label: "Solo administradores" },
    paraQue:
      "El panel de administración de accesos. La regla del sistema es que las identidades pertenecen a Cidituc: UrbanIA no crea personas, las valida y les asigna un rol. Cada rol es un conjunto de permisos, y el servidor controla cada operación contra esos permisos.",
    pasos: [
      "Entrá a Configuración > Usuarios: la tabla lista todas las cuentas con su rol, estado, área y último acceso.",
      "Buscá por nombre, apellido, DNI, correo, área o dependencia, o filtrá por rol, estado y área.",
      "En el menú de cada fila: ver perfil, editar, cambiar rol, suspender, reactivar, eliminar acceso o ver su historial.",
      "Para cambiar un rol o un estado hace falta un motivo: queda asentado en la auditoría con tu usuario, la fecha, la IP y el dispositivo.",
      "Las cuentas aparecen automáticamente después del primer ingreso con Cidituc; desde esta pantalla se asignan roles, áreas y estados."
    ],
    tips: [
      "Los roles son cuatro: Administrador (acceso total), Usuario normal (crea y edita contenido), Consulta (solo lectura del sistema interno) y Ciudadano (solo el portal público).",
      "Eliminar el acceso revoca la cuenta pero no borra nada: sus propuestas, aportes e historial se conservan para la auditoría.",
      "Nadie puede modificar su propio rol o estado, y el sistema no deja quedarse sin administradores activos.",
      "Un cambio de rol o una suspensión se aplican en el próximo inicio de sesión de esa persona."
    ]
  }
];
