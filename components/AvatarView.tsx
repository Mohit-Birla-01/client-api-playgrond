"use client";

import { AvatarMediaStack } from "@/components/AvatarMediaStack";

interface AvatarViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  isConnected?: boolean;
  isLoading: boolean;
  isTalking: boolean;
  error: string | null;
  onRetry?: () => void;
  celebrityName?: string;
  celebrityInitials?: string;
  staticPhotoUrl?: string;
  idleAssetUrl?: string;
  idleAssetStatus?: string;
  overlayVideoUrl?: string;
  overlayVideoMuted?: boolean;
  overlayVideoLoop?: boolean;
  onOverlayVideoEnded?: () => void;
  preloadUrls?: string[];
  tagline?: string;
}

/**
 * Same layer stack + crossfades as aidols-user-frontend AvatarView.
 */
export function AvatarView({
  videoRef,
  isReady,
  isConnected = false,
  isLoading,
  isTalking,
  error,
  onRetry,
  celebrityName,
  celebrityInitials = "AV",
  staticPhotoUrl,
  idleAssetUrl,
  idleAssetStatus,
  overlayVideoUrl,
  overlayVideoMuted = false,
  overlayVideoLoop = false,
  onOverlayVideoEnded,
  preloadUrls,
  tagline,
}: AvatarViewProps) {
  const showLive = isReady && isTalking;
  const idleReady = idleAssetStatus === "ready" && !!idleAssetUrl;
  const hasStaticFallback = !staticPhotoUrl && !idleReady && !isLoading && !error && !showLive && !overlayVideoUrl;

  const speakingGlow = isTalking
    ? "shadow-[0_0_32px_4px_rgba(108,71,255,0.35)] ring-1 ring-[#6c47ff]/50"
    : "";

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gray-900 transition-shadow duration-500 ${speakingGlow}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-[4.5rem] pt-8 sm:pb-[5.5rem] sm:pt-10">
        <div
          className={`pointer-events-auto relative aspect-square h-full max-h-[260px] shrink-0 overflow-hidden rounded-full border-4 bg-black/20 transition-all duration-500 sm:max-h-[280px] md:max-h-[300px] ${speakingGlow}`}
        >
          <AvatarMediaStack
            videoRef={videoRef}
            isReady={isReady}
            isTalking={isTalking}
            staticPhotoUrl={staticPhotoUrl}
            celebrityName={celebrityName}
            idleAssetUrl={idleAssetUrl}
            idleAssetStatus={idleAssetStatus}
            overlayVideoUrl={overlayVideoUrl}
            overlayVideoMuted={overlayVideoMuted}
            overlayVideoLoop={overlayVideoLoop}
            onOverlayVideoEnded={onOverlayVideoEnded}
            preloadUrls={preloadUrls}
          />
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm text-white/60">Connecting avatar…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="px-4 text-center">
            <p className="mb-3 text-sm text-red-400">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full bg-[#6c47ff] px-4 py-1.5 text-sm text-white hover:opacity-80"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {isConnected && !isReady && !isLoading && !error && (
        <div className="pointer-events-none absolute bottom-[5.5rem] left-1/2 z-10 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6c47ff]" />
            <span className="text-xs text-white/70">Preparing avatar…</span>
          </div>
        </div>
      )}

      {hasStaticFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-bubble-avatar)] text-3xl font-bold text-[#6c47ff]">
              {celebrityInitials}
            </div>
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3">
        <span className="rounded-full border border-[#6c47ff]/40 bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#6c47ff] backdrop-blur-sm">
          Digital Twin
        </span>
      </div>

      {(celebrityName || tagline) && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-10 text-center">
          {celebrityName && (
            <p className="text-base font-bold leading-tight text-white sm:text-lg">{celebrityName}</p>
          )}
          {tagline && <p className="mt-0.5 line-clamp-1 text-xs text-white/60">{tagline}</p>}
        </div>
      )}

      {isTalking && (
        <div className="pointer-events-none absolute bottom-[5.5rem] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#6c47ff] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#6c47ff]" />
          </span>
          <span className="text-xs font-medium text-white">Speaking</span>
        </div>
      )}
    </div>
  );
}
