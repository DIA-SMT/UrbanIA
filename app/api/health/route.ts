import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "UrbanIA",
    modules: ["dashboard", "gis", "regulations", "case-studies", "assistant"]
  });
}
