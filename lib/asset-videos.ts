// Pure helpers for pre-rendered avatar videos (filler / proactive / greeting).
// Mirrors aidols-user-frontend/lib/asset-videos.ts

import type { CelebrityAssets } from "@/lib/types";

export function getAssetUrls(
  assets: CelebrityAssets | undefined,
  assetType: string,
  locale: string,
): string[] {
  const byLocale = assets?.[assetType];
  if (!byLocale) return [];

  const preferred = byLocale[locale]?.urls;
  if (preferred && preferred.length > 0) return preferred;

  for (const key of Object.keys(byLocale)) {
    const urls = byLocale[key]?.urls;
    if (urls && urls.length > 0) return urls;
  }
  return [];
}

export function pickNextAssetUrl(
  urls: string[],
  previousUrl: string | null,
): string | null {
  if (!urls || urls.length === 0) return null;
  if (urls.length === 1) return urls[0];

  const candidates =
    previousUrl != null ? urls.filter((u) => u !== previousUrl) : urls;
  const pool = candidates.length > 0 ? candidates : urls;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export const PROACTIVE_IDLE_MS = 30_000;
export const FILLER_SHOW_DELAY_MS = 300;

export const ASSET_AUDIO = {
  greeting: { muted: false },
  filler: { muted: false },
  proactive: { muted: false },
} as const;
