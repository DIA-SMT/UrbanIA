import { prisma } from "@/lib/db/prisma";
import {
  cityComparison as fallbackCityComparison,
  metrics as fallbackMetrics,
  regulations as fallbackRegulations,
  successCases as fallbackSuccessCases
} from "@/lib/data";

export type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
};

export type DashboardRegulation = {
  number: string;
  title: string;
};

export type DashboardSuccessCase = {
  city: string;
  country: string;
  title: string;
  tag: string;
};

export type DashboardCityComparison = {
  city: string;
  value: number;
};

export type DashboardData = {
  metrics: DashboardMetric[];
  regulations: DashboardRegulation[];
  successCases: DashboardSuccessCase[];
  cityComparison: DashboardCityComparison[];
  isLive: boolean;
};

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [
      activeProposalCount,
      regulationCount,
      caseStudyCount,
      regulations,
      caseStudies,
      cities
    ] = await Promise.all([
      prisma.proposal.count({
        where: {
          status: {
            in: ["SUBMITTED", "UNDER_REVIEW", "FEASIBLE", "APPROVED", "IN_PROGRESS"]
          }
        }
      }),
      prisma.regulation.count(),
      prisma.caseStudy.count(),
      prisma.regulation.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          number: true,
          title: true
        }
      }),
      prisma.caseStudy.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          title: true,
          tags: true,
          city: {
            select: {
              name: true,
              country: true
            }
          }
        }
      }),
      prisma.city.findMany({
        orderBy: [{ similarity: "desc" }, { name: "asc" }],
        take: 5,
        select: {
          name: true,
          density: true
        }
      })
    ]);

    const cityComparison = cities
      .map((city) => ({
        city: city.name.replace("San Miguel de Tucuman", "Tucuman"),
        value: Number((city.density ?? 0).toFixed(1))
      }))
      .filter((city) => city.value > 0);

    return {
      metrics: [
        { label: "Propuestas activas", value: formatInteger(activeProposalCount), delta: "DB" },
        { label: "Ordenanzas vigentes", value: formatInteger(regulationCount), delta: "DB" },
        { label: "Casos comparados", value: formatInteger(caseStudyCount), delta: "DB" }
      ],
      regulations: regulations.length
        ? regulations.map((regulation) => ({
            number: regulation.number ?? "Sin numero",
            title: regulation.title
          }))
        : fallbackRegulations,
      successCases: caseStudies.length
        ? caseStudies.map((caseStudy) => ({
            city: caseStudy.city.name.replace("San Miguel de Tucuman", "Tucuman"),
            country: caseStudy.city.country,
            title: caseStudy.title,
            tag: caseStudy.tags[0] ?? "Caso urbano"
          }))
        : fallbackSuccessCases,
      cityComparison: cityComparison.length ? cityComparison : fallbackCityComparison,
      isLive: true
    };
  } catch (error) {
    console.error("Dashboard data fallback:", error);

    return {
      metrics: fallbackMetrics,
      regulations: fallbackRegulations,
      successCases: fallbackSuccessCases,
      cityComparison: fallbackCityComparison,
      isLive: false
    };
  }
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}
