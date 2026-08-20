"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CelebrityAssets } from "@/lib/types";
import {
  ASSET_AUDIO,
  FILLER_SHOW_DELAY_MS,
  PROACTIVE_IDLE_MS,
  getAssetUrls,
  pickNextAssetUrl,
} from "@/lib/asset-videos";

export type OverlayVideoKind = "greeting" | "filler" | "proactive";

export interface OverlayVideo {
  url: string;
  kind: OverlayVideoKind;
  caption?: string;
  loop: boolean;
  muted: boolean;
}

interface UseAvatarAssetVideosParams {
  assets: CelebrityAssets | undefined;
  locale: string;
  enabled: boolean;
  isWaiting: boolean;
  isTalking: boolean;
  showLive: boolean;
}

interface UseAvatarAssetVideosReturn {
  overlay: OverlayVideo | null;
  playGreeting: (url: string, caption?: string) => void;
  handleEnded: () => void;
  notifyActivity: () => void;
  preloadUrls: string[];
}

/**
 * Same priority as aidols-user-frontend:
 *   greeting > filler (while turn resolves / before live paints) > proactive
 */
export function useAvatarAssetVideos({
  assets,
  locale,
  enabled,
  isWaiting,
  isTalking,
  showLive,
}: UseAvatarAssetVideosParams): UseAvatarAssetVideosReturn {
  const [greeting, setGreeting] = useState<{ url: string; caption?: string } | null>(null);
  const [filler, setFiller] = useState<string | null>(null);
  const [proactive, setProactive] = useState<string | null>(null);

  const lastFillerRef = useRef<string | null>(null);
  const lastProactiveRef = useRef<string | null>(null);
  const fillerDismissedRef = useRef(false);
  const [activityTick, setActivityTick] = useState(0);

  const playGreeting = useCallback((url: string, caption?: string) => {
    setFiller(null);
    setProactive(null);
    setGreeting({ url, caption });
  }, []);

  const notifyActivity = useCallback(() => {
    setActivityTick((t) => t + 1);
  }, []);

  const fillerActive = enabled && !greeting && (isWaiting || isTalking) && !showLive;

  useEffect(() => {
    if (isWaiting) fillerDismissedRef.current = false;
  }, [isWaiting]);

  useEffect(() => {
    if (fillerActive) {
      if (filler || fillerDismissedRef.current) return;
      const timer = setTimeout(() => {
        const pick = pickNextAssetUrl(
          getAssetUrls(assets, "filler_video", locale),
          lastFillerRef.current,
        );
        if (pick) {
          lastFillerRef.current = pick;
          setFiller(pick);
        }
      }, FILLER_SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (filler) setFiller(null);
  }, [fillerActive, filler, assets, locale]);

  useEffect(() => {
    const idle =
      enabled && !isWaiting && !isTalking && !greeting && !proactive;
    if (!idle) return;

    const urls = getAssetUrls(assets, "proactive_video", locale);
    if (urls.length === 0) return;

    const timer = setTimeout(() => {
      const pick = pickNextAssetUrl(urls, lastProactiveRef.current);
      if (pick) {
        lastProactiveRef.current = pick;
        setProactive(pick);
      }
    }, PROACTIVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [enabled, isWaiting, isTalking, greeting, proactive, assets, locale, activityTick]);

  const overlay = useMemo<OverlayVideo | null>(() => {
    if (greeting) {
      return {
        url: greeting.url,
        kind: "greeting",
        caption: greeting.caption,
        loop: false,
        muted: ASSET_AUDIO.greeting.muted,
      };
    }
    if (fillerActive && filler) {
      return {
        url: filler,
        kind: "filler",
        loop: false,
        muted: ASSET_AUDIO.filler.muted,
      };
    }
    if (proactive) {
      return {
        url: proactive,
        kind: "proactive",
        loop: false,
        muted: ASSET_AUDIO.proactive.muted,
      };
    }
    return null;
  }, [greeting, fillerActive, filler, proactive]);

  const overlayKindRef = useRef<OverlayVideoKind | undefined>(overlay?.kind);
  overlayKindRef.current = overlay?.kind;

  const handleEnded = useCallback(() => {
    const kind = overlayKindRef.current;
    if (kind === "greeting") {
      setGreeting(null);
    } else if (kind === "proactive") {
      setProactive(null);
      setActivityTick((t) => t + 1);
    } else if (kind === "filler") {
      fillerDismissedRef.current = true;
      setFiller(null);
    }
  }, []);

  const preloadUrls = useMemo(() => {
    if (!assets) return [];
    return Array.from(
      new Set([
        ...getAssetUrls(assets, "filler_video", locale),
        ...getAssetUrls(assets, "proactive_video", locale),
        ...getAssetUrls(assets, "greeting_video", locale),
      ]),
    );
  }, [assets, locale]);

  return { overlay, playGreeting, handleEnded, notifyActivity, preloadUrls };
}
