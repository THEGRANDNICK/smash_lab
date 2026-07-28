// Phase 8 polish — a tiny, pure, deterministic helper deciding whether a
// block of text is long enough to warrant a clamp + "Read more" control.
// Deliberately a character-count heuristic rather than a DOM/ResizeObserver
// measurement: it's cheap, has no layout-thrashing effect, and is easy to
// test and reason about. The actual visual clamping is CSS-only
// (`line-clamp-3`, a core Tailwind utility) — this only decides whether to
// offer the toggle at all.

/** Roughly 3 lines' worth of a card-width paragraph at this app's default text size. */
export const DEFAULT_CLAMP_THRESHOLD = 140

export function needsClamp(text: string | null | undefined, threshold = DEFAULT_CLAMP_THRESHOLD): boolean {
  if (!text) return false
  return text.length > threshold
}
