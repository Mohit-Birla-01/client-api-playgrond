"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AvatarView } from "@/components/AvatarView";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useAvatarAssetVideos } from "@/hooks/useAvatarAssetVideos";
import { useLiveKitAvatar } from "@/hooks/useLiveKitAvatar";
import { getAssetUrls, pickNextAssetUrl } from "@/lib/asset-videos";
import { readError, type ChatLine, type Celebrity, type PartnerMe, type SessionInfo, type TokenStatus } from "@/lib/types";

type WsState = "idle" | "connecting" | "open" | "closed";

export default function PartnerChatPage() {
  const params = useParams<{ celebrityId: string }>();
  const celebrityId = decodeURIComponent(params.celebrityId || "");

  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [me, setMe] = useState<PartnerMe | null>(null);
  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);

  const [session, setSession] = useState<SessionInfo | null>(null);
  // For now, keep a fixed language (UI toggle removed).
  const language = "es" as const;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [wsState, setWsState] = useState<WsState>("idle");
  const [waiting, setWaiting] = useState(false);
  const [workerFailed, setWorkerFailed] = useState(false);

  const [micUnavailable, setMicUnavailable] = useState(false);
  const micTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sessionStartedRef = useRef(false);
  const workerFailedRef = useRef(false);
  const livekitErrorRef = useRef<string | null>(null);
  const renderFailedRef = useRef(false);
  const autoStartedRef = useRef(false);

  const { enqueueChunk, stop: stopAudio, initAudio } = useAudioPlayer();
  const avatar = useLiveKitAvatar({
    celebrityId,
    sessionId: session?.session_id ?? null,
  });

  workerFailedRef.current = workerFailed;
  livekitErrorRef.current = avatar.error;
  renderFailedRef.current = avatar.renderFailed;

  const showLive = avatar.isReady && avatar.isTalking && !avatar.renderFailed;
  const assetVideos = useAvatarAssetVideos({
    assets: celebrity?.assets,
    locale: language,
    enabled: Boolean(session),
    isWaiting: waiting,
    isTalking: avatar.isTalking,
    showLive,
  });
  const assetVideosRef = useRef(assetVideos);
  assetVideosRef.current = assetVideos;
  const celebrityRef = useRef(celebrity);
  celebrityRef.current = celebrity;

  const hasConversation = lines.length > 0;
  const backgroundUrl = celebrity?.background_image_url || undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, waiting]);

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

  const loadCelebrity = useCallback(async () => {
    setBusy("celebrity");
    setError(null);
    try {
      const res = await fetch(`/api/celebrities/${encodeURIComponent(celebrityId)}`);
      if (!res.ok) throw new Error(await readError(res));
      setCelebrity((await res.json()) as Celebrity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load celebrity");
      setCelebrity(null);
    } finally {
      setBusy(null);
    }
  }, [celebrityId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.configured) return;
    void loadMe();
    void loadCelebrity();
  }, [status?.configured, loadMe, loadCelebrity]);

  const showMicUnavailable = useCallback(() => {
    setMicUnavailable(true);
    if (micTimerRef.current) clearTimeout(micTimerRef.current);
    micTimerRef.current = setTimeout(() => setMicUnavailable(false), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (micTimerRef.current) clearTimeout(micTimerRef.current);
    };
  }, []);

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
          const urls = getAssetUrls(celebrityRef.current?.assets, "greeting_video", language);
          const pick = pickNextAssetUrl(urls, null);
          if (pick) assetVideosRef.current.playGreeting(pick);
          return;
        }

        if (payload.type === "greeting_asset_url" && typeof payload.data?.asset_url === "string") {
          assetVideosRef.current.playGreeting(
            payload.data.asset_url,
            typeof payload.data.source_text === "string" ? payload.data.source_text : undefined,
          );
          return;
        }

        if (payload.type === "audio_chunk" && typeof payload.data?.audio === "string") {
          if (
            !sessionStartedRef.current ||
            livekitErrorRef.current ||
            workerFailedRef.current ||
            renderFailedRef.current
          ) {
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
              return [...withoutStream, { id: crypto.randomUUID(), role: "assistant", text: full }];
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

  const startSession = useCallback(async () => {
    if (!celebrityId) return;
    setBusy("session");
    setError(null);
    setLines([]);
    setWorkerFailed(false);
    try {
      initAudio();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrity_id: celebrityId, language }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const info = (await res.json()) as SessionInfo;
      setSession(info);
      sessionStartedRef.current = true;
      await connectWs(info);
      await avatar.startSession(info.session_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
      setSession(null);
      sessionStartedRef.current = false;
    } finally {
      setBusy(null);
    }
  }, [avatar, celebrityId, initAudio]);

  useEffect(() => {
    if (!status?.configured || !celebrity || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startSession();
  }, [status?.configured, celebrity, startSession]);

  useEffect(() => {
    return () => {
      disconnectWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endSession = useCallback(async () => {
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
      setLines((prev) => [...prev, { id: crypto.randomUUID(), role: "system", text: "Session ended" }]);
      setSession(null);
      sessionStartedRef.current = false;
      setWaiting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setBusy(null);
    }
  }, [avatar, session, stopAudio]);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || wsState !== "open" || !wsRef.current) return;
    initAudio();
    stopAudio();
    assetVideosRef.current.notifyActivity();
    wsRef.current.send(JSON.stringify({ message: text }));
    setLines((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    setDraft("");
    setWaiting(true);
  }, [draft, initAudio, stopAudio, wsState]);

  if (status && !status.configured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
          <p>
            Add a minted key to <code>aidols-partner-frontend/.env</code> as{" "}
            <code>AIDOLS_API_TOKEN=ak_live_…</code> then restart.
          </p>
          <Link href="/" className="mt-4 inline-block text-[var(--accent)] hover:underline">
            ← Catalog
          </Link>
        </div>
      </div>
    );
  }

  const displayName = celebrity?.display_name || celebrityId;
  const initials = celebrity?.initials || displayName.slice(0, 2);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        {backgroundUrl ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${backgroundUrl}")` }} />
            <div className="absolute inset-0 bg-black/70" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#14110b] via-[var(--bg-primary)] to-black" />
        )}
      </div>

      <div className="relative z-10 px-6 pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70 hover:text-white">
              ← Catalog
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              {celebrity?.tagline && <p className="text-sm text-white/50">{celebrity.tagline}</p>}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="button"
              disabled={Boolean(busy)}
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
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        )}
      </div>

      <div className="relative z-10 grid gap-4 px-6 pb-8 md:gap-6 md:pb-10" style={{ gridTemplateRows: "auto 1fr auto" }}>
        <div className="h-[30vh] min-h-[260px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          {celebrity ? (
            <AvatarView
              videoRef={avatar.videoRef}
              isReady={avatar.isReady}
              isConnected={avatar.isConnected}
              isLoading={avatar.isLoading || busy === "session"}
              isTalking={avatar.isTalking}
              error={avatar.error}
              onRetry={() => void avatar.startSession()}
              celebrityName={displayName}
              celebrityInitials={initials}
              staticPhotoUrl={celebrity.photo_url || undefined}
              idleAssetUrl={celebrity.idle_asset_url || undefined}
              idleAssetStatus={celebrity.idle_asset_status || undefined}
              overlayVideoUrl={assetVideos.overlay?.url}
              overlayVideoMuted={assetVideos.overlay?.muted}
              overlayVideoLoop={assetVideos.overlay?.loop}
              onOverlayVideoEnded={assetVideos.handleEnded}
              preloadUrls={assetVideos.preloadUrls}
              tagline={celebrity.tagline || undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/40">Loading celebrity…</div>
          )}
        </div>

        <section className="flex min-h-[260px] flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {lines.length === 0 && !waiting && (
              <p className="text-sm text-white/30">
                Start a session, then send a message. Avatar video/audio uses LiveKit like the consumer app.
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

            {avatar.isTalking && !waiting && <p className="text-xs text-[var(--accent)]/70">Speaking</p>}
          </div>

          {micUnavailable && (
            <div className="border-t border-[var(--border-subtle)] bg-black/30 px-4 py-2 text-xs text-white/70">
              Not available right now
            </div>
          )}

          <form
            className="flex gap-2 border-t border-[var(--border-subtle)] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <button
              type="button"
              onClick={() => showMicUnavailable()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)] disabled:opacity-40"
              title="Microphone disabled in partner playground"
            >
              {/* mic icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M7 4a3 3 0 1 1 6 0v6a3 3 0 1 1-6 0V4z" />
                <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 0 9 0v-.357a.75.75 0 0 0-1.5 0V10a3 3 0 1 1-6 0v-.357z" />
                <path d="M10 15.5v1.75a.75.75 0 0 1-1.5 0V15.5a.75.75 0 0 1 1.5 0z" />
              </svg>
            </button>

            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={wsState !== "open" || waiting}
              placeholder={wsState === "open" ? "Write a message…" : "Start a session first"}
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
    </div>
  );
}

