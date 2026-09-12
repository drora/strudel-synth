/**
 * Jam improv fidget plate — pure layout + voice/hit helpers.
 * 8 pads (2×4), never reflows. Slot 1 = root; slot 8 = +1 octave tonic.
 */
import type { ScaleKind } from './kits-types'
import { SCALE_DEGREES, NOTE_NAMES, rootIndex } from './note-harmony'
import { noteAt } from './kit-suggest-core'
import type { WalkCenter } from './song-seed'
import { setEffectInCode } from './code-effects'

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
  /** Hold length in seconds. */
  dur?: number
  velocity?: number
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

/** SuperDough hap for an instant pad hit (no jam re-eval). */
export function improvVoiceHap(
  note: string,
  voice: string,
): { s: string; note: string; n?: number } {
  const sliced = voice.match(/^(.+):(\d+)$/)
  if (sliced) {
    return { s: sliced[1]!, note, n: Number(sliced[2]) }
  }
  return { s: voice, note }
}

/** Synth → note().sound(); jam_mic_* → note().s(). Used by Keep. */
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
function stretchMark(dur: number, minDur: number): string {
  const r = Math.max(dur, 0.05) / Math.max(minDur, 0.05)
  if (r < 1.45) return ''
  if (r < 2.4) return '@2'
  if (r < 3.4) return '@3'
  return '@4'
}

function roundVel(v: number): number {
  return Math.round(Math.min(1.5, Math.max(0.05, v)) * 20) / 20
}

/**
 * One-cycle-ish pattern from recent pad hits.
 * Hold length → mini `@` stretches; velocity → `.velocity(...)`.
 */
export function hitsToNoteCode(hits: ImprovHit[], voice: string): string {
  if (hits.length === 0) return improvVoiceCode('c4', voice)
  const lastCycle = hits[hits.length - 1]!.cycle
  const windowed = hits.filter((h) => h.cycle >= lastCycle - 1)
  const use =
    windowed.length > 0 ? windowed.slice(-8) : hits.slice(-8)
  const durs = use.map((h) => h.dur ?? 0.25)
  const minDur = Math.min(...durs)
  const anyLong = durs.some((d) => d / minDur >= 1.45)
  const tokens = use.map((h, i) => {
    const mark = anyLong ? stretchMark(durs[i]!, minDur) : ''
    return `${h.note}${mark}`
  })
  let code = improvVoiceCode(tokens.join(' '), voice)
  const vels = use.map((h) => roundVel(h.velocity ?? 1))
  const allDefault = vels.every((v) => Math.abs(v - 1) < 0.06)
  if (!allDefault) {
    const same = vels.every((v) => v === vels[0])
    code += same
      ? `.velocity(${vels[0]})`
      : `.velocity("${vels.join(' ')}")`
  }
  if (anyLong) code += '.clip(1)'
  return code
}


/** Mix applied to pad one-shots and baked into Keep. */
export type ImprovPadMix = {
  volume: number
  velocity: number
  lpf?: number | null
  hpf?: number | null
  room?: number | null
  delay?: number | null
}

export const IMPROV_MIX_DEFAULT: ImprovPadMix = { volume: 0.9, velocity: 0.85 }

export const IMPROV_VOL_STEPS = [0, 0.25, 0.5, 0.75, 0.9, 1, 1.25, 1.5]
export const IMPROV_VEL_STEPS = [0.3, 0.5, 0.7, 0.85, 1, 1.2]

export const IMPROV_FX_CONTROLS: Array<{
  key: keyof Pick<ImprovPadMix, 'lpf' | 'hpf' | 'room' | 'delay'>
  label: string
  steps: number[]
  off: number
}> = [
  { key: 'lpf', label: 'LPF', steps: [200, 400, 800, 1200, 2000, 4000, 8000, 12000], off: 12000 },
  { key: 'hpf', label: 'HPF', steps: [20, 100, 200, 400, 800, 1600, 3200], off: 20 },
  { key: 'room', label: 'Room', steps: [0, 0.15, 0.3, 0.45, 0.6, 0.9, 1.2], off: 0 },
  { key: 'delay', label: 'Delay', steps: [0, 0.1, 0.2, 0.35, 0.5, 0.7], off: 0 },
]

export function isImprovFxOn(
  key: (typeof IMPROV_FX_CONTROLS)[number]['key'],
  value: number | null | undefined,
): boolean {
  const spec = IMPROV_FX_CONTROLS.find((c) => c.key === key)
  if (spec == null || value == null) return false
  return value !== spec.off
}

/** SuperDough hap + mix (volume → gain; unset/off FX omitted). */
export function improvVoiceHapWithMix(
  note: string,
  voice: string,
  mix: ImprovPadMix = IMPROV_MIX_DEFAULT,
): Record<string, unknown> {
  const hap: Record<string, unknown> = {
    ...improvVoiceHap(note, voice),
    gain: mix.volume,
  }
  for (const spec of IMPROV_FX_CONTROLS) {
    const v = mix[spec.key]
    if (isImprovFxOn(spec.key, v)) hap[spec.key] = v
  }
  return hap
}

/** Bake pad mix onto Keep code. Volume stays on the track, not `.gain()`. */
export function applyImprovMixToCode(
  code: string,
  mix: ImprovPadMix = IMPROV_MIX_DEFAULT,
): string {
  let out = code
  for (const spec of IMPROV_FX_CONTROLS) {
    const v = mix[spec.key]
    if (isImprovFxOn(spec.key, v) && v != null) {
      out = setEffectInCode(out, spec.key, v)
    }
  }
  return out
}

export { NOTE_NAMES, noteAt, SCALE_DEGREES }
