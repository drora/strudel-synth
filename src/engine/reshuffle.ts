import type { TrackRole } from './types'
import { splitEffectSuffix, getBankFromCode, setBankInCode } from './code-effects'
import type {
  Density,
  FxBias,
  GrooveFamily,
  Kit,
  KitShuffleProfile,
  KitTrack,
  ResolvedShuffleProfile,
  ScaleKind,
} from './kits-types'
import { resolveShuffleProfile } from './kits-types'
import { generateDrumRole, resolveDrumVoice } from './reshuffle-drums'

const DRUM_ROLES: TrackRole[] = ['drums', 'hihats', 'fx']

export type { DrumVoice } from './reshuffle-drums'
export { resolveDrumVoice } from './reshuffle-drums'

export interface ReshuffleOpts {
  pinEffects?: boolean
  lockKit?: boolean
  bank?: string | null
  /** Active kit shuffle profile (when kitId set). */
  shuffle?: KitShuffleProfile | null
  /** Kit vibe used only if shuffle incomplete — prefer passing resolved profile. */
  vibe?: Kit['vibe']
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, n)
}

const SCALE_DEGREES: Record<ScaleKind, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 3, 5, 7, 10],
}

const NOTE_NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']

function rootIndex(root: string): number {
  const r = root.toLowerCase().replace('♯', '#').replace('♭', 'b')
  const idx = NOTE_NAMES.indexOf(r)
  if (idx >= 0) return idx
  const flat = r.replace('#', '')
  const map: Record<string, number> = { db: 1, d: 2, eb: 3, e: 4, f: 5, gb: 6, g: 7, ab: 8, a: 9, bb: 10, b: 11, c: 0 }
  return map[flat] ?? 0
}

function noteAt(root: string, degree: number, octave: number): string {
  const semis = (rootIndex(root) + degree + 120) % 12
  return `${NOTE_NAMES[semis]}${octave}`
}

function scaleNotes(root: string, scale: ScaleKind, octave: number, count: number): string[] {
  const degs = SCALE_DEGREES[scale]
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const deg = degs[i % degs.length]!
    const oct = octave + Math.floor(i / degs.length)
    out.push(noteAt(root, deg, oct))
  }
  return out
}

function chordAt(root: string, scale: ScaleKind, degreeIndex: number, octave: number): string {
  const degs = SCALE_DEGREES[scale]
  const parts = [0, 2, 4].map((off) => {
    const idx = degreeIndex + off
    const octBump = Math.floor(idx / degs.length)
    const deg = degs[((idx % degs.length) + degs.length) % degs.length]!
    return noteAt(root, deg, octave + octBump)
  })
  return `[${parts.join(',')}]`
}

function fxSnippet(bias: FxBias, role: TrackRole): string {
  if (role === 'pad' || bias === 'roomy') {
    return pick(['.room(0.5)', '.room(0.7)', '.room(0.85)', '.room(0.4).delay(0.2)', ''])
  }
  if (bias === 'delay') {
    return pick(['.delay(0.25).delaytime(0.125)', '.delay(0.4).delaytime(0.25)', '.delay(0.35).delaytime(0.0625)', ''])
  }
  if (bias === 'filtered') {
    return pick(['.lpf(800)', '.lpf(1200)', '.lpf(500).lpq(8)', '.hpf(200)', '.lpf(2000)', ''])
  }
  return pick(['', '', '.lpf(1600)', '.room(0.25)'])
}

function densityGain(density: Density, role: TrackRole): number {
  const base =
    role === 'drums' ? 1.05
    : role === 'hihats' ? 0.4
    : role === 'fx' ? 0.7
    : role === 'bass' ? 0.65
    : role === 'pad' ? 0.28
    : role === 'lead' || role === 'arp' ? 0.22
    : 0.4
  const mul = density === 'high' ? 1.08 : density === 'low' ? 0.85 : 1
  return +(base * mul).toFixed(2)
}

function melodicSound(sounds: string[]): string {
  return pick(sounds)
}

/** Wavetable / some sample instruments prefer s("name").note(...) */
function isSampleLeadSound(sound: string): boolean {
  return sound.startsWith('wt_') || sound.startsWith('organ_') || sound.startsWith('pipeorgan')
}

function noteExpr(pattern: string, sound: string, suffix: string): string {
  if (isSampleLeadSound(sound)) {
    return `s("${sound}").note(${pattern})${suffix}`
  }
  return `note(${pattern}).sound("${sound}")${suffix}`
}

function generateBassLine(profile: ResolvedShuffleProfile): string {
  const { root, scale, melodicSounds, fxBias, density } = profile
  const notes = pickN(scaleNotes(root, scale, 2, 7), pick([3, 4, 5]))
  const lined = notes.map((n, i) => (i === 0 && Math.random() < 0.35 ? n.replace(/\d$/, (d) => String(Math.max(1, +d - 1))) : n))
  const spaced = density === 'low' || Math.random() < 0.45
    ? lined.join(' ~ ')
    : pick([lined.join(' '), `<${lined.join(' ')}>`])
  const synth = melodicSound(melodicSounds)
  const lpf = fxBias === 'roomy' ? 250 + Math.floor(Math.random() * 200) : 350 + Math.floor(Math.random() * 550)
  const gain = densityGain(density, 'bass')
  const fx = fxSnippet(fxBias, 'bass')
  const lpq = fxBias === 'filtered' && Math.random() < 0.5 ? `.lpq(${6 + Math.floor(Math.random() * 8)})` : ''
  const pat = spaced.startsWith('<') ? `"${spaced}"` : `"${spaced}"`
  return noteExpr(pat, synth, `.lpf(${lpf})${lpq}.gain(${gain})${fx}`)
}

function generateLeadLine(profile: ResolvedShuffleProfile): string {
  const { root, scale, melodicSounds, fxBias, density } = profile
  const notes = pickN(scaleNotes(root, scale, 4, 8), pick([3, 4, 5]))
  const mul = density === 'high' ? pick(['*2', '*4', '*2']) : density === 'low' ? pick(['', '', '*2']) : pick(['*2', '', '*2'])
  const synth = melodicSound(melodicSounds)
  const fx = fxSnippet(fxBias === 'dry' ? 'delay' : fxBias, 'lead')
  const gain = densityGain(density, 'lead')
  return noteExpr(`"<${notes.join(' ')}>${mul}"`, synth, `${fx}.gain(${gain})`)
}

function generatePadChord(profile: ResolvedShuffleProfile): string {
  const { root, scale, melodicSounds, fxBias, density } = profile
  const degIdx = pickN([0, 1, 2, 3, 4], pick([2, 3]))
  const chords = degIdx.map((d) => chordAt(root, scale, d, 3))
  const synth = melodicSound(melodicSounds.filter((s) => s !== 'square').concat(melodicSounds).slice(0, 6))
  const room = fxBias === 'roomy' ? (0.7 + Math.random() * 0.25).toFixed(2) : (0.3 + Math.random() * 0.35).toFixed(2)
  const gain = densityGain(density, 'pad')
  const attack = fxBias === 'roomy' || density === 'low' ? `.attack(${(0.3 + Math.random() * 0.7).toFixed(1)})` : ''
  const lpf = fxBias === 'filtered' ? `.lpf(${500 + Math.floor(Math.random() * 900)})` : pick(['', `.lpf(${1100 + Math.floor(Math.random() * 500)})`])
  return noteExpr(`"<${chords.join(' ')}>"`, synth, `.room(${room})${attack}${lpf}.gain(${gain})`)
}

function generateArp(profile: ResolvedShuffleProfile): string {
  const { root, scale, melodicSounds, fxBias, density } = profile
  const notes = pickN(scaleNotes(root, scale, 3, 8), pick([4, 5, 6]))
  const rate = density === 'high' ? pick([6, 8, 8]) : density === 'low' ? pick([4, 4, 6]) : pick([4, 6, 8])
  const synth = melodicSound(melodicSounds)
  const fx = fxBias === 'delay' || fxBias === 'roomy'
    ? pick(['.delay(0.5).delaytime(0.125)', '.delay(0.35).delaytime(0.0625)', '.room(0.4)'])
    : pick(['.delay(0.25).delaytime(0.125)', '.room(0.3)', ''])
  const gain = densityGain(density, 'arp')
  return noteExpr(`"<${notes.join(' ')}>*${rate}"`, synth, `${fx}.gain(${gain})`)
}

function generateVox(profile: ResolvedShuffleProfile): string {
  const { root, scale, melodicSounds, fxBias } = profile
  const notes = pickN(scaleNotes(root, scale, 4, 6), 3)
  const synth = melodicSound(melodicSounds)
  return noteExpr(`"<${notes.join(' ')}>"`, synth, `${fxSnippet(fxBias, 'lead')}.gain(0.18)`)
}

function resolveProfile(opts?: ReshuffleOpts): ResolvedShuffleProfile {
  if (opts?.shuffle) {
    return {
      groove: opts.shuffle.groove,
      density: opts.shuffle.density,
      root: opts.shuffle.root ?? 'c',
      scale: opts.shuffle.scale ?? 'minor',
      melodicSounds: opts.shuffle.melodicSounds?.length
        ? opts.shuffle.melodicSounds
        : ['sawtooth', 'square', 'triangle', 'sine'],
      fxBias: opts.shuffle.fxBias ?? 'dry',
      pinN: opts.shuffle.pinN,
    }
  }
  return {
    groove: pick(['four_on_floor', 'breakbeat', 'halftime', 'sparse'] as GrooveFamily[]),
    density: pick(['low', 'mid', 'high'] as Density[]),
    root: 'c',
    scale: pick(['minor', 'major', 'dorian', 'pentatonic'] as ScaleKind[]),
    melodicSounds: ['sawtooth', 'square', 'triangle', 'sine'],
    fxBias: pick(['dry', 'roomy', 'filtered', 'delay'] as FxBias[]),
    pinN: undefined,
  }
}

function generateRaw(
  role: TrackRole,
  currentCode: string,
  profile: ResolvedShuffleProfile,
  bank?: string | null,
): string {
  switch (role) {
    case 'drums':
      return generateDrumRole('drums', profile.groove, profile.density, bank, profile.fxBias, profile.pinN)
    case 'hihats':
      return generateDrumRole('hihats', profile.groove, profile.density, bank, profile.fxBias, profile.pinN)
    case 'fx':
      return generateDrumRole('fx', profile.groove, profile.density, bank, profile.fxBias, profile.pinN)
    case 'bass':
      return generateBassLine(profile)
    case 'lead':
      return generateLeadLine(profile)
    case 'pad':
      return generatePadChord(profile)
    case 'arp':
      return generateArp(profile)
    case 'vox':
      return generateVox(profile)
    default:
      return currentCode
  }
}

/**
 * Reshuffle one track. When `opts.shuffle` + `opts.bank` come from the active kit,
 * patterns stay in-family (same groove / scale / drum bank).
 */
export function reshuffleTrack(
  role: TrackRole,
  currentCode: string,
  opts?: ReshuffleOpts,
): string {
  const profile = resolveProfile(opts)
  const bank =
    opts?.bank ??
    (opts?.lockKit ? getBankFromCode(currentCode) : null) ??
    getBankFromCode(currentCode) ??
    (DRUM_ROLES.includes(role) ? 'RolandTR909' : null)

  let next = generateRaw(role, currentCode, profile, DRUM_ROLES.includes(role) ? bank : null)

  if (opts?.pinEffects) {
    const { fx } = splitEffectSuffix(currentCode)
    if (fx) {
      const { head } = splitEffectSuffix(next)
      next = head + fx
    }
  } else if (opts?.lockKit && DRUM_ROLES.includes(role)) {
    const prevBank = opts.bank || getBankFromCode(currentCode)
    if (prevBank && resolveDrumVoice(prevBank) === 'bank') {
      next = setBankInCode(next, prevBank)
    }
  }
  return next
}

/** Build fresh KitTrack[] from layout + shuffle profile (every call regenerates). */
export function generateKitTracks(kit: Kit): KitTrack[] {
  const profile = resolveShuffleProfile(kit)
  const bank = kit.drumsBank
  return kit.tracks.map((t) => ({
    name: t.name,
    role: t.role,
    code: generateRaw(t.role, '', profile, DRUM_ROLES.includes(t.role) ? bank : null),
  }))
}
