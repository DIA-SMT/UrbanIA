import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "UrbanIA",
    modules: ["regulations", "norm-factory", "hearings", "participation", "gis", "assistant"]
  });
}
