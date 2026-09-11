/**
 * Per-track Lock vs Shuffle: every pattern-regen path (song Shuffle,
 * Mix "Shuffle this", Code pane Shuffle, WebMCP shuffle_sounds) must
 * skip locked tracks. Kit switch / applyKit may still rewrite.
 */
export function isTrackShuffleLocked(
  track: { locked?: boolean } | null | undefined,
): boolean {
  return !!track?.locked
}

export type ShufflePlan<T extends { id: string; name: string; locked?: boolean }> =
  | { ok: true; targets: T[] }
  | { ok: false; error: string }

/**
 * Song shuffle (no trackId) → all unlocked.
 * Per-track shuffle → that lane, or error if missing/locked.
 */
export function planShuffleTargets<
  T extends { id: string; name: string; locked?: boolean },
>(tracks: readonly T[], trackId?: string): ShufflePlan<T> {
  if (trackId) {
    const track = tracks.find((t) => t.id === trackId)
    if (!track) return { ok: false, error: `Track not found: ${trackId}` }
    if (isTrackShuffleLocked(track)) {
      return { ok: false, error: `Track locked: ${track.name}` }
    }
    return { ok: true, targets: [track] }
  }
  return { ok: true, targets: tracks.filter((t) => !isTrackShuffleLocked(t)) }
}
