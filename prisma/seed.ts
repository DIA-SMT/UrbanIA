import {
  BudgetCostType,
  FeasibilityLevel,
  MunicipalArea,
  NormativeRelationshipType,
  PrismaClient,
  ProjectStage,
  ProjectStatus,
  ProposalSource,
  ReformStatus,
  RegulationType
} from "@prisma/client";

const prisma = new PrismaClient();

type SeedProject = {
  code: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  stage: ProjectStage;
  source: ProposalSource;
  areas: MunicipalArea[];
  requiresEIA?: boolean;
  eiaNotes?: string;
  addressLabel?: string;
  latitude?: number;
  longitude?: number;
  diagnosis?: {
    feasibility: FeasibilityLevel;
    scope: string;
    objective: string;
    analysis: string;
    actions: string[];
    risks: string[];
  };
  budget?: Array<{ concept: string; costType: BudgetCostType; baseAmount: number; multiplier: number; fundingSource?: string }>;
  anchorArticleNumber?: string;
  anchorRelationship?: NormativeRelationshipType;
};

const seedProjects: SeedProject[] = [
  {
    code: "PRY-2026-0001",
    title: "Ciclovia protegida Avenida Aconquija",
    summary:
      "Construccion de una ciclovia protegida sobre Avenida Aconquija entre la rotonda de El Corte y Camino de Sirga, con segregacion fisica, senalizacion horizontal y vertical, y adecuacion de cruces peatonales. Busca completar la red de movilidad activa metropolitana y reducir la siniestralidad del corredor.",
    status: ProjectStatus.IN_PROGRESS,
    stage: ProjectStage.EXECUTION,
    source: ProposalSource.TECHNICAL_TEAM,
    areas: [MunicipalArea.MOVILIDAD, MunicipalArea.OBRAS_PUBLICAS, MunicipalArea.ESPACIO_PUBLICO],
    addressLabel: "Avenida Aconquija, Yerba Buena",
    latitude: -26.8106,
    longitude: -65.3206,
    diagnosis: {
      feasibility: FeasibilityLevel.HIGH,
      scope: "Movilidad urbana y espacio publico",
      objective: "Completar el corredor de movilidad activa y ordenar la circulacion sobre Avenida Aconquija.",
      analysis:
        "El proyecto es tecnicamente viable: el ancho de calzada disponible admite un carril segregado sin comprometer la capacidad vehicular minima. Debe coordinarse con el municipio de Yerba Buena por tratarse de un corredor metropolitano, y preverse la gestion con frentistas comerciales.",
      actions: [
        "Firmar convenio de coordinacion con Yerba Buena por el tramo compartido.",
        "Elaborar plan de senalizacion y desvios durante la obra.",
        "Relevar accesos vehiculares de comercios frentistas."
      ],
      risks: [
        "Resistencia comercial por perdida temporal de estacionamiento.",
        "Coordinacion interjurisdiccional puede demorar el inicio."
      ]
    },
    budget: [
      { concept: "Obra civil de carril segregado", costType: BudgetCostType.OBRA, baseAmount: 45000000, multiplier: 2, fundingSource: "Fondo municipal de obras" },
      { concept: "Senalizacion horizontal y vertical", costType: BudgetCostType.EQUIPAMIENTO, baseAmount: 8000000, multiplier: 1, fundingSource: "Fondo municipal de obras" }
    ],
    anchorArticleNumber: "29",
    anchorRelationship: NormativeRelationshipType.APPLIES
  },
  {
    code: "PRY-2026-0002",
    title: "Renovacion integral de la Plaza del Barrio Sur",
    summary:
      "Puesta en valor de la plaza del Barrio Sur: renovacion de solados, incorporacion de mobiliario urbano accesible, arbolado nativo, iluminacion LED y un sector de juegos inclusivos. Surge de un aporte ciudadano priorizado en participacion.",
    status: ProjectStatus.APPROVED,
    stage: ProjectStage.TECHNICAL_REVIEW,
    source: ProposalSource.CITIZEN,
    areas: [MunicipalArea.ESPACIO_PUBLICO, MunicipalArea.AMBIENTE, MunicipalArea.DESARROLLO_SOCIAL],
    addressLabel: "Barrio Sur, San Miguel de Tucuman",
    latitude: -26.8385,
    longitude: -65.2036,
    budget: [
      { concept: "Renovacion de solados y mobiliario", costType: BudgetCostType.OBRA, baseAmount: 45000000, multiplier: 1, fundingSource: "Presupuesto participativo" },
      { concept: "Arbolado y parquizacion", costType: BudgetCostType.MANTENIMIENTO, baseAmount: 6000000, multiplier: 1.5 }
    ]
  },
  {
    code: "PRY-2026-0003",
    title: "Ampliacion de la red de desagues pluviales zona Oeste",
    summary:
      "Ampliacion de conductos pluviales para mitigar anegamientos recurrentes en la zona Oeste durante la temporada estival. Incluye estudio hidraulico, nuevos colectores y bocas de tormenta.",
    status: ProjectStatus.IN_REVIEW,
    stage: ProjectStage.CABINET_REVIEW,
    source: ProposalSource.CABINET,
    areas: [MunicipalArea.OBRAS_PUBLICAS, MunicipalArea.AMBIENTE],
    requiresEIA: true,
    eiaNotes:
      "Por la escala de la intervencion hidraulica y su impacto sobre el escurrimiento de cuenca, requiere evaluacion de impacto ambiental provincial antes de licitar.",
    addressLabel: "Zona Oeste, San Miguel de Tucuman",
    budget: [
      { concept: "Estudio hidraulico de cuenca", costType: BudgetCostType.ESTUDIO_PROYECTO, baseAmount: 12000000, multiplier: 1 },
      { concept: "Colectores y bocas de tormenta", costType: BudgetCostType.OBRA, baseAmount: 45000000, multiplier: 3, fundingSource: "Financiamiento provincial" }
    ]
  },
  {
    code: "PRY-2026-0004",
    title: "Corredor comercial peatonal calle Munecas",
    summary:
      "Estudio de prefactibilidad para peatonalizar un tramo de calle Munecas en el microcentro, con priorizacion peatonal, mobiliario y control de cargas y descargas en horario acotado. Anteproyecto en formulacion.",
    status: ProjectStatus.DRAFT,
    stage: ProjectStage.FORMULATION,
    source: ProposalSource.TECHNICAL_TEAM,
    areas: [MunicipalArea.PLANEAMIENTO, MunicipalArea.MOVILIDAD, MunicipalArea.ESPACIO_PUBLICO],
    addressLabel: "Calle Munecas, microcentro"
  }
];

async function seedProjectModule() {
  for (const item of seedProjects) {
    const project = await prisma.project.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        summary: item.summary,
        status: item.status,
        stage: item.stage,
        source: item.source,
        areas: item.areas,
        requiresEIA: item.requiresEIA ?? false,
        eiaNotes: item.eiaNotes ?? null,
        addressLabel: item.addressLabel ?? null,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null
      },
      create: {
        code: item.code,
        title: item.title,
        summary: item.summary,
        status: item.status,
        stage: item.stage,
        source: item.source,
        areas: item.areas,
        requiresEIA: item.requiresEIA ?? false,
        eiaNotes: item.eiaNotes ?? null,
        addressLabel: item.addressLabel ?? null,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null
      }
    });

    if (item.diagnosis) {
      const existing = await prisma.projectDiagnosis.findFirst({ where: { projectId: project.id }, orderBy: { version: "desc" } });
      if (!existing) {
        await prisma.projectDiagnosis.create({
          data: {
            projectId: project.id,
            version: 1,
            feasibility: item.diagnosis.feasibility,
            scope: item.diagnosis.scope,
            objective: item.diagnosis.objective,
            analysis: item.diagnosis.analysis,
            actions: item.diagnosis.actions,
            risks: item.diagnosis.risks,
            citedArticles: [],
            model: "seed"
          }
        });
      }
    }

    if (item.budget) {
      await prisma.projectBudgetItem.deleteMany({ where: { projectId: project.id } });
      for (const budgetItem of item.budget) {
        await prisma.projectBudgetItem.create({
          data: {
            projectId: project.id,
            concept: budgetItem.concept,
            costType: budgetItem.costType,
            baseAmount: budgetItem.baseAmount,
            multiplier: budgetItem.multiplier,
            fundingSource: budgetItem.fundingSource ?? null,
            amount: budgetItem.baseAmount * budgetItem.multiplier
          }
        });
      }
    }

    if (item.anchorArticleNumber) {
      const article = await prisma.normativeArticle.findFirst({ where: { articleNumber: item.anchorArticleNumber } });
      if (article) {
        await prisma.normativeLink.upsert({
          where: {
            sourceType_sourceId_articleId_relationshipType: {
              sourceType: "project",
              sourceId: project.id,
              articleId: article.id,
              relationshipType: item.anchorRelationship ?? NormativeRelationshipType.APPLIES
            }
          },
          update: {},
          create: {
            sourceType: "project",
            sourceId: project.id,
            articleId: article.id,
            relationshipType: item.anchorRelationship ?? NormativeRelationshipType.APPLIES,
            notes: "Ancla de referencia cargada por seed",
            createdBy: "seed"
          }
        });
      }
    }
  }
}

type SeedNorm = {
  code: string;
  title: string;
  articleNumber: string;
  summary: string;
  status: ProjectStatus;
  areas: MunicipalArea[];
  articleText?: string;
  anchors: Array<{ articleNumber: string; relationship: NormativeRelationshipType; notes: string }>;
  analysis?: {
    feasibility: FeasibilityLevel;
    scope: string;
    objective: string;
    analysis: string;
    actions: string[];
    risks: string[];
    proposedText: string;
  };
};

const seedNorms: SeedNorm[] = [
  {
    code: "NOR-2026-0001",
    title: "Alturas maximas en corredores residenciales",
    articleNumber: "12",
    summary:
      "Regular la altura maxima de edificacion sobre corredores residenciales de baja densidad, donde el codigo vigente admite alturas que rompen la escala barrial. Se busca fijar un tope general y remitir las excepciones a un regimen de compensaciones urbanisticas.",
    status: ProjectStatus.IN_REVIEW,
    areas: [MunicipalArea.PLANEAMIENTO, MunicipalArea.OBRAS_PUBLICAS],
    articleText:
      "Articulo 12.- En los corredores residenciales de baja densidad, la altura maxima de fachada sera de 10,50 metros, equivalente a planta baja y dos niveles. Quedan exceptuados los predios frentistas a avenidas de mas de 30 metros de ancho, que se regiran por el regimen de compensaciones urbanisticas que establezca la reglamentacion. Toda excepcion debera garantizar el asoleamiento minimo de los predios linderos.",
    anchors: [
      { articleNumber: "29", relationship: NormativeRelationshipType.MODIFIES, notes: "Se reduce la altura maxima admitida sobre corredores residenciales." },
      { articleNumber: "30", relationship: NormativeRelationshipType.POTENTIAL_CONFLICT, notes: "El regimen de premios por retiro podria contradecir el tope nuevo." }
    ],
    analysis: {
      feasibility: FeasibilityLevel.MEDIUM,
      scope: "Corredores residenciales de baja densidad del ejido municipal",
      objective: "Fijar un tope general de altura que preserve la escala barrial",
      analysis:
        "La norma modifica el regimen de alturas del CPU 2014 en corredores residenciales. El tope propuesto es inferior al vigente, por lo que debe preverse la situacion de los permisos en tramite. El regimen de premios por retiro del articulo 30 quedaria parcialmente incompatible y requiere derogacion expresa o adecuacion.",
      actions: [
        "Derogar expresamente el regimen de premios en corredores residenciales o adecuarlo al tope nuevo.",
        "Prever un regimen de transicion para permisos de obra en tramite.",
        "Coordinar con Obras Publicas la delimitacion cartografica de los corredores alcanzados."
      ],
      risks: [
        "El regimen de premios por mayor retiro del codigo vigente permite superar el tope propuesto.",
        "Sin regimen de transicion, los permisos en tramite quedan en zona gris."
      ],
      proposedText:
        "Articulo 12.- En los corredores residenciales de baja densidad, la altura maxima de fachada sera de 10,50 metros. Las excepciones se regiran por el regimen de compensaciones urbanisticas que establezca la reglamentacion, garantizando el asoleamiento minimo de los predios linderos. Derogase toda norma que se oponga a la presente."
    }
  },
  {
    code: "NOR-2026-0002",
    title: "Arbolado obligatorio en nuevas urbanizaciones",
    articleNumber: "45",
    summary:
      "Exigir una densidad minima de arbolado nativo en toda nueva urbanizacion o loteo, con especies adecuadas al clima subtropical y a cargo del urbanizador, para mitigar el calor urbano.",
    status: ProjectStatus.DRAFT,
    areas: [MunicipalArea.AMBIENTE, MunicipalArea.ESPACIO_PUBLICO],
    anchors: [
      { articleNumber: "2", relationship: NormativeRelationshipType.REFERENCES, notes: "Marco general de objetivos ambientales del codigo." }
    ]
  },
  {
    code: "NOR-2026-0003",
    title: "Regimen de estacionamiento en microcentro",
    articleNumber: "78",
    summary:
      "Eliminar los minimos obligatorios de cocheras para usos comerciales en el microcentro y reemplazarlos por maximos, priorizando el transporte publico y la caminabilidad del area central.",
    status: ProjectStatus.APPROVED,
    areas: [MunicipalArea.MOVILIDAD, MunicipalArea.PLANEAMIENTO],
    articleText:
      "Articulo 78.- En el area central delimitada por la reglamentacion, no se exigiran modulos minimos de estacionamiento para usos comerciales y de servicios. Establecese un maximo de un modulo cada 120 metros cuadrados de superficie cubierta. Los modulos existentes podran reconvertirse a otros usos permitidos.",
    anchors: [
      { articleNumber: "5", relationship: NormativeRelationshipType.REPEALS, notes: "Se derogan los minimos de cocheras del area central." }
    ]
  },
  {
    code: "NOR-2026-0004",
    title: "Retiros de frente sobre avenidas metropolitanas",
    articleNumber: "23",
    summary:
      "Unificar los retiros de frente exigidos sobre avenidas metropolitanas, hoy dispersos en planillas por distrito, y vincularlos al ancho efectivo de la via.",
    status: ProjectStatus.IN_REVIEW,
    areas: [MunicipalArea.PLANEAMIENTO],
    anchors: [
      { articleNumber: "29", relationship: NormativeRelationshipType.REPLACES, notes: "El criterio nuevo sustituye el regimen de retiros por distrito." }
    ]
  }
];

/** Fabrica de Normas: un codigo nuevo de ejemplo con normas en distintos estados. */
async function seedNormFactory() {
  const reform = await prisma.normativeReform.upsert({
    where: { code: "COD-2026-01" },
    update: {
      title: "Codigo de Planeamiento Urbano 2026",
      description:
        "Reforma integral del Codigo de Planeamiento Urbano: cada norma nueva se redacta consultando el CPU 2014, anclando los articulos que modifica, deroga o reemplaza.",
      status: ReformStatus.DRAFT
    },
    create: {
      code: "COD-2026-01",
      title: "Codigo de Planeamiento Urbano 2026",
      description:
        "Reforma integral del Codigo de Planeamiento Urbano: cada norma nueva se redacta consultando el CPU 2014, anclando los articulos que modifica, deroga o reemplaza.",
      status: ReformStatus.DRAFT
    }
  });

  for (const item of seedNorms) {
    const data = {
      title: item.title,
      summary: item.summary,
      status: item.status,
      stage: ProjectStage.FORMULATION,
      source: ProposalSource.TECHNICAL_TEAM,
      areas: item.areas,
      reformId: reform.id,
      articleNumber: item.articleNumber,
      articleText: item.articleText ?? null
    };
    const norm = await prisma.project.upsert({
      where: { code: item.code },
      update: data,
      create: { code: item.code, ...data }
    });

    for (const anchor of item.anchors) {
      const article = await prisma.normativeArticle.findFirst({ where: { articleNumber: anchor.articleNumber } });
      if (!article) continue;
      await prisma.normativeLink.upsert({
        where: {
          sourceType_sourceId_articleId_relationshipType: {
            sourceType: "project",
            sourceId: norm.id,
            articleId: article.id,
            relationshipType: anchor.relationship
          }
        },
        update: { notes: anchor.notes },
        create: {
          sourceType: "project",
          sourceId: norm.id,
          articleId: article.id,
          relationshipType: anchor.relationship,
          notes: anchor.notes,
          createdBy: "seed"
        }
      });
    }

    if (item.analysis) {
      const existing = await prisma.projectDiagnosis.findFirst({ where: { projectId: norm.id }, orderBy: { version: "desc" } });
      if (!existing) {
        await prisma.projectDiagnosis.create({
          data: {
            projectId: norm.id,
            version: 1,
            feasibility: item.analysis.feasibility,
            scope: item.analysis.scope,
            objective: item.analysis.objective,
            analysis: item.analysis.analysis,
            actions: item.analysis.actions,
            risks: item.analysis.risks,
            citedArticles: [],
            proposedText: item.analysis.proposedText,
            model: "seed"
          }
        });
      }
    }
  }
}

async function main() {
  const tucuman = await prisma.city.upsert({
    where: { id: "san-miguel-tucuman" },
    update: {},
    create: {
      id: "san-miguel-tucuman",
      name: "San Miguel de Tucuman",
      province: "Tucuman",
      country: "Argentina",
      population: 908000,
      areaKm2: 90,
      density: 5650,
      climate: "Subtropical",
      description: "Ciudad nucleo del area metropolitana tucumana.",
      similarity: 100
    }
  });

  await prisma.regulation.createMany({
    data: [
      {
        title: "Codigo de Planeamiento Urbano",
        type: RegulationType.URBAN_CODE,
        number: "Ordenanza 5987/20",
        summary: "Marco normativo inicial para usos del suelo, alturas y condiciones urbanas."
      },
      {
        title: "Codigo de Edificacion",
        type: RegulationType.BUILDING_CODE,
        number: "Ordenanza 4003/15",
        summary: "Reglas edilicias y tecnicas para obras privadas y publicas."
      }
    ],
    skipDuplicates: true
  });

  await prisma.caseStudy.create({
    data: {
      cityId: tucuman.id,
      title: "Plan de ciclovias metropolitanas",
      problem: "Baja participacion de movilidad activa.",
      solution: "Red inicial de ciclovias conectando corredores principales.",
      results: "Caso base para comparar propuestas de movilidad sustentable.",
      tags: ["movilidad", "ciclovias", "espacio-publico"]
    }
  });

  await seedProjectModule();
  await seedNormFactory();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
