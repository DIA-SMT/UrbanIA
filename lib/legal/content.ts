/**
 * Textos de la Política de Privacidad y los Términos de Uso.
 *
 * MARCO GENERAL, no un documento cerrado. Al 2026-08-20 el municipio todavía no
 * definió varias cuestiones (responsable formal de la base, canal para ejercer
 * derechos, plazo de conservación, inscripción ante la AAIP). Este texto existe
 * para dar cobertura mientras tanto y para que el área legal corrija sobre algo
 * concreto en vez de partir de cero.
 *
 * REGLA AL ESCRIBIR ACÁ: lo que se afirma tiene que ser verdad hoy, verificado
 * contra el código. Donde no hay decisión tomada se usa una fórmula abierta o se
 * deja un marcador `[[...]]`, nunca un dato inventado: una política de
 * privacidad que describe algo distinto de lo que el sistema hace es peor que no
 * tener ninguna.
 *
 * Los marcadores `[[...]]` se resaltan al renderizar, a propósito: si alguien
 * publica esto sin completarlos, tiene que saltar a la vista.
 *
 * Datos verificados contra el código el 2026-08-20:
 * - User guarda name, email, dni, birthDate, ciditucId, role, status, createdAt.
 * - El texto de aportes va a OpenRouter (moderación de intención + clasificación
 *   de eje) y las consultas de Migue también. Modelo por defecto: gpt-4o-mini.
 * - AiQuery NO guarda userId: las consultas al asistente no se atan a la persona.
 * - Alojamiento: Vercel región gru1 y Supabase sa-east-1, los dos en São Paulo.
 * - Al borrar una cuenta, los aportes quedan con el nombre copiado (SetNull).
 */

export const LEGAL_VERSION = "1.0";
export const LEGAL_UPDATED_AT = "20 de agosto de 2026";

export type LegalSection = {
  heading: string;
  /** Cada string es un párrafo. Las listas van como `- item` al principio de línea. */
  body: string[];
};

export type LegalDocument = {
  slug: "privacidad" | "terminos";
  title: string;
  intro: string;
  sections: LegalSection[];
};

/** Marca visible de que el documento está en construcción, común a los dos. */
export const LEGAL_BETA_NOTICE =
  "UrbanIA es una aplicación en versión beta. Este documento es un marco general y puede cambiar a medida que la plataforma avance; los cambios se publican en esta misma página con su fecha.";

export const PRIVACY: LegalDocument = {
  slug: "privacidad",
  title: "Política de Privacidad",
  intro:
    "Esta política explica qué datos personales trata UrbanIA, para qué, con quiénes se comparten y cómo ejercer tus derechos. Está redactada en los términos de la Ley Nacional 25.326 de Protección de los Datos Personales.",
  sections: [
    {
      heading: "Quién es responsable de tus datos",
      body: [
        "El tratamiento de los datos personales de UrbanIA está a cargo de la Municipalidad de San Miguel de Tucumán, a través de [[el área responsable, con su domicilio]].",
        "UrbanIA fue desarrollada por la Dirección de Inteligencia Artificial de la Municipalidad."
      ]
    },
    {
      heading: "Qué datos se tratan",
      body: [
        "Los datos que identifican a cada persona NO se cargan en UrbanIA: llegan desde Ciudadano Digital (Cidituc), el sistema de identidad de la Municipalidad, cuando ingresás por primera vez. Son tu nombre y apellido, tu DNI, tu correo electrónico y tu fecha de nacimiento.",
        "UrbanIA nunca recibe ni almacena tu contraseña de Cidituc.",
        "Además, la plataforma guarda lo que vos generás al usarla:",
        "- El texto de las propuestas, reclamos y aportes que presentás, con la zona o barrio que indicás.",
        "- Los archivos que adjuntás a un aporte.",
        "- Las recomendaciones que dejás sobre el funcionamiento del portal.",
        "- El registro de las acciones que realizás dentro del sistema, con tu autoría y la fecha.",
        "Las consultas que le hacés al asistente Migue se guardan para medir qué le pregunta la gente y qué no puede responder, pero SIN registrar quién preguntó: no quedan asociadas a tu cuenta."
      ]
    },
    {
      heading: "Para qué se usan",
      body: [
        "- Tu identidad, para que cada aporte tenga una persona real detrás y el equipo municipal pueda contactarte si necesita entender mejor lo que planteaste.",
        "- El contenido de tus aportes, para que el equipo lo analice dentro del proceso de reforma del Código de Planeamiento Urbano.",
        "- El registro de acciones, para auditoría interna: saber quién hizo cada cosa dentro del sistema.",
        "- Las consultas al asistente, de forma anónima y agregada, para detectar qué información falta cargar.",
        "Tus datos no se usan con fines publicitarios ni se ceden con fines comerciales."
      ]
    },
    {
      heading: "Con quiénes se comparten",
      body: [
        "Para funcionar, UrbanIA se apoya en proveedores de servicios que tratan datos por cuenta de la Municipalidad:",
        "- Supabase, para almacenar la base de datos y los archivos adjuntos.",
        "- Vercel, para alojar y ejecutar la aplicación.",
        "- OpenRouter y los proveedores de modelos de inteligencia artificial a los que deriva, para dos cosas: responder tus consultas al asistente y analizar automáticamente el texto de los aportes, tanto para moderar contenido agresivo como para sugerir a qué tema corresponde cada uno.",
        "Esto significa que el TEXTO que escribís en un aporte o en una consulta se envía a un proveedor de inteligencia artificial para ser procesado. Ese texto se manda sin tu nombre ni tu DNI.",
        "Fuera de estos proveedores, tus datos no se comunican a terceros, salvo requerimiento de autoridad competente o cuando una norma lo imponga."
      ]
    },
    {
      heading: "Dónde se alojan",
      body: [
        "La infraestructura que usa UrbanIA está ubicada fuera de la República Argentina: tanto la base de datos como el alojamiento de la aplicación operan en centros de datos de São Paulo, Brasil.",
        "El procesamiento por inteligencia artificial puede realizarse en otras jurisdicciones, según el proveedor del modelo.",
        "[[Corresponde al área legal evaluar el encuadre de esta transferencia internacional conforme al artículo 12 de la Ley 25.326 y completar este apartado.]]"
      ]
    },
    {
      heading: "Cuánto tiempo se conservan",
      body: [
        "Los datos de tu cuenta se conservan mientras la cuenta esté vigente.",
        "Los aportes y las audiencias forman parte del expediente del proceso de reforma normativa, así que se conservan por el plazo que corresponda a la documentación pública municipal.",
        "[[Plazo concreto de conservación, a definir por el municipio.]]"
      ]
    },
    {
      heading: "Si borrás tu cuenta",
      body: [
        "Podés pedir la baja de tu cuenta. Cuando eso ocurre, los aportes que hayas presentado NO se eliminan: quedan en el registro del proceso participativo con el nombre con el que fueron presentados, porque forman parte de un antecedente público. Lo que se pierde es el vínculo con tu cuenta y la posibilidad de contactarte.",
        "Si querés que se elimine también el contenido de un aporte, tenés que pedirlo expresamente."
      ]
    },
    {
      heading: "Tus derechos",
      body: [
        "Podés solicitar el acceso, la rectificación, la actualización y la supresión de tus datos personales escribiendo a [[el canal de contacto, a definir]].",
        "Como tus datos de identidad provienen de Ciudadano Digital, las correcciones sobre tu nombre, DNI o fecha de nacimiento deben hacerse en ese sistema para que se reflejen acá.",
        "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.",
        "La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales."
      ]
    },
    {
      heading: "Seguridad",
      body: [
        "El acceso a UrbanIA se realiza exclusivamente a través de Ciudadano Digital y la aplicación no administra contraseñas. Dentro del sistema, cada persona ve únicamente lo que su rol habilita, y las acciones sobre audiencias y normas quedan registradas con su autor.",
        "Ningún sistema es infalible. Al tratarse de una versión beta, la plataforma está en revisión continua y sus medidas de seguridad se ajustan a medida que avanza."
      ]
    }
  ]
};

export const TERMS: LegalDocument = {
  slug: "terminos",
  title: "Términos de Uso",
  intro:
    "Estas condiciones regulan el uso de UrbanIA, la plataforma de la Municipalidad de San Miguel de Tucumán para el proceso de reforma del Código de Planeamiento Urbano. Al ingresar, aceptás estos términos.",
  sections: [
    {
      heading: "UrbanIA está en versión beta",
      body: [
        "Esto no es una formalidad: es la condición en la que está la plataforma hoy y conviene que la tengas presente antes de usarla.",
        "- Puede contener errores y puede dejar de funcionar sin aviso previo.",
        "- Las funciones pueden cambiar, moverse o discontinuarse mientras la plataforma evoluciona.",
        "- No se garantiza disponibilidad continua ni un tiempo de respuesta determinado.",
        "- El contenido cargado podría verse afectado por tareas de mantenimiento o migración.",
        "Si algo no funciona como esperabas, podés avisarnos desde la sección de sugerencias del portal: es la vía prevista para eso y la lee el equipo que desarrolla la herramienta."
      ]
    },
    {
      heading: "Qué NO es UrbanIA",
      body: [
        "Presentar una propuesta, un reclamo o un aporte en UrbanIA NO equivale a iniciar un trámite ni un expediente administrativo, no interrumpe plazos y no reemplaza ninguna presentación formal ante la Municipalidad.",
        "El equipo municipal lee y analiza lo que se presenta, pero la plataforma no garantiza una respuesta individual ni un plazo para responder.",
        "UrbanIA tampoco reemplaza el asesoramiento de un profesional ni una consulta formal ante el área técnica competente."
      ]
    },
    {
      heading: "Sobre Migue y las respuestas automáticas",
      body: [
        "Migue es un asistente basado en inteligencia artificial. Responde a partir del Código de Planeamiento Urbano y de la documentación cargada en la plataforma, y cita el artículo en el que se apoya para que puedas verificarlo.",
        "Puede equivocarse, puede no encontrar la información y puede responder de forma incompleta. Sus respuestas son orientativas y no constituyen un acto administrativo, una certificación ni una interpretación oficial de la normativa.",
        "Ante cualquier diferencia, prevalece el texto oficial de la ordenanza."
      ]
    },
    {
      heading: "Tu cuenta",
      body: [
        "El acceso a UrbanIA se realiza con tu cuenta de Ciudadano Digital (Cidituc). La cuenta es personal e intransferible y sos responsable del uso que se haga con ella.",
        "En tu primer ingreso, UrbanIA crea automáticamente tu cuenta ciudadana. Los roles y permisos dentro de la plataforma los administra la Municipalidad.",
        "La Municipalidad puede suspender el acceso de una cuenta ante un uso que incumpla estos términos."
      ]
    },
    {
      heading: "Cómo usar la plataforma",
      body: [
        "Al presentar contenido te comprometés a que sea veraz, propio y respetuoso.",
        "No está permitido cargar contenido agresivo, discriminatorio, difamatorio o ajeno al objeto de la plataforma, ni datos personales de terceros sin su consentimiento.",
        "La plataforma aplica filtros automáticos de moderación y puede rechazar un contenido antes de guardarlo. El equipo municipal puede además retirar contenido que incumpla estas condiciones."
      ]
    },
    {
      heading: "Qué se hace con lo que presentás",
      body: [
        "El contenido de los aportes se incorpora al proceso participativo de la reforma del Código y puede ser citado, resumido o agregado en informes y documentos de trabajo del municipio.",
        "Tus datos personales no se publican en el portal: lo que se difunde son los aportes y su análisis, no tu identidad."
      ]
    },
    {
      heading: "Cambios en estos términos",
      body: [
        "Estas condiciones pueden actualizarse. La versión vigente es siempre la publicada en esta página, con su fecha de última actualización.",
        "Los cambios relevantes se comunicarán dentro de la plataforma."
      ]
    }
  ]
};

export const LEGAL_DOCUMENTS = [PRIVACY, TERMS];
