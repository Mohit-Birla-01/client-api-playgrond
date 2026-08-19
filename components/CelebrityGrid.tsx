"use client";

import type { Celebrity } from "@/lib/types";

interface Props {
  celebs: Celebrity[];
  selected: string;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export default function CelebrityGrid({
  celebs,
  selected,
  loading,
  onSelect,
  onRefresh,
}: Props) {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-white/50">
          {celebs.length === 0
            ? "Entitled celebrities for this API key."
            : `${celebs.length} entitled ${celebs.length === 1 ? "celebrity" : "celebrities"}`}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={onRefresh}
          className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white disabled:opacity-40"
        >
          {loading ? "Loading…" : "Reload catalog"}
        </button>
      </div>

      {celebs.length === 0 && !loading && (
        <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 text-sm text-white/40">
          No entitlements on this key. Add celebrities in Admin → API Partners.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {celebs.map((c) => {
          const active = selected === c.celebrity_id;
          return (
            <button
              key={c.celebrity_id}
              type="button"
              onClick={() => onSelect(c.celebrity_id)}
              className={`group relative overflow-hidden rounded-2xl text-left transition-transform duration-300 hover:scale-[1.03] ${
                active ? "ring-2 ring-[var(--accent)]" : "ring-1 ring-white/10"
              }`}
              style={{ aspectRatio: "3/4" }}
            >
              {c.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.photo_url}
                  alt={c.display_name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--accent)]/25 via-[var(--accent)]/5 to-[var(--bg-primary)]">
                  <span className="font-display text-5xl font-bold text-[var(--accent)]/40">
                    {c.initials || c.display_name.slice(0, 2)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
              {c.family_label && (
                <span className="absolute left-3 top-3 rounded-full bg-[var(--accent)]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                  {c.family_label}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-lg font-bold text-white">{c.display_name}</p>
                <p className="mt-0.5 font-mono text-[10px] text-white/40">{c.celebrity_id}</p>
                {c.tagline && (
                  <p className="mt-1 line-clamp-2 text-xs text-white/60">{c.tagline}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
