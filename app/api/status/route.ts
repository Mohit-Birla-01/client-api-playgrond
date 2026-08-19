import { NextResponse } from "next/server";
import { tokenConfigured, tokenPrefix } from "@/lib/partner-api";

export async function GET() {
  return NextResponse.json({
    configured: tokenConfigured(),
    prefix: tokenPrefix(),
  });
}
