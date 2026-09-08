# AIDOLS Partner — Chat Service Integration Guide

**Audience:** Client / partner engineering teams integrating live chat  
**Reference implementation:** `aidols-partner-frontend` (this repo)  
**API base (examples):** `https://apiqa.socceraidolx.com/api/v1` (QA) · `https://api.socceraidolx.com/api/v1` (prod)

This is the same contract the partner frontend uses. Any other client (web, mobile, backend) can follow the same steps.

---

## 1. What you get

A live session with:

1. **Text + audio stream** over WebSocket (`/external/sessions/{id}/stream`)
2. Usage counted against your plan (`api_call` on session create, `turn` per completed message)

---

## 2. Credentials

| Item | Value |
|------|--------|
| Auth | `Authorization: Bearer ak_live_…` |
| Key source | AIDOLS Admin → API Partners → mint key (plaintext shown **once**) |
| Scopes needed | `catalog:read`, `sessions:write` |

**Security (same as this partner app):**

- Keep `ak_live_…` on your **server** (or secure backend). Do **not** ship the full key in a public browser bundle for REST calls.
- This app proxies REST through Next.js routes (`/api/sessions`, `/api/celebrities`, …) and only attaches the key server-side.
- WebSocket auth: backend accepts `Authorization: Bearer …` **or** `?api_key=ak_live_…` on the stream URL. Prefer header when your client can set WS headers; browsers often use the query form (as this app does).

---

## 3. End-to-end flow (what the partner frontend does)

```text
1. GET  /external/me                         → prove key works
2. GET  /external/celebrities                → entitled roster (+ assets)
3. POST /external/sessions                   → session_id + stream_url
4. WS   /external/sessions/{id}/stream       → send messages, receive events
5. POST /external/sessions/{id}/end          → close + duration metering
```

In this repo that maps to:

| Step | Browser calls (BFF) | Upstream AIDOLS API |
|------|---------------------|---------------------|
| Status / me | `GET /api/status`, `GET /api/me` | `GET /external/me` |
| Celebrity | `GET /api/celebrities/{id}` | `GET /external/celebrities/{id}` |
| Create session | `POST /api/sessions` | `POST /external/sessions` |
| Build WS URL | `GET /api/ws-url?stream=…` | appends `?api_key=` |
| End | `POST /api/sessions/{id}/end` | `POST /external/sessions/{id}/end` |

---

## 4. REST reference (curl)

Replace placeholders:

```bash
export BASE='https://apiqa.socceraidolx.com/api/v1'
export API_KEY='ak_live_YOUR_KEY'
export CELEB='lionel_messi'   # or any entitled celebrity_id
```

### 4.1 Health / identity

```bash
curl -sS "$BASE/external/me" \
  -H "Authorization: Bearer $API_KEY"
```

**`200`**

```json
{
  "customer_id": "<uuid>",
  "customer_name": "Acme Sports",
  "customer_status": "active",
  "key_id": "<uuid>",
  "tenant_id": null,
  "plan_slug": "growth",
  "scopes": ["catalog:read", "sessions:write"]
}
```

### 4.2 Catalog (entitled only)

```bash
curl -sS "$BASE/external/celebrities" \
  -H "Authorization: Bearer $API_KEY"

curl -sS "$BASE/external/celebrities/$CELEB" \
  -H "Authorization: Bearer $API_KEY"
```

Response includes profile fields plus optional `assets` (greeting / filler / proactive videos) used by the UI while waiting or greeting.

### 4.3 Create session

```bash
curl -sS -X POST "$BASE/external/sessions" \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"celebrity_id\": \"$CELEB\", \"language\": \"es\"}"
```

**`200`**

```json
{
  "session_id": "<uuid>",
  "celebrity_id": "lionel_messi",
  "stream_url": "/api/v1/external/sessions/<uuid>/stream",
  "language": "es"
}
```

`language`: `es` | `en`.

**Quota:** counts as one `api_call`. Over limit → **`429`**:

```json
{
  "detail": {
    "detail": "daily API call limit reached (200/200)",
    "code": "quota_exceeded"
  }
}
```

### 4.4 End session

```bash
curl -sS -X POST "$BASE/external/sessions/<session_id>/end" \
  -H "Authorization: Bearer $API_KEY"
```

**`200`**

```json
{
  "status": "ended",
  "session_id": "<uuid>",
  "duration_seconds": 330.0
}
```

---

## 5. WebSocket chat protocol

### Connect

```text
wss://apiqa.socceraidolx.com/api/v1/external/sessions/<session_id>/stream?api_key=ak_live_…
```

Or (if your stack supports WS headers):

```http
Authorization: Bearer ak_live_…
```

Close codes used by the API: `4001` auth/scope fail · `4004` session missing / not owned.

### Client → server

```json
{ "message": "Hola, ¿cómo estás?" }
```

Empty message → error event (`message required`).

### Server → client (events this app handles)

| `type` | Meaning | UI action (partner frontend) |
|--------|---------|------------------------------|
| `session_ready` | Socket accepted | Show connected; optional greeting video |
| `greeting_asset_url` | Pre-rendered greeting clip | Play `data.asset_url` |
| `text_chunk` | Streaming text token | Append to assistant bubble |
| `audio_chunk` | Base64 PCM/audio | Play audio for the reply |
| `turn_complete` | Full reply ready | Finalize assistant message; clear “waiting” |
| `blocked` / `error` | Governor / quota / validation | Show `data.detail` |

**Quota on a turn** (before pipeline):

```json
{
  "type": "error",
  "data": {
    "detail": "daily turn limit reached (500/500)",
    "code": "quota_exceeded"
  }
}
```

### Minimal browser sketch

```js
const ws = new WebSocket(
  `wss://apiqa.socceraidolx.com/api/v1/external/sessions/${sessionId}/stream?api_key=${apiKey}`
);

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === "text_chunk") appendText(msg.data.text);
  if (msg.type === "turn_complete") finalize(msg.data.full_response);
  if (msg.type === "audio_chunk") playBase64Audio(msg.data.audio);
  if (msg.type === "error") showError(msg.data);
};

ws.onopen = () => {
  ws.send(JSON.stringify({ message: "Hola" }));
};
```

---

## 6. Recommended architecture (copy this app)

```text
┌─────────────────┐     REST (no key)      ┌──────────────────┐   Bearer ak_live_   ┌─────────────┐
│ Partner browser │ ─────────────────────► │ Your BFF / Next  │ ─────────────────► │ AIDOLS API  │
│ (chat UI)       │ ◄──── JSON / WS URL ── │ (holds API key)  │ ◄───────────────── │ /external/* │
└────────┬────────┘                        └──────────────────┘                     └─────────────┘
         │
         └── WS stream (api_key query or via your proxy)
```

**Do:**

- Proxy `/external/*` from your backend with the key in env (`AIDOLS_API_TOKEN` in this repo).
- Create one session per chat UI mount; end on leave / unmount.
- Treat `quota_exceeded` as a first-class UI state.

**Don’t:**

- Put `ak_live_` in `NEXT_PUBLIC_*` or mobile app binaries if avoidable.
- Reuse another customer’s `session_id`.

---

## 7. Errors cheat sheet

| HTTP / WS | Meaning |
|-----------|---------|
| `401` | Missing / invalid / revoked key |
| `403` | Missing scope or session not owned |
| `404` | Celebrity not entitled / session not found |
| `429` + `quota_exceeded` | Plan limit (session create or turn) |
| WS `4001` | Auth/scope failed on connect |
| WS `4004` | Session missing / not owned |

---

## 8. Metering (what counts)

| Metric | When |
|--------|------|
| `api_call` | Successful `POST /external/sessions` |
| `session_created` | Same (informational) |
| `turn` | Each WS `turn_complete` |
| `session_ended` | `POST .../end` (`quantity` = seconds) — tracked, duration caps not enforced yet |

Does **not** count: `GET /me`, catalog GETs.

---

## 9. Smoke checklist (same as partner frontend)

1. [ ] `GET /external/me` → `200` with your plan/scopes  
2. [ ] `GET /external/celebrities` → at least one entitled celeb  
3. [ ] `POST /external/sessions` → `session_id` + `stream_url`  
4. [ ] WS connect → `session_ready`  
5. [ ] Send `{ "message": "…" }` → `text_chunk` / `turn_complete`  
6. [ ] `POST .../end` → `duration_seconds`  
7. [ ] Over-quota → `429` / WS `quota_exceeded`  

---

## 10. Code map in this repo

| File | Role |
|------|------|
| `lib/partner-api.ts` | Server-side `Bearer` fetch + WS URL builder |
| `app/api/sessions/**` | BFF proxies for create / get / end |
| `app/api/ws-url/route.ts` | Builds browser WS URL with `api_key` |
| `app/chat/[celebrityId]/page.tsx` | Session + WS message loop |

---

## 11. How API Services clients use this (product flow)

Partners use AIDOLS in two layers:

| Layer | Who | Auth | Purpose |
|-------|-----|------|---------|
| **Client dashboard** | Partner human | Customer JWT (`/api/v1/api-customers/auth/login`) | See plan, usage, mint/revoke keys, read docs |
| **API Services (machine)** | Partner backend / app | `ak_live_…` on `/api/v1/external/*` | Real chat sessions (this guide) |

### Typical client journey

1. AIDOLS admin creates an **API customer** + plan + celebrity entitlements.  
2. Admin (or dashboard) mints an **`ak_live_` key** — store it once on the partner server.  
3. Partner logs into the **client dashboard** → checks plan / usage / keys.  
4. Partner backend integrates **§3–§5** of this doc (me → catalog → session → WS → end).  
5. End users talk inside the **partner’s own app**; AIDOLS never needs those end-user logins for v1.

### What clients should implement

| Must | Optional |
|------|----------|
| Server-side key storage + BFF proxy | In-app docs page (see §12) |
| Session create + WS chat (text + audio) | Catalog UI using `GET /external/celebrities` |
| End session on leave | Usage charts from dashboard `/me/usage` |
| Handle `429` / `quota_exceeded` | — |

### What clients should **not** do

- Put `ak_live_` in public frontend env vars  
- Call consumer routes (`/api/v1/chat`, user JWT) as the partner contract  
- Document LiveKit / talking-avatar video as required for chat (text + WS audio is enough for this guide)

Dashboard APIs (login, plan, keys, usage) live under `/api/v1/api-customers/*` — see  
`aidols/docs/aidols_api_customer_dashboard_frontend.md`.  
**Chat integration for apps = this file (`/external/*`).**

---

## 12. Frontend prompt — add this guide to the client dashboard

Copy-paste this prompt to the frontend agent / engineer building the **client dashboard** docs UI:

```text
You are working on the AIDOLS partner / client dashboard frontend.

## Goal
Add a proper **API Documentation** (or “Developer docs”) section inside the
**client dashboard** so partners can learn how to use AIDOLS API Services and
integrate chat the same way our reference partner app does.

## Source of truth (must follow)
Use this markdown as the content base (do not invent other endpoints):
- File: `aidols-partner-frontend/docs/chat-integration.md`
  (sections 1–11: auth, flow, curl, WebSocket, architecture, errors, metering,
   how clients use API Services)
- Related (dashboard auth/keys/usage context only):
  - `aidols/docs/aidols_api_customer_dashboard_frontend.md`

## What the docs page must explain
1. **Auth**
   - Machine API: `Authorization: Bearer ak_live_…`
   - Key is minted by AIDOLS Admin → API Partners (or Keys page in dashboard)
   - Scopes: `catalog:read`, `sessions:write`
   - Never put the full API key in `NEXT_PUBLIC_*` / browser for REST —
     recommend BFF / server proxy

2. **How API Services clients use it** (§11 of chat-integration.md)
   - Dashboard (human JWT) vs machine API (`ak_live_`)
   - Journey: provision → key → integrate /external/* → end users in partner app

3. **Chat integration flow** (core)
   GET  /external/me
   GET  /external/celebrities
   POST /external/sessions
   WS   /external/sessions/{id}/stream
   POST /external/sessions/{id}/end

   Include:
   - curl examples (QA + note that prod host differs)
   - request/response JSON samples from the markdown
   - WebSocket send: `{ "message": "..." }`
   - WS events: session_ready, text_chunk, audio_chunk, turn_complete,
     blocked/error, quota_exceeded
   - Errors: 401 / 403 / 404 / 429 + WS close codes 4001 / 4004
   - Metering: api_call, turn, session_ended vs what does not count

4. **Architecture recommendation**
   - Browser → Partner BFF (holds key) → AIDOLS `/api/v1/external/*`
   - WS: Bearer header preferred; browser may use `?api_key=`

## UI requirements (client dashboard)
- New nav item: **Documentation** / **API docs** / **Developers**
  (match existing i18n + design system)
- Readable in-app docs page:
  - sticky TOC / sections
  - copy buttons on code blocks (curl + WS snippet)
  - base URL switcher or tabs: **QA** vs **Prod**
  - callouts for Security, Quotas (429), and “key shown once”
- Optional CTA: “Get your API key” → Keys page in the same dashboard
- **Do NOT document LiveKit / talking avatar video**
- Language: English primary (add ES if dashboard is bilingual)

## Out of scope
- Do not rebuild chat playground unless already planned
- Do not invent endpoints not in chat-integration.md
- Do not document consumer JWT chat (`/api/v1/chat`) as the partner contract —
  partner contract is `/api/v1/external/*`

## Acceptance
- A new partner can open Documentation in the client dashboard and integrate
  text+audio chat using only that page + their `ak_live_` key
- Content matches chat-integration.md (§1–§11)
- Code blocks are copyable; QA/Prod base URLs are clear
```

### Short Slack version

> Add an **API Documentation** page in the client dashboard. Source:  
> `aidols-partner-frontend/docs/chat-integration.md`.  
> Cover: how API Services clients use it (§11), `ak_live_` auth, external chat  
> flow (me → celebrities → sessions → WS → end), curl + WS events, BFF pattern,  
> quotas/errors/metering. Do not include LiveKit. Add TOC, copy buttons, and  
> QA/Prod base URL. Optional CTA to the Keys page.

---

## Related

- Limits / quotas design: `aidols/docs/aidols_api_services_limits_plan.md`  
- Dashboard / admin APIs: `aidols/docs/aidols_api_customer_dashboard_frontend.md`  

Questions on entitlements or keys: AIDOLS Admin → API Partners.
