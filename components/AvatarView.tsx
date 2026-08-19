"use client";

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
  tagline?: string;
}

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
  tagline,
}: AvatarViewProps) {
  const speakingGlow = isTalking
    ? "shadow-[0_0_32px_4px_rgba(255,149,0,0.30)] ring-1 ring-[var(--accent)]/50"
    : "";

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gray-900 transition-shadow duration-500 ${speakingGlow}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-[4.5rem] pt-8 sm:pb-[5.5rem] sm:pt-10">
        <div
          className={`pointer-events-auto relative aspect-square h-full max-h-[260px] shrink-0 overflow-hidden rounded-full border-4 bg-black/20 transition-all duration-500 sm:max-h-[280px] md:max-h-[300px] ${speakingGlow}`}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`h-full w-full object-contain transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"}`}
          />
          {staticPhotoUrl && !isReady && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={staticPhotoUrl}
              alt={celebrityName || "celebrity"}
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
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
                className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm text-black hover:opacity-80"
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
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            <span className="text-xs text-white/70">Preparing avatar…</span>
          </div>
        </div>
      )}

      {!staticPhotoUrl && !isLoading && !error && !isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-bubble-avatar)] font-display text-3xl font-bold text-[var(--accent)]">
              {celebrityInitials}
            </div>
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3">
        <span className="rounded-full border border-[var(--accent)]/40 bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] backdrop-blur-sm">
          Digital Twin
        </span>
      </div>

      {(celebrityName || tagline) && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-10 text-center">
          {celebrityName && (
            <p className="font-display text-base font-bold leading-tight text-white sm:text-lg">
              {celebrityName}
            </p>
          )}
          {tagline && <p className="mt-0.5 line-clamp-1 text-xs text-white/60">{tagline}</p>}
        </div>
      )}

      {isTalking && (
        <div className="pointer-events-none absolute bottom-[5.5rem] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="text-xs font-medium text-white">Speaking</span>
        </div>
      )}
    </div>
  );
}
