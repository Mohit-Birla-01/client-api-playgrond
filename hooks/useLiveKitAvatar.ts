"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
} from "livekit-client";

interface UseLiveKitAvatarOptions {
  celebrityId: string;
  sessionId: string | null;
}

interface UseLiveKitAvatarReturn {
  isReady: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isTalking: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Pass sessionId when calling right after create — avoids React state race. */
  startSession: (sessionIdOverride?: string) => Promise<void>;
  stopSession: () => Promise<void>;
}

/**
 * Same subscriber logic as the consumer chat: mint a viewer JWT, join the
 * session room, attach video to the always-mounted <video>, skip H.264 green
 * init frames, and drive isTalking from decoded-frame activity.
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
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const startPendingRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameMonitorRef = useRef<{ stop: () => void } | null>(null);

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

    // Tear down any prior room before joining again.
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch {
        // ignore
      }
      roomRef.current = null;
    }
    if (frameMonitorRef.current) {
      frameMonitorRef.current.stop();
      frameMonitorRef.current = null;
    }
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setIsReady(false);
    setIsTalking(false);
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

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const onTrackSubscribed = (
        track: RemoteTrack,
        _publication: RemoteTrackPublication,
        _participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Video) {
          const videoEl = videoRef.current;
          if (videoEl) {
            track.attach(videoEl);
            void videoEl.play().catch(() => {
              // Autoplay may be blocked until a user gesture; Start session is a gesture.
            });
          }

          const startFrameMonitor = () => {
            const vidEl = videoRef.current;
            if (!vidEl) return;
            if (frameMonitorRef.current) frameMonitorRef.current.stop();

            const readDecodedFrames = (): number => {
              try {
                if (typeof vidEl.getVideoPlaybackQuality === "function") {
                  return vidEl.getVideoPlaybackQuality().totalVideoFrames;
                }
              } catch {
                // fall through
              }
              return vidEl.currentTime;
            };

            let lastFrames = readDecodedFrames();
            let lastAdvancedAt = performance.now();
            let stopped = false;
            let idleMode = false;

            const intervalId = setInterval(() => {
              if (stopped) return;
              const frames = readDecodedFrames();
              const now = performance.now();
              if (frames !== lastFrames) {
                lastFrames = frames;
                lastAdvancedAt = now;
                if (idleMode) {
                  idleMode = false;
                  setIsTalking(true);
                }
              } else if (!idleMode && now - lastAdvancedAt > 1200) {
                idleMode = true;
                setIsTalking(false);
              }
            }, 100);

            frameMonitorRef.current = {
              stop: () => {
                stopped = true;
                clearInterval(intervalId);
              },
            };
          };

          const reveal = () => {
            if (revealTimerRef.current) {
              clearTimeout(revealTimerRef.current);
              revealTimerRef.current = null;
            }
            setIsReady(true);
            setIsTalking(true);
            setIsLoading(false);
            startFrameMonitor();
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
                  const r = data[i], g = data[i + 1], b = data[i + 2];
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
            revealTimerRef.current = setTimeout(reveal, 12000);
          } else {
            reveal();
          }
        } else if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = "none";
          document.body.appendChild(el);
          void (el as HTMLMediaElement).play().catch(() => {
            // Same gesture / autoplay caveat as video.
          });
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
          if (frameMonitorRef.current) {
            frameMonitorRef.current.stop();
            frameMonitorRef.current = null;
          }
          setIsTalking(false);
          setIsReady(false);
        }
      };

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.on(RoomEvent.Disconnected, () => {
        if (revealTimerRef.current) {
          clearTimeout(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        if (frameMonitorRef.current) {
          frameMonitorRef.current.stop();
          frameMonitorRef.current = null;
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
    if (frameMonitorRef.current) {
      frameMonitorRef.current.stop();
      frameMonitorRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsReady(false);
    setIsConnected(false);
    setIsTalking(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      if (frameMonitorRef.current) {
        frameMonitorRef.current.stop();
        frameMonitorRef.current = null;
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
    error,
    videoRef,
    startSession,
    stopSession,
  };
}
