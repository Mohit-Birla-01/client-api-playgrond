export type TabId = "catalog" | "chat" | "livekit";

export interface TokenStatus {
  configured: boolean;
  prefix: string | null;
}

export interface PartnerMe {
  customer_id: string;
  customer_name: string;
  customer_status: string;
  key_id: string;
  plan_slug: string | null;
  scopes: string[];
}

export interface Celebrity {
  celebrity_id: string;
  display_name: string;
  initials: string;
  category: string | null;
  category_label: string | null;
  short_description: string | null;
  long_description: string | null;
  photo_url: string | null;
  background_image_url: string | null;
  tagline: string | null;
  active: boolean;
  native_language: string | null;
  family_slug: string | null;
  family_label: string | null;
}

export interface SessionInfo {
  session_id: string;
  celebrity_id: string;
  stream_url: string;
  language: string;
}

export interface LiveKitCreds {
  ws_url: string;
  token: string;
  room: string;
  identity: string;
}

export interface ChatLine {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}

/** LiveKit data-channel events from the avatar worker (same as user/admin). */
export interface AvatarSpeechStartEvent {
  type: "speech_start";
}
export interface AvatarSpeechEndEvent {
  type: "speech_end";
}
export interface AvatarRenderFailedEvent {
  type: "render_failed";
  error?: string;
}
export type AvatarDataEvent =
  | AvatarSpeechStartEvent
  | AvatarSpeechEndEvent
  | AvatarRenderFailedEvent;

export async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || body.detail || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
