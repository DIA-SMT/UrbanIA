export type HearingStatus = "Programada" | "En curso" | "Finalizada" | "Reprogramada" | "Suspendida";
export type HearingModality = "Presencial" | "Virtual" | "Mixta";
export type TopicImportance = "Bajo" | "Medio" | "Alto" | "Critico";

export type HearingParticipant = {
  name: string;
  institution: string;
  role: string;
  actorType: string;
  attended: boolean;
  intervention: string;
};

export type HearingDocument = {
  name: string;
  type: string;
  url?: string;
  uploadedAt: string;
  uploadedBy: string;
  description: string;
};

export type ObservedTopic = {
  topic: string;
  description: string;
  importance: TopicImportance;
  relatedArticle: string;
  relatedProposal: string;
  technicalObservation: string;
  citizenObservation: string;
};

export type HearingDebateMessage = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type HearingContribution = {
  id: string;
  participantName: string;
  content: string;
  createdAt: string;
  fileNames: string[];
};

export type PublicHearing = {
  id: string;
  title: string;
  date: string;
  time: string;
  place: string;
  modality: HearingModality;
  status: HearingStatus;
  mainTopic: string;
  secondaryTopics: string[];
  recordNumber: string;
  recordTitle: string;
  relatedProposal: string;
  proposalOrigin: "Concejo" | "Ciudadania" | "Codigo urbano";
  promotingArea: string;
  recordStatus: string;
  recordDocument?: string;
  linkedProjectId?: string;
  relatedArticles: string[];
  participants: HearingParticipant[];
  documents: HearingDocument[];
  debateMessages?: HearingDebateMessage[];
  contributions?: HearingContribution[];
  aiSummary?: string;
  aiKeyPoints?: string[];
  conclusions: {
    summary: string;
    agreements: string;
    disagreements: string;
    nextSteps: string;
    technicalRecommendations: string;
    decisions: string;
    proposalStatusAfter: string;
  };
  observedTopics: ObservedTopic[];
};

export const publicHearings: PublicHearing[] = [
  {
    id: "aud-movilidad-2026",
    title: "Densificacion, movilidad y espacio publico",
    date: "2026-08-12",
    time: "10:00",
    place: "Concejo Deliberante - Salon de Sesiones",
    modality: "Mixta",
    status: "Programada",
    mainTopic: "Zonificacion",
    secondaryTopics: ["Movilidad", "Espacio publico", "Estacionamiento"],
    recordNumber: "EXP-2026-00451",
    recordTitle: "Reforma de criterios de altura sobre avenidas principales",
    relatedProposal: "Revision de alturas permitidas",
    proposalOrigin: "Concejo",
    promotingArea: "Comision de Planeamiento Urbano",
    recordStatus: "En tratamiento",
    recordDocument: "Expediente digital 00451/2026",
    linkedProjectId: "codigo-alturas",
    relatedArticles: ["Articulo 12", "Articulo 18", "Articulo 24"],
    participants: [
      {
        name: "Colegio de Arquitectos",
        institution: "CAT",
        role: "Participante tecnico",
        actorType: "Colegio profesional",
        attended: true,
        intervention: "Presentara observaciones sobre indicadores urbanisticos, densidad y relacion con el perfil vial."
      },
      {
        name: "Direccion de Planeamiento Urbano",
        institution: "Municipalidad de San Miguel de Tucuman",
        role: "Area informante",
        actorType: "Funcionario municipal",
        attended: true,
        intervention: "Expondra el informe de capacidad urbana y la propuesta de adecuacion normativa."
      }
    ],
    documents: [
      {
        name: "Informe preliminar de movilidad.pdf",
        type: "Informe tecnico",
        uploadedAt: "2026-07-28",
        uploadedBy: "Planeamiento Urbano",
        description: "Diagnostico de flujos, estacionamiento y capacidad vial de los corredores alcanzados."
      },
      {
        name: "Plano de corredores prioritarios.pdf",
        type: "Plano",
        uploadedAt: "2026-07-30",
        uploadedBy: "Comision de Planeamiento",
        description: "Delimitacion territorial de avenidas y parcelas incluidas en el expediente."
      }
    ],
    debateMessages: [],
    contributions: [],
    conclusions: {
      summary: "La audiencia se encuentra programada. La memoria se completara con las intervenciones y el acta consolidada.",
      agreements: "Pendiente de deliberacion.",
      disagreements: "Pendiente de deliberacion.",
      nextSteps: "Recepcionar inscripciones, publicar documentacion base y habilitar la participacion virtual.",
      technicalRecommendations: "Incorporar escenarios comparados de densidad y capacidad vial.",
      decisions: "Sin decisiones registradas.",
      proposalStatusAfter: "En tratamiento"
    },
    observedTopics: [
      {
        topic: "Altura permitida",
        description: "Relacion entre incremento de altura, ancho de avenida y capacidad de infraestructura.",
        importance: "Alto",
        relatedArticle: "Articulo 18",
        relatedProposal: "Revision de alturas permitidas",
        technicalObservation: "Se requiere modelar asoleamiento, movilidad y demanda de servicios.",
        citizenObservation: "Preocupacion por cambios de escala y congestion en barrios residenciales."
      },
      {
        topic: "Estacionamiento",
        description: "Demanda adicional de estacionamiento y ocupacion del espacio publico.",
        importance: "Medio",
        relatedArticle: "Articulo 24",
        relatedProposal: "Revision de alturas permitidas",
        technicalObservation: "Revisar exigencias segun accesibilidad al transporte publico.",
        citizenObservation: "Priorizar veredas y arbolado frente a nuevos espacios vehiculares."
      }
    ]
  },
  {
    id: "aud-ciclovia-aconquija",
    title: "Ciclovia Aconquija y ordenamiento de estacionamiento",
    date: "2026-08-26",
    time: "17:30",
    place: "Centro Vecinal Oeste - Salon multiuso",
    modality: "Mixta",
    status: "Programada",
    mainTopic: "Movilidad",
    secondaryTopics: ["Comercio barrial", "Seguridad vial", "Espacio publico"],
    recordNumber: "EXP-2026-00488",
    recordTitle: "Piloto de movilidad activa en corredor Aconquija",
    relatedProposal: "Nueva ciclovia en Av. Aconquija",
    proposalOrigin: "Codigo urbano",
    promotingArea: "Direccion de Movilidad Urbana",
    recordStatus: "Convocatoria publicada",
    recordDocument: "Convocatoria audiencia 00488/2026",
    linkedProjectId: "ciclovia-aconquija",
    relatedArticles: ["Articulo 12", "Articulo 24", "Articulo 31"],
    participants: [
      {
        name: "Camara de comerciantes del corredor oeste",
        institution: "Comercios Aconquija",
        role: "Actor afectado",
        actorType: "Camara empresarial",
        attended: false,
        intervention: "Presentara observaciones sobre carga y descarga, estacionamiento y comunicacion previa al piloto."
      },
      {
        name: "Colectivo movilidad segura",
        institution: "Organizacion ciudadana",
        role: "Participante ciudadano",
        actorType: "Organizacion barrial",
        attended: false,
        intervention: "Solicitara criterios de seguridad vial, continuidad ciclista y medicion antes/despues."
      }
    ],
    documents: [
      {
        name: "Relevamiento vial Aconquija.pdf",
        type: "Informe tecnico",
        uploadedAt: "2026-08-08",
        uploadedBy: "Movilidad Urbana",
        description: "Conteo preliminar de estacionamiento, siniestralidad y tramos posibles para piloto."
      },
      {
        name: "Mapa de tramos piloto.geojson",
        type: "Mapa",
        uploadedAt: "2026-08-09",
        uploadedBy: "Planeamiento Urbano",
        description: "Trazas alternativas para evaluar continuidad, cruces y puntos de conflicto."
      }
    ],
    debateMessages: [
      {
        id: "debate-ciclovia-1",
        authorName: "Movilidad Urbana",
        content: "La audiencia debe validar si el piloto empieza por tramo corto, con indicadores de seguridad y ocupacion de estacionamiento.",
        createdAt: "2026-08-10T14:20:00.000Z"
      }
    ],
    contributions: [],
    conclusions: {
      summary: "Audiencia programada para ordenar observaciones tecnicas, comerciales y ciudadanas antes de definir el tramo piloto.",
      agreements: "Pendiente de deliberacion.",
      disagreements: "Pendiente de deliberacion.",
      nextSteps: "Confirmar exposiciones, publicar tramos alternativos y abrir recepcion de aportes.",
      technicalRecommendations: "Medir flujo ciclista, carga y descarga, siniestralidad y ocupacion de estacionamiento por tramo.",
      decisions: "Sin decisiones registradas.",
      proposalStatusAfter: "En revision normativa"
    },
    observedTopics: [
      {
        topic: "Estacionamiento comercial",
        description: "Compatibilidad entre ciclovia, carga y descarga y permanencia comercial.",
        importance: "Alto",
        relatedArticle: "Articulo 24",
        relatedProposal: "Nueva ciclovia en Av. Aconquija",
        technicalObservation: "Definir ventanas horarias y zonas de carga antes del piloto.",
        citizenObservation: "Pedir comunicacion temprana y evaluacion por tramos para evitar rechazo inicial."
      }
    ]
  },
  {
    id: "aud-patrimonio-centro",
    title: "Proteccion patrimonial y renovacion del area central",
    date: "2026-06-18",
    time: "18:00",
    place: "Federacion Economica de Tucuman",
    modality: "Presencial",
    status: "Finalizada",
    mainTopic: "Patrimonio",
    secondaryTopics: ["Uso de suelo", "Espacio publico"],
    recordNumber: "EXP-2026-00217",
    recordTitle: "Actualizacion del catalogo de inmuebles patrimoniales",
    relatedProposal: "Area de proteccion historica del centro",
    proposalOrigin: "Concejo",
    promotingArea: "Comision de Patrimonio y Urbanismo",
    recordStatus: "Con dictamen tecnico",
    recordDocument: "Proyecto de ordenanza 217/2026",
    linkedProjectId: "codigo-alturas",
    relatedArticles: ["Articulo 41", "Articulo 43"],
    participants: [
      {
        name: "Facultad de Arquitectura y Urbanismo",
        institution: "Universidad Nacional de Tucuman",
        role: "Asesor tecnico",
        actorType: "Universidad",
        attended: true,
        intervention: "Propuso criterios de intervencion gradual y una ficha de valoracion para cada inmueble."
      },
      {
        name: "Vecinos del casco historico",
        institution: "Mesa barrial centro",
        role: "Participante ciudadano",
        actorType: "Organizacion barrial",
        attended: true,
        intervention: "Solicito controles efectivos y asistencia para el mantenimiento de fachadas."
      }
    ],
    documents: [
      {
        name: "Acta audiencia patrimonio.pdf",
        type: "Acta de audiencia",
        uploadedAt: "2026-06-20",
        uploadedBy: "Secretaria Legislativa",
        description: "Acta completa con exposiciones, preguntas y compromisos asumidos."
      },
      {
        name: "Catalogo patrimonial - revision 2.pdf",
        type: "Informe tecnico",
        uploadedAt: "2026-06-14",
        uploadedBy: "Comision de Patrimonio",
        description: "Inventario y criterios propuestos para altas y bajas del catalogo."
      }
    ],
    debateMessages: [
      {
        id: "debate-patrimonio-1",
        authorName: "Facultad de Arquitectura y Urbanismo",
        content: "La proteccion debe diferenciar grados y permitir intervenciones compatibles con los valores de cada inmueble.",
        createdAt: "2026-06-18T18:34:00.000Z"
      },
      {
        id: "debate-patrimonio-2",
        authorName: "Mesa barrial centro",
        content: "La norma necesita instrumentos de apoyo para que conservar no signifique trasladar todo el costo a los propietarios.",
        createdAt: "2026-06-18T19:02:00.000Z"
      }
    ],
    contributions: [
      {
        id: "aporte-patrimonio-1",
        participantName: "Universidad Nacional de Tucuman",
        content: "Propuesta metodologica para valorar inmuebles y registrar atributos materiales e inmateriales.",
        createdAt: "2026-06-18T18:45:00.000Z",
        fileNames: ["Metodologia de valoracion patrimonial.pdf"]
      }
    ],
    aiSummary: "La audiencia mostro consenso sobre la necesidad de actualizar el catalogo patrimonial con criterios publicos y fichas trazables. Las principales diferencias se concentraron en el alcance de las restricciones y en los instrumentos de apoyo para propietarios.",
    aiKeyPoints: [
      "Definir grados de proteccion diferenciados.",
      "Publicar fichas de valoracion por inmueble.",
      "Incorporar incentivos y asistencia para conservacion.",
      "Solicitar revision juridica antes del dictamen final."
    ],
    conclusions: {
      summary: "Se considero necesario actualizar el catalogo con criterios transparentes y medidas de acompanamiento para propietarios.",
      agreements: "Publicar fichas de valoracion, abrir una instancia de observaciones y definir incentivos para conservacion.",
      disagreements: "Alcance de las restricciones sobre usos comerciales y condiciones para intervenciones contemporaneas.",
      nextSteps: "Solicitar dictamen juridico y consolidar la nueva nomina de inmuebles.",
      technicalRecommendations: "Diferenciar grados de proteccion y documentar los valores materiales e inmateriales.",
      decisions: "Incorporar una mesa tecnica interinstitucional antes del dictamen final.",
      proposalStatusAfter: "Con dictamen tecnico"
    },
    observedTopics: [
      {
        topic: "Patrimonio",
        description: "Criterios de catalogacion y grados de proteccion edilicia.",
        importance: "Critico",
        relatedArticle: "Articulo 41",
        relatedProposal: "Area de proteccion historica del centro",
        technicalObservation: "El catalogo necesita fichas trazables y criterios homologados.",
        citizenObservation: "Se reclaman incentivos para evitar que la proteccion produzca abandono."
      }
    ]
  },
  {
    id: "aud-arbolado-barrios",
    title: "Arbolado, veredas y accesibilidad barrial",
    date: "2026-09-03",
    time: "16:30",
    place: "Centro Cultural Barrio Norte",
    modality: "Virtual",
    status: "Reprogramada",
    mainTopic: "Espacio publico",
    secondaryTopics: ["Accesibilidad", "Impacto ambiental", "Infraestructura"],
    recordNumber: "EXP-2026-00508",
    recordTitle: "Programa integral de veredas y arbolado urbano",
    relatedProposal: "Corredores verdes accesibles",
    proposalOrigin: "Ciudadania",
    promotingArea: "Mesa de aportes Cidituc",
    recordStatus: "En consulta publica",
    recordDocument: "Nota ciudadana consolidada 508/2026",
    linkedProjectId: "plaza-barrio-sur",
    relatedArticles: ["Articulo 29", "Articulo 31"],
    participants: [
      {
        name: "Red de organizaciones barriales",
        institution: "Cidituc",
        role: "Actor proponente",
        actorType: "Organizacion barrial",
        attended: false,
        intervention: "Presentara el mapa colaborativo de barreras urbanas y deficit de arbolado."
      }
    ],
    documents: [
      {
        name: "Mapa colaborativo de barreras",
        type: "Mapa",
        url: "https://cidituc.example/mapa",
        uploadedAt: "2026-08-19",
        uploadedBy: "Cidituc",
        description: "Aportes georreferenciados sobre veredas, rampas y cobertura de sombra."
      }
    ],
    debateMessages: [],
    contributions: [],
    conclusions: {
      summary: "La fecha fue reprogramada para ampliar la convocatoria de organizaciones territoriales.",
      agreements: "Pendiente de deliberacion.",
      disagreements: "Pendiente de deliberacion.",
      nextSteps: "Confirmar nueva sala virtual y actualizar la publicacion oficial.",
      technicalRecommendations: "Cruzar los aportes con anchos de vereda y redes de servicios.",
      decisions: "Reprogramar la audiencia.",
      proposalStatusAfter: "En consulta publica"
    },
    observedTopics: [
      {
        topic: "Accesibilidad",
        description: "Continuidad de recorridos peatonales y eliminacion de barreras.",
        importance: "Alto",
        relatedArticle: "Articulo 31",
        relatedProposal: "Corredores verdes accesibles",
        technicalObservation: "Priorizar corredores que conecten equipamientos publicos.",
        citizenObservation: "Las veredas discontinuas impiden recorridos seguros de personas mayores y con discapacidad."
      }
    ]
  }
];
