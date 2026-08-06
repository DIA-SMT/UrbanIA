import type { TourStep } from "@/components/help/guided-tour";

/**
 * Contenido de los recorridos guiados del SISTEMA INTERNO (el portal público
 * tiene el suyo en citizen-portal-landing).
 *
 * Misma regla de oro que el centro de ayuda: cada paso describe lo que la app
 * HACE HOY, verificado contra el código. En particular: las audiencias en vivo
 * se graban y se transcriben después con "Analizar audio", el foro es interno
 * (los vecinos no participan) y los debates los abre un administrador.
 */

/**
 * Recorrido del armazón: qué es cada herramienta de la barra lateral.
 * Los pasos de Configuración solo se muestran a administradores, que son los
 * únicos que ven esa sección.
 */
export function shellTourSteps(role: string | null): TourStep[] {
  const isAdmin = role === "ADMIN";
  const isCitizen = role === "CITIZEN";

  return [
    {
      title: "Bienvenido al sistema interno",
      body: "Este es UrbanIA para el equipo municipal: normativa, audiencias, territorio y deliberación en un solo lugar. El recorrido te muestra para qué sirve cada herramienta, en un minuto."
    },
    {
      anchor: "nav",
      title: "Tu barra de herramientas",
      body: "Todo el sistema se recorre desde acá. Lo que ves depende de tu rol: si algo no aparece, es porque tu cuenta no tiene ese permiso. El botón de la esquina la colapsa cuando necesitás más pantalla."
    },
    {
      anchor: "nav-normas",
      title: "Fábrica de Normas",
      body: "Acá se construye el Código nuevo: cada reforma agrupa sus artículos, con su texto redactado, sus vínculos con la normativa vigente y los documentos de respaldo."
    },
    {
      anchor: "nav-cpu",
      title: "Consulta al CPU",
      body: "El buscador inteligente del Código de Planeamiento. Preguntás en tus palabras y Migue responde citando los artículos: con sesión municipal accede también a material interno, no solo al texto público."
    },
    {
      anchor: "nav-mapa",
      title: "Mapa territorial",
      body: "El territorio con sus capas: distritos, proyectos y contexto urbano sobre el mapa de la ciudad, para mirar dónde cae cada decisión."
    },
    {
      anchor: "nav-audiencias",
      title: "Audiencias públicas",
      body: "El registro completo de cada audiencia: su ficha, sus documentos y la grabación. La audiencia en vivo se graba desde el navegador y después, con «Analizar audio», se transcribe separando oradores y se arma el borrador del acta."
    },
    {
      anchor: "nav-participacion",
      title: "Aportes ciudadanos",
      body: "La bandeja de lo que presentan los vecinos desde el portal: propuestas y reclamos con sus datos de contacto, para hacer el triage y seguir su estado."
    },
    {
      anchor: "nav-foro",
      title: "Foro de debates (nuevo)",
      body: "El espacio de deliberación interna del equipo. Cada debate nace de una audiencia y plantea una pregunta concreta; se argumenta tomando postura (a favor, en contra o aporte neutral) y se adhiere a los argumentos de otros. Los vecinos no participan acá."
    },
    ...(isAdmin
      ? [
          {
            anchor: "nav-config",
            title: "Configuración (solo administradores)",
            body: "El panel de accesos: quién entra al sistema y qué puede hacer. Adentro están Usuarios, Roles, Permisos, Solicitudes de acceso, la integración con SIDITUC, Seguridad y la auditoría de todos los cambios."
          }
        ]
      : []),
    {
      anchor: "migue",
      title: "Migue te acompaña siempre",
      body: "La burbuja está en todas las pantallas: preguntale sobre normativa, pedile un resumen o ayuda para ordenar un informe. Podés arrastrarla si te tapa algo."
    },
    {
      anchor: "header-actions",
      title: "Tu cuenta y el tema",
      body: "Desde acá cambiás entre modo claro y oscuro, y en tu nombre ves con qué rol estás trabajando y cerrás sesión."
    },
    {
      title: "¡Listo!",
      body: isCitizen
        ? "Podés repetir este recorrido cuando quieras con «¿Cómo funciona?» en el encabezado. En Ayuda tenés la guía completa de cada herramienta."
        : "Podés repetir este recorrido cuando quieras con «¿Cómo funciona?» en el encabezado. Las pantallas del Foro y de Configuración tienen además su propio recorrido, y en Ayuda está la guía escrita de cada herramienta."
    }
  ];
}

/** Recorrido del listado del foro. */
export const FORO_TOUR: TourStep[] = [
  {
    title: "El foro de debates",
    body: "Un debate es una pregunta urbana concreta que el equipo discute antes de decidir. Es un espacio interno: participan las cuentas municipales, no los vecinos."
  },
  {
    anchor: "foro-filtros",
    title: "Abiertos, cerrados y archivados",
    body: "Un debate abierto admite argumentos; uno cerrado conserva todo como registro de la deliberación. Archivar lo saca del día a día sin borrar nada."
  },
  {
    anchor: "foro-nuevo",
    title: "Abrir un debate",
    body: "Solo un administrador abre debates. Al crearlo elegís la audiencia de la que surge (y ves un resumen de lo que se habló ahí), planteás la pregunta y su contexto, y si querés lo vinculás a una propuesta o proyecto."
  },
  {
    anchor: "foro-lista",
    title: "Entrar a un debate",
    body: "Cada fila muestra de qué audiencia nace, su estado y cuántos argumentos tiene. Al abrirlo vas a ver dos columnas —a favor y en contra— con los argumentos ordenados por adhesiones, no por hora."
  },
  {
    title: "Dentro del debate",
    body: "Publicás tu argumento eligiendo postura y podés adherir a los de otros (a los propios no). Un administrador puede ocultar un argumento con motivo: nunca se borra. Y con el debate cerrado, puede pedirle a Migue un análisis de toda la deliberación."
  },
  {
    title: "¡Listo!",
    body: "Repetí este recorrido cuando quieras con «¿Cómo funciona?» arriba de la lista."
  }
];

/** Recorrido de Configuración > Usuarios y Accesos. */
export const USUARIOS_TOUR: TourStep[] = [
  {
    title: "Usuarios y accesos",
    body: "Acá se administra quién entra a UrbanIA y qué puede hacer. La regla del sistema: las identidades pertenecen a SIDITUC; UrbanIA no crea personas, las autoriza."
  },
  {
    anchor: "config-nav",
    title: "Las siete secciones",
    body: "Usuarios es la pantalla principal. Roles y Permisos muestran qué habilita cada rol; Solicitudes y SIDITUC se activan con la integración; Seguridad explica las políticas vigentes y Auditoría guarda cada cambio."
  },
  {
    anchor: "usuarios-buscador",
    title: "Buscar y filtrar",
    body: "El buscador va por nombre, apellido, DNI, correo, área o dependencia mientras escribís. Los filtros acotan por rol, estado y área."
  },
  {
    anchor: "usuarios-crear",
    title: "Crear usuario (provisorio)",
    body: "Alta manual mientras SIDITUC no esté integrado: nombre y apellido, correo, cargo, contraseña y rol. Cuando la integración se active, este botón desaparece y las cuentas se vinculan desde Solicitudes de acceso."
  },
  {
    anchor: "usuarios-tabla",
    title: "El estado de cada cuenta",
    body: "Activo, Suspendido, Revocado, Pendiente o Inactivo, con su color. En el menú de cada fila: ver perfil, editar, cambiar rol, suspender, reactivar o eliminar el acceso. Sobre tu propia cuenta esas acciones están bloqueadas."
  },
  {
    title: "Todo queda registrado",
    body: "Cada cambio de rol o de estado pide un motivo y se asienta en la auditoría con tu usuario, la fecha, la IP y el dispositivo. Eliminar un acceso revoca la cuenta, pero no borra sus datos ni su historial."
  },
  {
    title: "¡Listo!",
    body: "Repetí este recorrido cuando quieras con «¿Cómo funciona?» arriba de la tabla."
  }
];
