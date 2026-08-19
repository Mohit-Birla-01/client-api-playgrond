import { NextRequest } from "next/server";
import { partnerFetch } from "@/lib/partner-api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return partnerFetch(`/external/celebrities/${encodeURIComponent(id)}`);
}
