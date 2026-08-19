import { NextRequest } from "next/server";
import { partnerFetch } from "@/lib/partner-api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return partnerFetch(
    `/external/sessions/${encodeURIComponent(id)}/livekit-token`,
    { method: "POST", body: body || "{}" },
  );
}
