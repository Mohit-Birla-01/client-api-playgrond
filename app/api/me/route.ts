import { partnerFetch } from "@/lib/partner-api";

export async function GET() {
  return partnerFetch("/external/me");
}
