"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLiveKitAvatar } from "@/hooks/useLiveKitAvatar";
import {
  MESSI_AVATAR_SRC,
  MESSI_CELEBRITY_ID,
  MESSI_DISPLAY_NAME,
  MESSI_HERO_SRC,
  MESSI_LANGUAGE,
  MESSI_PROMPTS,
  MESSI_TAG,
} from "@/lib/messi";
import { readError, type Celebrity, type ChatLine, type SessionInfo, type TokenStatus } from "@/lib/types";

type WsState = "idle" | "connecting" | "open" | "closed";

const MARQUEE = [
  "17 YEARS ACTUALLY EXTENDED",
  "ANOTHER REALITY",
  "10 YEARS IN SOCCER",
  "FÚTBOL ELEVATED",
  "META QUEST READY",
] as const;

const NAV_ITEMS = ["Home", "Compete", "Enjoy", "Connect", "Train"] as const;

function IconArrowUpRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconVolume({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconSquare({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function IconLoader({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function VoxlyExperiencePage() {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [wsState, setWsState] = useState<WsState>("idle");
  const [waiting, setWaiting] = useState(false);
  const [workerFailed, setWorkerFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wipFeature, setWipFeature] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const sessionStartedRef = useRef(false);
  const workerFailedRef = useRef(false);
  const livekitErrorRef = useRef<string | null>(null);
  const renderFailedRef = useRef(false);
  const talkRef = useRef<HTMLElement | null>(null);
  sessionRef.current = session;

  const { enqueueChunk, stop: stopAudio, initAudio } = useAudioPlayer();
  const avatar = useLiveKitAvatar({
    celebrityId: MESSI_CELEBRITY_ID,
    sessionId: session?.session_id ?? null,
  });

  workerFailedRef.current = workerFailed;
  livekitErrorRef.current = avatar.error;
  renderFailedRef.current = avatar.renderFailed;

  const isTalking = avatar.isTalking;
  /** Same as aidols AvatarView: live video only while speaking. */
  const showLiveVideo = avatar.isReady && isTalking && !avatar.renderFailed;
  const statusLabel = isTalking ? "Speaking" : waiting || busy === "session" ? "Thinking" : "Listening";
  const avatarPhoto = celebrity?.photo_url || MESSI_AVATAR_SRC;
  const displayName = celebrity?.display_name || MESSI_DISPLAY_NAME;
  const displayTag = celebrity?.tagline || MESSI_TAG;

  const showWip = useCallback((feature: string) => {
    setMenuOpen(false);
    setWipFeature(feature);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, waiting]);

  useEffect(() => {
    if (!wipFeature) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWipFeature(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wipFeature]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/status");
      setStatus((await res.json()) as TokenStatus);
    })();
  }, []);

  useEffect(() => {
    if (!status?.configured) return;
    void (async () => {
      try {
        const res = await fetch(`/api/celebrities/${encodeURIComponent(MESSI_CELEBRITY_ID)}`);
        if (!res.ok) return;
        setCelebrity((await res.json()) as Celebrity);
      } catch {
        // keep local fallback photo
      }
    })();
  }, [status?.configured]);

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

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("WebSocket connection timed out"));
      }, 15000);
      ws.onopen = () => {
        window.clearTimeout(timeout);
        setWsState("open");
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timeout);
        setError("WebSocket error");
        setWsState("closed");
        reject(new Error("WebSocket error"));
      };
    });

    ws.onclose = () => setWsState("closed");
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          data?: Record<string, unknown>;
        };

        if (payload.type === "session_ready") {
          setLines((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "system", text: "Connected — talk with Messi live." },
          ]);
          return;
        }

        if (payload.type === "audio_chunk" && typeof payload.data?.audio === "string") {
          // Same fallback as consumer: play WS audio when LiveKit video isn't driving the turn.
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
            return [...prev, { id: `stream-${crypto.randomUUID()}`, role: "assistant", text: token }];
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
        // ignore non-json
      }
    };
  };

  const startSession = useCallback(async () => {
    if (!status?.configured) {
      setError("API token missing in .env — add AIDOLS_API_TOKEN and restart.");
      return false;
    }
    talkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setBusy("session");
    setError(null);
    setLines([]);
    setWorkerFailed(false);
    try {
      initAudio();
      const prev = sessionRef.current;
      if (prev) {
        disconnectWs();
        await avatar.stopSession();
        stopAudio();
        await fetch(`/api/sessions/${prev.session_id}/end`, { method: "POST" }).catch(() => null);
      }
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrity_id: MESSI_CELEBRITY_ID, language: MESSI_LANGUAGE }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const info = (await res.json()) as SessionInfo;
      setSession(info);
      sessionRef.current = info;
      sessionStartedRef.current = true;
      await connectWs(info);
      // Pass session id explicitly so LiveKit joins without waiting for a re-render.
      await avatar.startSession(info.session_id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
      setSession(null);
      sessionStartedRef.current = false;
      return false;
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.configured, initAudio, avatar, stopAudio]);

  useEffect(() => {
    return () => {
      disconnectWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(
    async (raw?: string) => {
      const text = (raw ?? draft).trim();
      if (!text || waiting || busy) return;

      if (wsState !== "open" || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        const ok = await startSession();
        if (!ok || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          setError("Could not open live session. Try Start a session.");
          return;
        }
      }

      initAudio();
      stopAudio();
      wsRef.current.send(JSON.stringify({ message: text }));
      setLines((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
      setDraft("");
      setWaiting(true);
      setError(null);
    },
    [draft, waiting, busy, wsState, startSession, initAudio, stopAudio],
  );

  const marqueeItems = [...MARQUEE, ...MARQUEE, ...MARQUEE];

  return (
    <div className="min-h-screen bg-[#080a1e] font-sans text-white antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0e2a]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-8">
            <button type="button" onClick={() => showWip("VOXLY menu")} className="flex items-center gap-1.5">
              <span className="font-vox text-xl tracking-tight">VOX</span>
              <span className="text-xl font-black tracking-tight">LY</span>
              <IconChevronDown className="ml-1 h-4 w-4 text-white/50" />
            </button>
            <nav className="hidden items-center gap-7 lg:flex">
              {NAV_ITEMS.map((item, i) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => (i === 0 ? document.getElementById("talk")?.scrollIntoView({ behavior: "smooth" }) : showWip(item))}
                  className={`relative py-1 text-[15px] transition-colors ${i === 0 ? "text-white" : "text-white/60 hover:text-white"}`}
                >
                  {item}
                  {i === 0 && <span className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded bg-[#6c47ff]" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => showWip("For business")}
                className="rounded-md border border-white/25 px-4 py-2 text-[15px] text-white/90 transition-colors hover:bg-white/5"
              >
                For business
              </button>
            </nav>
          </div>
          <div className="hidden items-center gap-6 lg:flex">
            <button
              type="button"
              onClick={() => showWip("Language")}
              className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
            >
              <IconGlobe className="h-4 w-4" /> EN <IconChevronDown className="h-3.5 w-3.5" />
            </button>
            <a
              href="#talk"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#6c47ff] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7d5cff]"
            >
              Get In. No Spectators <IconArrowUpRight className="h-4 w-4" />
            </a>
          </div>
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-md border border-white/15 lg:hidden"
          >
            {menuOpen ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0b0e2a] px-5 py-3 lg:hidden">
            <div className="flex flex-col">
              {NAV_ITEMS.map((item, i) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    if (i === 0) {
                      setMenuOpen(false);
                      document.getElementById("talk")?.scrollIntoView({ behavior: "smooth" });
                      return;
                    }
                    showWip(item);
                  }}
                  className="py-2.5 text-left text-sm text-white/80"
                >
                  {item}
                </button>
              ))}
              <button type="button" onClick={() => showWip("For business")} className="py-2.5 text-left text-sm text-white/80">
                For business
              </button>
              <a href="#talk" onClick={() => setMenuOpen(false)} className="mt-2 block rounded-md bg-[#6c47ff] px-4 py-2.5 text-center text-sm font-semibold">
                Get In. No Spectators
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MESSI_HERO_SRC} alt="Players standing together before a match" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#080a1e]/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080a1e]/70 via-transparent to-[#080a1e]/80" />
        <div className="relative z-10 mx-auto flex min-h-[78svh] max-w-[1200px] flex-col items-center justify-center px-6 py-24 text-center">
          <h1 className="text-balance text-[clamp(2.6rem,7vw,5.5rem)] font-bold uppercase leading-[0.98] tracking-[-0.02em]">
            A <span className="font-serif font-normal italic">new</span> way to
            <br />
            live <span className="font-serif font-normal italic">football</span>
          </h1>
          <p className="mt-8 max-w-2xl text-sm uppercase tracking-[0.04em] text-white/85 sm:text-base">
            Feeling the pressure, emotion, and adrenaline from within with virtual reality.
          </p>
          <a
            href="#talk"
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-[#6c47ff] px-7 py-4 text-base font-medium text-white transition-colors hover:bg-[#7d5cff]"
          >
            More than Football <IconArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="relative z-10 overflow-hidden bg-[#6c47ff] py-4">
          <div className="animate-marquee flex w-max items-center gap-14 pr-14">
            {marqueeItems.map((item, i) => (
              <span key={`${item}-${i}`} className="whitespace-nowrap text-sm font-bold uppercase italic tracking-[0.06em] text-white">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Talk with Messi */}
      <section id="talk" ref={talkRef} className="relative mx-auto max-w-[1400px] px-6 py-24 md:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(108,71,255,0.22),transparent_70%)]" />

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6c47ff]">Live demo</p>
            <h2 className="mt-4 text-balance text-[clamp(2rem,4.5vw,3.6rem)] font-bold uppercase leading-[1.02] tracking-[-0.02em]">
              Talk with <span className="font-serif font-normal italic">Messi</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#b9b6d6]">
            No spectators. Send a message and hear the answer back in his voice, live.
          </p>
        </div>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

        <div className="mt-12">
          <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="relative flex flex-col items-center justify-center py-6">
              <div
                className={`pointer-events-none absolute h-[380px] w-[380px] rounded-full blur-[90px] transition-opacity duration-700 ${
                  isTalking ? "bg-[#6c47ff]/40 opacity-100" : "bg-[#6c47ff]/20 opacity-70"
                }`}
              />
              <div className="relative">
                <div
                  className={`relative h-64 w-64 overflow-hidden rounded-full border border-white/10 bg-black/30 transition-transform duration-700 sm:h-80 sm:w-80 ${
                    isTalking ? "scale-[1.04] shadow-[0_0_40px_6px_rgba(108,71,255,0.35)]" : "scale-100"
                  }`}
                  style={{
                    maskImage: "radial-gradient(circle at 50% 45%, #000 52%, rgba(0,0,0,0.65) 70%, transparent 84%)",
                    WebkitMaskImage: "radial-gradient(circle at 50% 45%, #000 52%, rgba(0,0,0,0.65) 70%, transparent 84%)",
                  }}
                >
                  {/* LiveKit always mounted; visible only while speaking (same as aidols AvatarView) */}
                  <video
                    ref={avatar.videoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
                      showLiveVideo ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {/* Photo / idle while not speaking */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarPhoto}
                    alt={displayName}
                    className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
                      showLiveVideo ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  {(avatar.isLoading || busy === "session") && !avatar.isReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <IconLoader className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                  {avatar.isConnected && !avatar.isReady && !avatar.isLoading && !avatar.error && busy !== "session" && (
                    <div className="absolute inset-x-0 bottom-6 flex justify-center">
                      <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75 backdrop-blur-sm">
                        Preparing avatar…
                      </span>
                    </div>
                  )}
                  {avatar.error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center">
                      <p className="text-xs text-red-300">{avatar.error}</p>
                      <button
                        type="button"
                        onClick={() => void avatar.startSession(session?.session_id)}
                        className="rounded-full bg-[#6c47ff] px-4 py-1.5 text-xs font-semibold text-white"
                      >
                        Retry video
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative mt-4 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isTalking || waiting || busy === "session" ? "animate-pulse bg-[#6c47ff]" : "bg-emerald-400"
                    }`}
                  />
                  {statusLabel}
                </div>
                <h3 className="mt-5 font-serif text-3xl font-semibold italic text-white">{displayName}</h3>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{displayTag}</p>
                {isTalking && (
                  <button
                    type="button"
                    onClick={() => stopAudio()}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#6c47ff] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
                  >
                    <IconSquare className="h-2.5 w-2.5 fill-current" /> Stop voice
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-8">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a8a3d4]">Live session</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6c47ff]">
                  <IconVolume className="h-3.5 w-3.5" /> Voice on
                </span>
              </div>

              <div ref={scrollRef} className="mt-6 flex-1 space-y-3 overflow-y-auto pr-1 lg:max-h-[360px] lg:min-h-[300px]">
                {lines.length === 0 && !waiting && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-sm leading-relaxed text-[#b9b6d6]">
                      Ask anything — the reply is generated and voiced live. Tap any answer to hear it again.
                    </p>
                  </div>
                )}

                {lines
                  .filter((l) => l.role !== "system")
                  .map((line) => (
                    <div key={line.id} className={`flex animate-fade-in ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (line.role === "assistant") showWip("Replay answer");
                        }}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-left text-sm leading-relaxed transition-colors ${
                          line.role === "user"
                            ? "bg-white/10 text-white"
                            : "border border-[#6c47ff]/40 bg-[#6c47ff]/15 text-white hover:bg-[#6c47ff]/25"
                        }`}
                      >
                        {line.text}
                      </button>
                    </div>
                  ))}

                {waiting && (
                  <p className="inline-flex items-center gap-2 text-sm text-[#a8a3d4]">
                    <IconLoader className="h-4 w-4 animate-spin text-[#6c47ff]" />
                    {displayName} is thinking…
                  </p>
                )}
              </div>

              <form
                className="mt-6 flex items-center gap-3 rounded-full border border-white/10 bg-[#0d1030] px-5 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={waiting}
                  placeholder="Talk with Messi…"
                  aria-label="Message Messi"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={waiting || !draft.trim()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#6c47ff] text-white transition-opacity disabled:opacity-40"
                  aria-label="Send"
                >
                  <IconSend className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                {MESSI_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-full border border-white/12 px-3.5 py-1.5 text-xs text-[#b9b6d6] transition-colors hover:border-[#6c47ff]/60 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void startSession()}
              className="inline-flex items-center gap-2 rounded-md bg-[#6c47ff] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#7d5cff] disabled:opacity-50"
            >
              {busy === "session" ? "Starting…" : session ? "Restart session" : "Start a session"}{" "}
              <IconArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => showWip("Explore the platform")}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/5"
            >
              Explore the platform
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 text-xs text-white/45 md:flex-row md:px-10">
          <p>© 2026 VOXLY. All rights reserved.</p>
          <div className="flex gap-6">
            <button type="button" onClick={() => showWip("Terms")} className="hover:text-white">
              Terms
            </button>
            <button type="button" onClick={() => showWip("Privacy")} className="hover:text-white">
              Privacy
            </button>
          </div>
        </div>
      </footer>

      {/* Work in progress modal */}
      {wipFeature && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#080a1e]/75 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wip-title"
          onClick={() => setWipFeature(null)}
        >
          <div
            className="w-full max-w-md animate-fade-in rounded-[24px] border border-white/10 bg-[#0b0e2a] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c47ff]">Work in progress</p>
                <h3 id="wip-title" className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Not available yet
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setWipFeature(null)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#b9b6d6]">
              <span className="text-white/90">{wipFeature}</span> isn&apos;t live on this demo yet. The Messi live session is available —
              everything else is still being built.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setWipFeature(null);
                  document.getElementById("talk")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-md bg-[#6c47ff] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7d5cff]"
              >
                Talk with Messi <IconArrowUpRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setWipFeature(null)}
                className="inline-flex items-center rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/5"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
