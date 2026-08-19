export const BACKEND_BASE = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
).replace(/\/$/, "");

export function getApiToken(): string {
  return (process.env.AIDOLS_API_TOKEN || process.env.API_TOKEN || "").trim();
}

export function tokenConfigured(): boolean {
  const token = getApiToken();
  return token.startsWith("ak_live_") && token.length > 16;
}

export function tokenPrefix(): string | null {
  const token = getApiToken();
  if (!tokenConfigured()) return null;
  return `${token.slice(0, 16)}…`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function partnerFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!BACKEND_BASE) {
    return jsonResponse(500, { error: "BACKEND_URL / NEXT_PUBLIC_API_URL not configured" });
  }
  const token = getApiToken();
  if (!token) {
    return jsonResponse(401, {
      error: "AIDOLS_API_TOKEN is empty — paste a minted key into .env and restart",
    });
  }

  const url = `${BACKEND_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const upstream = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error(`[partner] ${init?.method ?? "GET"} ${url} → ERROR`, err);
    return jsonResponse(502, { error: "Upstream request failed" });
  }
}

/** Browser WS URL. Backend accepts ?api_key= on the stream socket. */
export function partnerWsUrl(streamPath: string): string {
  const wsBase = (
    process.env.NEXT_PUBLIC_WS_URL ||
    BACKEND_BASE.replace(/^https/i, "wss").replace(/^http/i, "ws")
  ).replace(/\/$/, "");
  const path = streamPath.startsWith("/") ? streamPath : `/${streamPath}`;
  // BACKEND_URL already includes /api/v1; stream_url from API is /api/v1/external/...
  const origin = wsBase.replace(/\/api\/v1$/, "");
  const token = getApiToken();
  const sep = path.includes("?") ? "&" : "?";
  return `${origin}${path}${sep}api_key=${encodeURIComponent(token)}`;
}
