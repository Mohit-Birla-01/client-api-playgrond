"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  VideoQuality,
} from "livekit-client";
import type { AvatarDataEvent } from "@/lib/types";

interface UseLiveKitAvatarOptions {
  celebrityId: string;
  sessionId: string | null;
}

interface UseLiveKitAvatarReturn {
  isReady: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isTalking: boolean;
  /** True between render_failed and next speech_start — fall back to photo + WS audio. */
  renderFailed: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Pass sessionId when calling right after create — avoids React state race. */
  startSession: (sessionIdOverride?: string) => Promise<void>;
  stopSession: () => Promise<void>;
}

/**
 * Same subscriber logic as aidols-user / aidols-frontend:
 * - mint viewer JWT, join session room
 * - skip H.264 green init frames before isReady
 * - drive isTalking from worker speech_start / speech_end (data channel)
 * - Avatar UI shows live video only while isReady && isTalking
 */
export function useLiveKitAvatar({
  celebrityId,
  sessionId,
}: UseLiveKitAvatarOptions): UseLiveKitAvatarReturn {
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const startPendingRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSession = useCallback(async (sessionIdOverride?: string) => {
    const currentSessionId = sessionIdOverride ?? sessionIdRef.current;
    if (sessionIdOverride) {
      sessionIdRef.current = sessionIdOverride;
    }
    if (!currentSessionId) {
      startPendingRef.current = true;
      setIsLoading(true);
      return;
    }
    startPendingRef.current = false;

    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch {
        // ignore
      }
      roomRef.current = null;
    }
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setIsReady(false);
    setIsTalking(false);
    setRenderFailed(false);
    setIsConnected(false);

    try {
      setIsLoading(true);
      setError(null);

      const tokenRes = await fetch(
        `/api/sessions/${currentSessionId}/livekit-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ celebrity_id: celebrityId }),
        },
      );
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => "");
        throw new Error(`Token request failed: ${tokenRes.status} ${body}`);
      }
      const { ws_url, token } = await tokenRes.json();
      if (!token || !ws_url) {
        throw new Error("Backend returned incomplete LiveKit credentials");
      }

      // Match consumer/admin: full-res layer, no adaptive downscale in the circle.
      const room = new Room({ adaptiveStream: false, dynacast: false });
      roomRef.current = room;

      const onTrackSubscribed = (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        _participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Video) {
          try {
            publication.setVideoQuality?.(VideoQuality.HIGH);
          } catch {
            // older client
          }
          const videoEl = videoRef.current;
          if (videoEl) {
            track.attach(videoEl);
            void videoEl.play().catch(() => {});
          }

          // reveal() only flips isReady — isTalking comes from speech_start/end.
          const reveal = () => {
            if (revealTimerRef.current) {
              clearTimeout(revealTimerRef.current);
              revealTimerRef.current = null;
            }
            setIsReady(true);
            setIsLoading(false);
          };

          if (videoEl) {
            const vid = videoEl as HTMLVideoElement & {
              requestVideoFrameCallback?: (cb: () => void) => number;
            };
            const sampleCanvas = document.createElement("canvas");
            sampleCanvas.width = 8;
            sampleCanvas.height = 8;
            const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

            const isGreenInitFrame = (): boolean => {
              if (!sampleCtx) return true;
              try {
                sampleCtx.drawImage(vid, 0, 0, 8, 8);
                const { data } = sampleCtx.getImageData(0, 0, 8, 8);
                let greenPx = 0;
                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i],
                    g = data[i + 1],
                    b = data[i + 2];
                  if (g > 150 && g > r * 3 && g > b * 3) greenPx++;
                }
                return greenPx > 32;
              } catch {
                return true;
              }
            };

            if (typeof vid.requestVideoFrameCallback === "function") {
              const waitForRealFrame = () => {
                if (vid.readyState < 2 || isGreenInitFrame()) {
                  vid.requestVideoFrameCallback!(waitForRealFrame);
                } else {
                  reveal();
                }
              };
              vid.requestVideoFrameCallback(waitForRealFrame);
            } else {
              const poll = () => {
                if (!isGreenInitFrame()) reveal();
                else requestAnimationFrame(poll);
              };
              videoEl.addEventListener("loadeddata", () => requestAnimationFrame(poll), {
                once: true,
              });
            }
            if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
            revealTimerRef.current = setTimeout(reveal, 4000);
          } else {
            reveal();
          }
        } else if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = "none";
          document.body.appendChild(el);
          void (el as HTMLMediaElement).play().catch(() => {});
        }
      };

      const onTrackUnsubscribed = (track: RemoteTrack) => {
        track.detach().forEach((el) => {
          if (el !== videoRef.current) el.remove();
        });
        if (track.kind === Track.Kind.Video) {
          if (revealTimerRef.current) {
            clearTimeout(revealTimerRef.current);
            revealTimerRef.current = null;
          }
          setIsTalking(false);
          setIsReady(false);
        }
      };

      const onDataReceived = (payload: Uint8Array) => {
        let evt: AvatarDataEvent | null = null;
        try {
          evt = JSON.parse(new TextDecoder().decode(payload)) as AvatarDataEvent;
        } catch {
          return;
        }
        if (!evt || typeof evt.type !== "string") return;
        switch (evt.type) {
          case "speech_start":
            setRenderFailed(false);
            setIsTalking(true);
            break;
          case "speech_end":
            setIsTalking(false);
            break;
          case "render_failed":
            setRenderFailed(true);
            setIsTalking(false);
            break;
          default:
            break;
        }
      };

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.on(RoomEvent.DataReceived, onDataReceived);
      room.on(RoomEvent.Disconnected, () => {
        if (revealTimerRef.current) {
          clearTimeout(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        setIsReady(false);
        setIsConnected(false);
        setIsTalking(false);
      });

      await room.connect(ws_url, token);
      setIsConnected(true);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error starting LiveKit");
      setIsLoading(false);
    }
  }, [celebrityId]);

  const stopSession = useCallback(async () => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsReady(false);
    setIsConnected(false);
    setIsTalking(false);
    setRenderFailed(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (sessionId && startPendingRef.current) {
      void startSession();
    }
  }, [sessionId, startSession]);

  return {
    isReady,
    isConnected,
    isLoading,
    isTalking,
    renderFailed,
    error,
    videoRef,
    startSession,
    stopSession,
  };
}
