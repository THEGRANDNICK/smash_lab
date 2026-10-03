/**
 * Stop-motion easing for framer-motion: progress jumps in `frames` discrete steps instead of
 * gliding — the cut-out look applied to page and card transitions.
 */
export const stopMotion =
  (frames = 4) =>
  (t: number): number =>
    t >= 1 ? 1 : Math.floor(t * frames) / frames
