import type { Track } from './types'
import { hasUnbalancedSyntax } from './all-code'
import { sampleGainBoost, soundFromCode } from './improv-plate'

/** Copy tracks; replace empty/unbalanced code with silence. Does not mutate store. */
export function silenceUnplayableTracks(tracks: Track[]): {
  tracks: Track[]
  silencedIds: string[]
} {
  const silencedIds: string[] = []
  const out = tracks.map((t) => {
    const code = t.code.trim()
    if (!code || hasUnbalancedSyntax(t.code)) {
      silencedIds.push(t.id)
      return { ...t, code: 'silence' }
    }
    return t
  })
  return { tracks: out, silencedIds }
}

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
 * Optional `overlay`: when a string (including `silence`), append one extra
 * stack part `(${overlay}).gain(1)` so session track count is unchanged but the
 * evaluated stack has a stable extra lane (improv pad hold).
 *
 * NOTE: Also exported from `strudel.ts` (same implementation). Prefer importing
 * from here in unit tests to avoid pulling the audio engine.
 */
export function composeTracks(tracks: Track[], bpm: number, overlay?: string): string {
  const cps = bpm / 60 / 4
  const header = `setcps(${cps})\n`

  const anySolo = tracks.some((tr) => tr.soloed)
  const effectiveGain = (t: Track): number => {
    if (t.muted) return 0
    if (anySolo && !t.soloed) return 0
    const sound = soundFromCode(t.code)
    return t.volume * (sound ? sampleGainBoost(sound) : 1)
  }

  const trackParts: string[] = []
  if (tracks.length === 0) {
    if (overlay === undefined) return header + 'silence'
    trackParts.push('  silence')
  } else if (tracks.length === 1) {
    const t = tracks[0]!
    const part = `(${t.code}).gain(${effectiveGain(t)})`
    if (overlay === undefined) return `${header}${part}`
    trackParts.push(`  ${part}`)
  } else {
    for (const t of tracks) {
      trackParts.push(`  (${t.code}).gain(${effectiveGain(t)})`)
    }
    if (overlay === undefined) {
      return `${header}stack(\n${trackParts.join(',\n')}\n)`
    }
  }

  // overlay lane (improv hold / silence)
  trackParts.push(`  (${overlay}).gain(1)`)
  return `${header}stack(\n${trackParts.join(',\n')}\n)`
}
