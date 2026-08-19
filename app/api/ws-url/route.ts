import { NextRequest, NextResponse } from "next/server";
import { partnerWsUrl, tokenConfigured } from "@/lib/partner-api";

export async function GET(req: NextRequest) {
  if (!tokenConfigured()) {
    return NextResponse.json(
      { error: "AIDOLS_API_TOKEN is empty — paste a minted key into .env and restart" },
      { status: 401 },
    );
  }
  const stream = req.nextUrl.searchParams.get("stream") || "";
  if (!stream.startsWith("/api/v1/external/sessions/")) {
    return NextResponse.json({ error: "invalid stream path" }, { status: 400 });
  }
  return NextResponse.json({ wsUrl: partnerWsUrl(stream) });
}
