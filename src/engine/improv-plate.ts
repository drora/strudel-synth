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
  /** performance.now() at finger down — starts the phrase, measures gaps. */
  at?: number
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

const PHRASE_GAP_SEC = 1.6

const NOTE_CHROMA: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
}

/** SuperDough array-bank rate: C3 (midi 36) = 1. */
export function noteTransposeRate(note: string): number {
  const m = note.toLowerCase().match(/^([a-g])([#b]?)(-?\d+)$/)
  if (!m) return 1
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  const midi = (Number(m[3]) + 1) * 12 + (NOTE_CHROMA[m[1]!] ?? 0) + acc
  return 2 ** ((midi - 36) / 12)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Same-pitch time-stretch for SuperDough.
 * speed slows the buffer; stretch is pitchFactor-1 (worklet adds 1).
 */
export function smearFromHold(
  holdSec: number,
  takeSec: number,
  note?: string,
): { speed: number; stretch: number } | null {
  if (!(takeSec > 0.05) || holdSec <= takeSec * 1.08) return null
  const trans = note ? noteTransposeRate(note) : 1
  const ratio = holdSec / takeSec
  return {
    speed: round3(takeSec / holdSec / trans),
    stretch: round3(trans * ratio - 1),
  }
}

/** 0 = too small, else 1/2/3/4/6/8 beats at song tempo. */
export function quantizeBeats(sec: number, bpm: number): number {
  const b = sec / (60 / Math.max(bpm, 40))
  if (b < 0.7) return 0
  if (b < 1.4) return 1
  if (b < 2.4) return 2
  if (b < 3.4) return 3
  if (b < 5) return 4
  if (b < 7) return 6
  return 8
}

function stretchMark(dur: number, bpm: number): string {
  const beats = quantizeBeats(dur, bpm)
  return beats <= 1 ? '' : `@${beats}`
}

/** Mini-notation `@n` is relative weight; jam cycle is 4 beats. */
export function tokenBeats(token: string): number {
  const m = token.match(/@(\d+)$/)
  return m ? Number(m[1]) : 1
}

export function phraseCycles(tokens: string[], beatsPerCycle = 4): number {
  const total = tokens.reduce((n, tok) => n + tokenBeats(tok), 0)
  return total / Math.max(beatsPerCycle, 1)
}

function restToken(gapSec: number, bpm: number): string | null {
  const beats = quantizeBeats(gapSec, bpm)
  if (beats <= 0) return null
  return beats === 1 ? '~' : `~@${beats}`
}

function roundVel(v: number): number {
  return Math.round(Math.min(1.5, Math.max(0.05, v)) * 20) / 20
}

/** Last phrase only — a long silence means “I started a new sequence.” */
export function lastImprovPhrase(hits: ImprovHit[]): ImprovHit[] {
  if (hits.length === 0) return []
  const src = hits.slice(-16)
  const timed = src.every((h) => h.at != null)
  if (!timed) {
    const lastCycle = src[src.length - 1]!.cycle
    const windowed = src.filter((h) => h.cycle >= lastCycle - 1)
    return (windowed.length > 0 ? windowed : src).slice(-8)
  }
  let start = 0
  for (let i = 1; i < src.length; i++) {
    const prev = src[i - 1]!
    const cur = src[i]!
    const prevEnd = (prev.at ?? 0) + (prev.dur ?? 0.25) * 1000
    const gap = ((cur.at ?? prevEnd) - prevEnd) / 1000
    if (gap >= PHRASE_GAP_SEC) start = i
  }
  return src.slice(start).slice(-8)
}

/**
 * Phrase from the first note you played (no leading rest).
 * Hold → `@`; gaps after that → `~`; velocity → `.velocity(...)`.
 */
export function hitsToNoteCode(
  hits: ImprovHit[],
  voice: string,
  bpm = 120,
  takeSec?: number,
): string {
  if (hits.length === 0) return improvVoiceCode('c4', voice)
  const use = lastImprovPhrase(hits)
  if (use.length === 0) return improvVoiceCode('c4', voice)
  const durs = use.map((h) => h.dur ?? 0.25)
  const anyLong = durs.some((d) => quantizeBeats(d, bpm) >= 2)
  const tokens: string[] = []
  const vels: number[] = []
  const speeds: number[] = []
  const stretches: number[] = []
  let anySmear = false
  const mic = voice.startsWith('jam_mic_') && takeSec != null
  for (let i = 0; i < use.length; i++) {
    const h = use[i]!
    if (i > 0 && h.at != null && use[i - 1]!.at != null) {
      const prev = use[i - 1]!
      const prevEnd = prev.at! + (prev.dur ?? 0.25) * 1000
      const gap = (h.at - prevEnd) / 1000
      const rest = restToken(gap, bpm)
      if (rest) {
        tokens.push(rest)
        vels.push(1)
        speeds.push(1)
        stretches.push(0)
      }
    }
    tokens.push(`${h.note}${stretchMark(durs[i]!, bpm)}`)
    vels.push(roundVel(h.velocity ?? 1))
    const beats = quantizeBeats(durs[i]!, bpm)
    const hold = Math.max(beats, 1) * (60 / Math.max(bpm, 40))
    const sm =
      mic && beats >= 2 ? smearFromHold(hold, takeSec!, h.note) : null
    if (sm) {
      anySmear = true
      speeds.push(sm.speed)
      stretches.push(sm.stretch)
    } else {
      speeds.push(1)
      stretches.push(0)
    }
  }
  let code = improvVoiceCode(tokens.join(' '), voice)
  const allDefault = vels.every((v) => Math.abs(v - 1) < 0.06)
  if (!allDefault) {
    const same = vels.every((v) => v === vels[0])
    code += same
      ? `.velocity(${vels[0]})`
      : `.velocity("${vels.join(' ')}")`
  }
  if (anySmear) {
    const same =
      speeds.every((s) => s === speeds[0]) &&
      stretches.every((s) => s === stretches[0])
    code += same
      ? `.speed(${speeds[0]}).stretch(${stretches[0]})`
      : `.speed("${speeds.join(' ')}").stretch("${stretches.join(' ')}")`
  }
  if (anyLong || anySmear || tokens.some((tok) => tok.startsWith('~'))) code += '.clip(1)'
  const cycles = phraseCycles(tokens)
  if (cycles > 1) code += `.slow(${round3(cycles)})`
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
