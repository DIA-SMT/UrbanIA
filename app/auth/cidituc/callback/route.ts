import { handleCiditucCallback } from "@/lib/auth/api/cidituc";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleCiditucCallback(request);
}
