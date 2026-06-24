import { PrismaClient, RegulationType } from "@prisma/client";

const prisma = new PrismaClient();

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
