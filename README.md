# AIDOLS Partner frontend

Minimal Next.js playground for **API Services** (`/api/v1/external/*`). Same dark + orange theme as admin / user frontends.

The partner API key lives in `.env` as `AIDOLS_API_TOKEN`. Server BFF routes attach it as `Authorization: Bearer …` so the browser never needs the full key for REST.

## Setup

```bash
cd aidols-partner-frontend
cp .env.example .env
# paste a key minted in Admin → API Partners
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

## Env

| Variable | Purpose |
|----------|---------|
| `AIDOLS_API_TOKEN` | Partner key (`ak_live_…`) — **server only**. If empty/missing, the playground UI won’t render. |
| `BACKEND_URL` | `https://apiqa.socceraidolx.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://apiqa.socceraidolx.com/api/v1` (used to build stream URL) |

Restart the dev server after changing the token.

## What it tests

1. `GET /external/me`
2. `GET /external/celebrities` — photo cards + detail
3. `POST /external/sessions` + `WS .../stream`
4. `POST /external/sessions/{id}/livekit-token` + room subscribe
5. `POST /external/sessions/{id}/end`

Tabs: **Catalog** · **Chat** · **LiveKit**

Note: language toggle (en/es) is removed for now; chat sessions always start with `language: "es"`.
