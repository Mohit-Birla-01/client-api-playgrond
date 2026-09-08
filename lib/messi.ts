/** Messi-only experience — partner API celebrity slug. */
/** Override with NEXT_PUBLIC_MESSI_CELEBRITY_ID; falls back to Lionel Messi. */
export const MESSI_CELEBRITY_ID =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MESSI_CELEBRITY_ID?.trim()) ||
  "lionel_messi";

export const MESSI_DISPLAY_NAME = "Lionel Messi";
export const MESSI_TAG = "La Pulga. El mejor del mundo, de Rosario para el mundo.";
/** Local fallback only — prefer celebrity.photo_url from Aidols API. */
export const MESSI_AVATAR_SRC = "/voxly/messi-avatar.jpg";
export const MESSI_HERO_SRC = "/voxly/hero.jpg";
export const MESSI_LANGUAGE = "es" as const;

export const MESSI_PROMPTS = [
  "What does match day feel like?",
  "One tip to improve my first touch?",
  "Who was your childhood idol?",
  "How do you stay calm in a final?",
] as const;
