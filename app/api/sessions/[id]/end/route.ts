import { NextRequest } from "next/server";
import { partnerFetch } from "@/lib/partner-api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return partnerFetch(`/external/sessions/${encodeURIComponent(id)}/end`, {
    method: "POST",
  });
}
