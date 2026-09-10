/**
 * Rules for Jam `lastTouchedTrackId` — content edits, not mere Code peek/open.
 *
 * Updates when the user changes a specific track via:
 * - Code sheet apply/edit (setCode from editor), not open/peek alone
 * - Track sheet Sound / FX / mix gain (volume)
 * - Per-track Shuffle this
 * - Spice when it mutates a track (use that track id)
 *
 * Does NOT update for mute/solo alone.
 * Song-level Shuffle / New kit / applyKit: keep previous if still present,
 * else first unlocked track (then first track).
 */

export function resolveCodeOpenTrackId(
  lastTouchedTrackId: string | null | undefined,
  trackIds: string[],
): string | null {
  if (lastTouchedTrackId && trackIds.includes(lastTouchedTrackId)) {
    return lastTouchedTrackId
  }
  return trackIds[0] ?? null
}

/** After song-level reshuffle / New kit: keep mark if still valid, else unlocked/first. */
export function keepOrFallbackLastTouched(
  prev: string | null | undefined,
  trackIds: string[],
  unlockedIds: string[],
): string | null {
  if (prev && trackIds.includes(prev)) return prev
  if (unlockedIds.length > 0) return unlockedIds[0]!
  return trackIds[0] ?? null
}

/** Drop mark when the touched track was removed. */
export function afterTrackRemoved(
  prev: string | null | undefined,
  removedId: string,
): string | null {
  if (!prev || prev === removedId) return null
  return prev
}
