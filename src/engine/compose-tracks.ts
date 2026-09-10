import type { Track } from './types'

/**
 * Build the Strudel code string for the current session.
 *
 * Mute/solo must NEVER change stack arity: dropping a lane (e.g. stack(A,B) →
 * (B).gain(...)) often fails to replace the running pattern in Strudel, so the
 * old stack keeps playing. Always emit one part per track; muted / not-soloed
 * lanes use `.gain(0)`.
 *
 * Structure is stable for a given tracks.length:
 * - 0 → silence
 * - 1 → (code).gain(...)
 * - 2+ → stack( ... one part per track ... )
 *
 * NOTE: Also exported from `strudel.ts` (same implementation). Prefer importing
 * from here in unit tests to avoid pulling the audio engine.
 */
export function composeTracks(tracks: Track[], bpm: number): string {
  const cps = bpm / 60 / 4
  const header = `setcps(${cps})\n`

  if (tracks.length === 0) return header + 'silence'

  const anySolo = tracks.some((tr) => tr.soloed)
  const effectiveGain = (t: Track): number => {
    if (t.muted) return 0
    if (anySolo && !t.soloed) return 0
    return t.volume
  }

  // N===1: always one pattern (mute → gain(0), never drop the lane).
  if (tracks.length === 1) {
    const t = tracks[0]!
    return `${header}(${t.code}).gain(${effectiveGain(t)})`
  }

  // N>=2: always stack every track so mute/solo never changes arity.
  const parts = tracks
    .map((t) => `  (${t.code}).gain(${effectiveGain(t)})`)
    .join(',\n')
  return `${header}stack(\n${parts}\n)`
}
