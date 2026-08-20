"use client";

import { useEffect, useRef, useState } from "react";

export interface AvatarMediaStackProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  isTalking: boolean;
  staticPhotoUrl?: string;
  celebrityName?: string;
  idleAssetUrl?: string;
  idleAssetStatus?: string;
  overlayVideoUrl?: string;
  overlayVideoMuted?: boolean;
  overlayVideoLoop?: boolean;
  onOverlayVideoEnded?: () => void;
  preloadUrls?: string[];
  /** object-fit for media inside the circle */
  objectClassName?: string;
}

/**
 * Same layer + transition stack as aidols-user-frontend AvatarView:
 * - idle fades with live (duration-500), stays under overlay
 * - live fades in only while isReady && isTalking
 * - overlay uses double-buffer crossfade + 500ms fade-out (no hard cut)
 */
export function AvatarMediaStack({
  videoRef,
  isReady,
  isTalking,
  staticPhotoUrl,
  celebrityName,
  idleAssetUrl,
  idleAssetStatus,
  overlayVideoUrl,
  overlayVideoMuted = false,
  overlayVideoLoop = false,
  onOverlayVideoEnded,
  preloadUrls,
  objectClassName = "object-contain",
}: AvatarMediaStackProps) {
  const showLive = isReady && isTalking;
  const idleReady = idleAssetStatus === "ready" && !!idleAssetUrl;
  /** Prefer idle/live over any still — never flash a photo when an idle clip exists. */
  const preferIdleOrLive = idleReady || !!idleAssetUrl;

  const [layerA, setLayerA] = useState<{ url: string; muted: boolean; loop: boolean } | null>(
    overlayVideoUrl ? { url: overlayVideoUrl, muted: !!overlayVideoMuted, loop: !!overlayVideoLoop } : null,
  );
  const [layerB, setLayerB] = useState<{ url: string; muted: boolean; loop: boolean } | null>(null);
  const [activeLayer, setActiveLayer] = useState<"A" | "B">(overlayVideoUrl ? "A" : "B");
  const [visibleLayer, setVisibleLayer] = useState<"A" | "B" | null>(overlayVideoUrl ? "A" : null);

  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const duckingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (overlayVideoUrl === prevUrlRef.current) return;
    prevUrlRef.current = overlayVideoUrl;

    if (overlayVideoUrl) {
      const nextProps = { url: overlayVideoUrl, muted: !!overlayVideoMuted, loop: !!overlayVideoLoop };
      if (activeLayer === "A") {
        setLayerB(nextProps);
        setActiveLayer("B");
      } else {
        setLayerA(nextProps);
        setActiveLayer("A");
      }
    } else {
      setVisibleLayer(null);

      const outgoingVideo = activeLayer === "A" ? videoRefA.current : videoRefB.current;
      if (outgoingVideo && !outgoingVideo.muted && outgoingVideo.volume > 0) {
        if (duckingIntervalRef.current) clearInterval(duckingIntervalRef.current);
        const steps = 20;
        const stepTime = 500 / steps;
        const volumeStep = outgoingVideo.volume / steps;
        duckingIntervalRef.current = setInterval(() => {
          if (outgoingVideo && outgoingVideo.volume > volumeStep) {
            outgoingVideo.volume -= volumeStep;
          } else if (outgoingVideo) {
            outgoingVideo.volume = 0;
            if (duckingIntervalRef.current) clearInterval(duckingIntervalRef.current);
          }
        }, stepTime);
      }

      const timeout = setTimeout(() => {
        if (activeLayer === "A") setLayerA(null);
        else setLayerB(null);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [overlayVideoUrl, activeLayer, overlayVideoMuted, overlayVideoLoop]);

  useEffect(
    () => () => {
      if (duckingIntervalRef.current) clearInterval(duckingIntervalRef.current);
    },
    [],
  );

  const handleCanPlayA = () => {
    if (activeLayer === "A") {
      setVisibleLayer("A");
      if (videoRefA.current) videoRefA.current.volume = 1;
      setTimeout(() => setLayerB(null), 500);
    }
  };

  const handleCanPlayB = () => {
    if (activeLayer === "B") {
      setVisibleLayer("B");
      if (videoRefB.current) videoRefB.current.volume = 1;
      setTimeout(() => setLayerA(null), 500);
    }
  };

  const hasOverlay = !!layerA || !!layerB;

  return (
    <>
      {/* Idle — fade only vs live (stays under overlay), same as user app */}
      {idleReady && (
        <video
          src={idleAssetUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full ${objectClassName} transition-opacity duration-500 ${
            showLive ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 h-full w-full ${objectClassName} transition-opacity duration-500 ${
          showLive ? "opacity-100" : "opacity-0"
        }`}
      />

      {staticPhotoUrl && !showLive && !preferIdleOrLive && !hasOverlay && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticPhotoUrl}
          alt={celebrityName || "celebrity"}
          className={`absolute inset-0 h-full w-full ${objectClassName}`}
        />
      )}

      {preloadUrls?.map((url) => (
        <video key={`preload-${url}`} src={url} preload="auto" muted playsInline className="hidden" />
      ))}

      {layerA && (
        <video
          ref={videoRefA}
          src={layerA.url}
          autoPlay
          playsInline
          preload="auto"
          muted={layerA.muted}
          loop={layerA.loop}
          onEnded={layerA.loop ? undefined : onOverlayVideoEnded}
          onCanPlay={handleCanPlayA}
          className={`absolute inset-0 z-10 h-full w-full ${objectClassName} transition-opacity duration-500 ${
            visibleLayer === "A" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {layerB && (
        <video
          ref={videoRefB}
          src={layerB.url}
          autoPlay
          playsInline
          preload="auto"
          muted={layerB.muted}
          loop={layerB.loop}
          onEnded={layerB.loop ? undefined : onOverlayVideoEnded}
          onCanPlay={handleCanPlayB}
          className={`absolute inset-0 z-10 h-full w-full ${objectClassName} transition-opacity duration-500 ${
            visibleLayer === "B" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </>
  );
}
