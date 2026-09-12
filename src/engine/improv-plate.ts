/**
 * Jam improv fidget plate — pure layout + voice/hit helpers.
 * 8 pads (2×4), never reflows. Slot 1 = root; slot 8 = +1 octave tonic.
 */
import type { ScaleKind } from './kits-types'
import { SCALE_DEGREES, NOTE_NAMES, rootIndex } from './note-harmony'
import { noteAt } from './kit-suggest-core'
import type { WalkCenter } from './song-seed'

export type ImprovPad = {
  /** 1–8 logical slot (bottom-left = 1 … top-right = 8). */
  slot: number
  /** Concert note label, or null when dimmed/disabled. */
  note: string | null
  enabled: boolean
  /** Walk triad PC (root/3rd/5th) — fat purple glow. */
  walkGlow: boolean
  label: string
}

export type ImprovHit = {
  note: string
  cycle: number
}

/** Pitch-classes of walk triad tones (same math as walkTriadPcs in kit-suggest-pools). */
export function walkTriadPcs(root: string, walk: WalkCenter[]): Set<number> {
  const r = rootIndex(root)
  const walkPcs = new Set<number>()
  for (const c of walk) {
    const base = (r + c.degree) % 12
    const third = c.quality === 'maj' ? 4 : 3
    for (const pc of [base, (base + third) % 12, (base + 7) % 12]) {
      walkPcs.add(pc)
    }
  }
  return walkPcs
}

function notePc(note: string): number | null {
  const m = note.toLowerCase().match(/^([a-g](?:#|b)?)/)
  if (!m) return null
  return rootIndex(m[1]!)
}

/**
 * Always 8 pads. Heptatonic: slots 1–7 = scale degrees, 8 = tonic+oct.
 * Pentatonic: 6 live (degrees + octave) — slots 6–7 dimmed; layout never jumps.
 */
export function layoutImprovPads(
  root: string,
  scale: ScaleKind,
  octave: number,
  walk?: WalkCenter[] | null,
): ImprovPad[] {
  const degs = SCALE_DEGREES[scale] ?? SCALE_DEGREES.minor
  const triad =
    walk && walk.length > 0 ? walkTriadPcs(root, walk) : new Set<number>()
  const isPenta = degs.length <= 5

  const pads: ImprovPad[] = []
  for (let slot = 1; slot <= 8; slot++) {
    let note: string | null = null
    let enabled = false

    if (slot === 8) {
      note = noteAt(root, 0, octave + 1)
      enabled = true
    } else if (isPenta) {
      // slots 1–5 = degrees; 6–7 dim
      if (slot <= degs.length) {
        note = noteAt(root, degs[slot - 1]!, octave)
        enabled = true
      }
    } else {
      // heptatonic: slots 1–7 = degrees
      if (slot <= degs.length) {
        note = noteAt(root, degs[slot - 1]!, octave)
        enabled = true
      }
    }

    const pc = note ? notePc(note) : null
    const walkGlow = enabled && pc != null && triad.has(pc)
    pads.push({
      slot,
      note,
      enabled,
      walkGlow,
      label: note ?? '',
    })
  }
  return pads
}

/** Synth → note().sound(); jam_mic_* → note().s(). */
export function improvVoiceCode(note: string, voice: string): string {
  if (voice.startsWith('jam_mic_')) {
    return `note("${note}").s("${voice}")`
  }
  return `note("${note}").sound("${voice}")`
}

/**
 * One-cycle-ish pattern from recent pad hits.
 * Prefers last ~1–2 cycles; else last 8 notes in order.
 */
export function hitsToNoteCode(hits: ImprovHit[], voice: string): string {
  if (hits.length === 0) return improvVoiceCode('c4', voice)
  const lastCycle = hits[hits.length - 1]!.cycle
  const windowed = hits.filter((h) => h.cycle >= lastCycle - 1)
  const use =
    windowed.length > 0 ? windowed.slice(-8) : hits.slice(-8)
  const notes = use.map((h) => h.note).join(' ')
  return improvVoiceCode(notes, voice)
}

export { NOTE_NAMES, noteAt, SCALE_DEGREES }
