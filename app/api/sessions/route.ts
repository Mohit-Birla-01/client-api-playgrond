import { NextRequest } from "next/server";
import { partnerFetch } from "@/lib/partner-api";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return partnerFetch("/external/sessions", { method: "POST", body });
}
