"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarView } from "@/components/AvatarView";
import CelebrityGrid from "@/components/CelebrityGrid";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLiveKitAvatar } from "@/hooks/useLiveKitAvatar";
import {
  readError,
  type ChatLine,
  type Celebrity,
  type PartnerMe,
  type SessionInfo,
  type TabId,
  type TokenStatus,
} from "@/lib/types";

const TABS: { id: TabId; label: string }[] = [
  { id: "catalog", label: "Catalog" },
  { id: "chat", label: "Chat" },
  { id: "livekit", label: "LiveKit" },
];

export default function PartnerPlaygroundPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("catalog");
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [me, setMe] = useState<PartnerMe | null>(null);
  const [celebs, setCelebs] = useState<Celebrity[]>([]);
  const [selected, setSelected] = useState("");
  const [session, setSession] = useState<SessionInfo | null>(null);
  // For now, keep a fixed language (UI toggle removed).
  const language = "es" as const;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [wsState, setWsState] = useState<"idle" | "connecting" | "open" | "closed">(
    "idle",
  );
  const [waiting, setWaiting] = useState(false);
  const [workerFailed, setWorkerFailed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sessionStartedRef = useRef(false);
  const workerFailedRef = useRef(false);
  const livekitErrorRef = useRef<string | null>(null);

  const { enqueueChunk, stop: stopAudio, initAudio } = useAudioPlayer();
  const avatar = useLiveKitAvatar({
    celebrityId: selected,
    sessionId: session?.session_id ?? null,
  });

  const selectedCeleb = celebs.find((c) => c.celebrity_id === selected);
  workerFailedRef.current = workerFailed;
  livekitErrorRef.current = avatar.error;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/status");
    setStatus((await res.json()) as TokenStatus);
  }, []);

  const loadMe = useCallback(async () => {
    setBusy("me");
    setError(null);
    try {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error(await readError(res));
      setMe((await res.json()) as PartnerMe);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load /me");
      setMe(null);
    } finally {
      setBusy(null);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setBusy("catalog");
    setError(null);
    try {
      const res = await fetch("/api/celebrities");
      if (!res.ok) throw new Error(await readError(res));
      const rows = (await res.json()) as Celebrity[];
      setCelebs(rows);
      setSelected((prev) => prev || rows[0]?.celebrity_id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog");
      setCelebs([]);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.configured) return;
    void loadMe();
    void loadCatalog();
  }, [status?.configured, loadMe, loadCatalog]);

  const disconnectWs = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsState("closed");
  };

  const connectWs = async (info: SessionInfo) => {
    disconnectWs();
    setWsState("connecting");
    const res = await fetch(`/api/ws-url?stream=${encodeURIComponent(info.stream_url)}`);
    if (!res.ok) {
      setWsState("closed");
      throw new Error(await readError(res));
    }
    const { wsUrl } = (await res.json()) as { wsUrl: string };
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setWsState("open");
    ws.onclose = () => setWsState("closed");
    ws.onerror = () => {
      setError("WebSocket error");
      setWsState("closed");
    };
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          data?: Record<string, unknown>;
        };
        if (payload.type === "session_ready") {
          setLines((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "system",
              text: `Connected · ${info.celebrity_id}`,
            },
          ]);
          return;
        }
        if (payload.type === "audio_chunk" && typeof payload.data?.audio === "string") {
          if (!sessionStartedRef.current || livekitErrorRef.current || workerFailedRef.current) {
            enqueueChunk(payload.data.audio);
          }
          return;
        }
        if (payload.type === "worker_dispatch_failed") {
          workerFailedRef.current = true;
          setWorkerFailed(true);
          return;
        }
        if (payload.type === "text_chunk" && typeof payload.data?.text === "string") {
          const token = payload.data.text;
          setLines((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id.startsWith("stream-")) {
              return [...prev.slice(0, -1), { ...last, text: last.text + token }];
            }
            return [
              ...prev,
              { id: `stream-${crypto.randomUUID()}`, role: "assistant", text: token },
            ];
          });
          return;
        }
        if (payload.type === "turn_complete") {
          setWaiting(false);
          const full = String(payload.data?.full_response ?? "");
          if (full) {
            setLines((prev) => {
              const withoutStream = prev.filter((l) => !l.id.startsWith("stream-"));
              return [
                ...withoutStream,
                { id: crypto.randomUUID(), role: "assistant", text: full },
              ];
            });
          }
          return;
        }
        if (payload.type === "blocked" || payload.type === "error") {
          setWaiting(false);
          setLines((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "system",
              text: String(payload.data?.detail ?? payload.data?.reason ?? payload.type),
            },
          ]);
        }
      } catch {
      }
    };
  };

  const startSession = async () => {
    if (!selected) return;
    setBusy("session");
    setError(null);
    setLines([]);
    setWorkerFailed(false);
    try {
      initAudio();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrity_id: selected, language }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const info = (await res.json()) as SessionInfo;
      setSession(info);
      sessionStartedRef.current = true;
      await connectWs(info);
      await avatar.startSession();
      setTab("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
      setSession(null);
      sessionStartedRef.current = false;
    } finally {
      setBusy(null);
    }
  };

  const endSession = async () => {
    if (!session) return;
    setBusy("end");
    setError(null);
    try {
      disconnectWs();
      await avatar.stopSession();
      stopAudio();
      const res = await fetch(`/api/sessions/${session.session_id}/end`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await readError(res));
      setLines((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "system", text: "Session ended" },
      ]);
      setSession(null);
      sessionStartedRef.current = false;
      setWaiting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setBusy(null);
    }
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || wsState !== "open" || !wsRef.current) return;
    initAudio();
    stopAudio();
    wsRef.current.send(JSON.stringify({ message: text }));
    setLines((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    setDraft("");
    setWaiting(true);
  };

  useEffect(() => {
    return () => {
      disconnectWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avatarBlock = selectedCeleb ? (
    <div className="h-[38vh] min-h-[280px] overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
      <AvatarView
        videoRef={avatar.videoRef}
        isReady={avatar.isReady}
        isConnected={avatar.isConnected}
        isLoading={avatar.isLoading}
        isTalking={avatar.isTalking}
        error={avatar.error}
        onRetry={() => {
          void avatar.startSession();
        }}
        celebrityName={selectedCeleb.display_name}
        celebrityInitials={selectedCeleb.initials}
        staticPhotoUrl={avatar.isReady ? undefined : selectedCeleb.photo_url || undefined}
        tagline={selectedCeleb.tagline || undefined}
      />
    </div>
  ) : (
    <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 text-sm text-white/40">
      Pick a celebrity on Catalog first.
    </p>
  );

  if (status === null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-white/40">Loading…</p>
      </div>
    );
  }

  if (!status.configured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
          <p>
            Add a minted key to <code>aidols-partner-frontend/.env</code> as{" "}
            <code>AIDOLS_API_TOKEN=ak_live_…</code> then restart <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--accent)]">
            Partner API
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white">
            API Services playground
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Same circle avatar, LiveKit video/audio, and speaking glow as the
            consumer chat.
          </p>
        </div>
        <div className="text-right text-xs">
          <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2">
            <span className="text-emerald-400">Token {status.prefix}</span>
          </div>
          {me && (
            <p className="mt-2 text-white/40">
              {me.customer_name} · {me.plan_slug ?? "no plan"} · {me.customer_status}
            </p>
          )}
        </div>
      </header>

      {error && (
        <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mb-6 flex gap-1 border-b border-[var(--border-subtle)]">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${
                active ? "text-[var(--accent)]" : "text-white/50 hover:text-white"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>

      {tab === "catalog" && (
        <CelebrityGrid
          celebs={celebs}
          selected={selected}
          loading={busy === "catalog"}
          onSelect={(id) => {
            setSelected(id);
            router.push(`/chat/${encodeURIComponent(id)}`);
          }}
          onRefresh={() => void loadCatalog()}
        />
      )}

      {tab === "chat" && (
        <div className="space-y-4">
          {avatarBlock}
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              disabled={Boolean(busy) || !selected}
              onClick={() => void startSession()}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40"
            >
              {busy === "session" ? "Starting…" : "Start session"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !session}
              onClick={() => void endSession()}
              className="rounded-full border border-red-400/40 px-5 py-2 text-xs font-bold uppercase tracking-wider text-red-300 disabled:opacity-40"
            >
              End
            </button>
            {session && (
              <span className="font-mono text-[10px] text-white/35">
                WS {wsState} · LK {avatar.isConnected ? "in room" : "off"}
                {avatar.isTalking ? " · speaking" : ""}
              </span>
            )}
          </div>

          <section className="flex min-h-[280px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {lines.length === 0 && (
                <p className="text-sm text-white/30">
                  Start a session, then send a message. Avatar video/audio uses
                  LiveKit like the consumer app.
                </p>
              )}
              {lines.map((line) => (
                <div
                  key={line.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm animate-fade-in ${
                    line.role === "user"
                      ? "ml-auto bg-[var(--bg-bubble-user)] text-white"
                      : line.role === "system"
                        ? "bg-white/5 text-white/45"
                        : "bg-[var(--bg-bubble-avatar)] text-white"
                  }`}
                >
                  {line.text}
                </div>
              ))}
              {waiting && (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
                  <span className="ml-2">Thinking…</span>
                </div>
              )}
              {avatar.isTalking && !waiting && (
                <p className="text-xs text-[var(--accent)]/70">Speaking</p>
              )}
            </div>
            <form
              className="flex gap-2 border-t border-[var(--border-subtle)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={wsState !== "open" || waiting}
                placeholder={
                  wsState === "open" ? "Write a message…" : "Start a session first"
                }
                className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-black/30 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-[var(--accent)] focus:outline-none disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={wsState !== "open" || waiting || !draft.trim()}
                className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === "livekit" && (
        <div className="space-y-4">
          {avatarBlock}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 text-sm text-white/60">
            <p>
              LiveKit uses <code className="text-white/80">POST /external/sessions/{"{id}"}/livekit-token</code>{" "}
              then subscribes to the same room as the consumer app. Video sits in
              the circle; audio attaches from the remote track. Speaking glow
              follows decoded frames.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-white/35">Connected</dt>
                <dd>{avatar.isConnected ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-white/35">Video ready</dt>
                <dd>{avatar.isReady ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-white/35">Speaking</dt>
                <dd>{avatar.isTalking ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-white/35">WS audio fallback</dt>
                <dd>{workerFailed || avatar.error ? "on" : "off"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
