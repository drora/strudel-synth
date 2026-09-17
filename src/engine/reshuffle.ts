import type { TrackRole } from './types'
import { clipSuffix } from './voice-profile'
import {
  splitEffectSuffix,
  getBankFromCode,
  setBankInCode,
  getNFromCode,
  setNInCode,
  getSoundFromCode,
  setSoundInCode,
  primarySSample,
  rewriteSPatternSample,
  removeEffectFromCode,
} from './code-effects'
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
import { catalogSoundsForRole } from './kit-sound-choices'
import { isMelodicRole, shiftNotesByOctaves } from './note-harmony'
import {
  type SongSeed,
  rollSeed,
  hydrateSeed,
  centerTriadNotes,
  centerMelodyNotes,
  mixChain,
} from './song-seed'
import { isJamMicCode, jamMicNameFromCode, refitMicKeepCode } from './improv-plate'

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
  /** Melodic octave offset applied after generate (track.octave). */
  octaveOffset?: number
  /** Shared song walk — melodic roles must follow when present. */
  seed?: SongSeed | null
  /** Chords per drum cycle: 1 = stretch default; 2 = densified walk. */
  walkDensity?: 1 | 2
  /** Session BPM — mic Keep refit uses it for smear / @beats. */
  bpm?: number
  /** Wall-clock jam_mic take length (seconds) for smear. */
  takeSec?: number
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

function noteExpr(pattern: string, sound: string, suffix: string, role: TrackRole): string {
  const clip = clipSuffix(sound, role)
  const full = clip && !/\.clip\(/.test(suffix) ? `${suffix}${clip}` : suffix
  if (isSampleLeadSound(sound)) {
    return `s("${sound}").note(${pattern})${full}`
  }
  return `note(${pattern}).sound("${sound}")${full}`
}

function ensureSeed(profile: ResolvedShuffleProfile, seed?: SongSeed | null): SongSeed {
  if (seed) {
    return hydrateSeed(seed, {
      density: profile.density,
      groove: profile.groove,
      fxBias: profile.fxBias,
    })
  }
  return rollSeed({
    root: profile.root,
    scale: profile.scale,
    density: profile.density,
    groove: profile.groove,
    fxBias: profile.fxBias,
  })
}


export type WalkDensity = 1 | 2

/**
 * Walk densify pairing (chordsPerCycle=2): cycle i uses centers[i] + centers[(i+1)%N]
 * with wrap — N=3 → A+B | C+A | B+C. Density 1 → one center per cycle.
 */
function walkUnitCenters<T>(centers: T[], chordsPerCycle: WalkDensity): T[][] {
  const n = centers.length
  if (n === 0) return []
  if (chordsPerCycle === 1) return centers.map((c) => [c])
  return centers.map((_, i) => [centers[i]!, centers[(i + 1) % n]!])
}

/**
 * Stretch encoding: slowcat of N unit cells (each cell = one drum cycle).
 * Density 1 → one chord/motif per cycle; density 2 → paired mini-pattern per cycle.
 * FX/sound hang off the slowcat so Intensity can still map each note("…") cell.
 */
function stretchNoteExpr(
  unitBodies: string[],
  sound: string,
  suffix: string,
  role: TrackRole,
): string {
  const clip = clipSuffix(sound, role)
  const full = clip && !/\.clip\(/.test(suffix) ? `${suffix}${clip}` : suffix
  if (unitBodies.length === 0) {
    return noteExpr('"c3"', sound, suffix, role)
  }
  if (unitBodies.length === 1) {
    return noteExpr(`"${unitBodies[0]}"`, sound, suffix, role)
  }
  if (isSampleLeadSound(sound)) {
    const parts = unitBodies.map((b) => `s("${sound}").note("${b}")`).join(', ')
    return `slowcat(${parts})${full}`
  }
  const parts = unitBodies.map((b) => `note("${b}")`).join(', ')
  return `slowcat(${parts}).sound("${sound}")${full}`
}

function bassCell(seed: SongSeed, c: SongSeed['walk'][number], density: Density): string {
  const triad = centerTriadNotes(seed.root, c, 2)
  let root = triad[0]!
  if (Math.random() < 0.35) {
    root = root.replace(/(\d+)$/, (_, d) => String(Math.max(1, Number(d) - 1)))
  }
  if (Math.random() < 0.35) {
    const fifth = triad[2] ?? root
    return density === 'low' ? `${root} ~ ${fifth}` : `${root} ${fifth}`
  }
  return root
}

function generateBassLine(
  profile: ResolvedShuffleProfile,
  seed: SongSeed,
  walkDensity: WalkDensity = 1,
): string {
  const { fxBias, density } = profile
  const units = walkUnitCenters(seed.walk, walkDensity).map((pair) => {
    if (pair.length === 1) return bassCell(seed, pair[0]!, density)
    // Two chords in one cycle: roots (or short cells) sequenced inside <>
    const a = bassCell(seed, pair[0]!, density).split(/\s+/)[0]!
    const b = bassCell(seed, pair[1]!, density).split(/\s+/)[0]!
    return `<${a} ${b}>`
  })
  const synth = melodicSound(catalogSoundsForRole('bass'))
  const mix = seed.mix
  if (mix) {
    return stretchNoteExpr(units, synth, mixChain('bass', mix), 'bass')
  }
  const lpf = fxBias === 'roomy' ? 250 + Math.floor(Math.random() * 200) : 350 + Math.floor(Math.random() * 550)
  const gain = densityGain(density, 'bass')
  const fx = fxSnippet(fxBias, 'bass')
  const lpq = fxBias === 'filtered' && Math.random() < 0.5 ? `.lpq(${6 + Math.floor(Math.random() * 8)})` : ''
  return stretchNoteExpr(units, synth, `.lpf(${lpf})${lpq}.gain(${gain})${fx}`, 'bass')
}

/** One-cycle lead motif for a single walk center (unit cell before stretch). */
function leadCellFromCenter(
  seed: SongSeed,
  c: SongSeed['walk'][number],
  density: Density,
): string {
  type Fam = 'held' | 'motif' | 'rests' | 'plain' | 'sync'
  const weights: Fam[] =
    density === 'low'
      ? ['held', 'held', 'rests', 'motif', 'plain']
      : density === 'high'
        ? ['motif', 'sync', 'plain', 'motif', 'rests']
        : ['held', 'motif', 'rests', 'plain', 'sync', 'held']
  const fam = pick(weights)
  const tone = (oct = 4) => pick(centerMelodyNotes(seed.root, seed.scale, c, oct))
  const t0 = tone()
  const t1 = tone()
  switch (fam) {
    case 'held':
      return pick([`${t0} ~`, `${t0} ~ ~ ~`, t0])
    case 'rests':
      return pick([`~ ${t0}`, `${t0} ~`, `~ ${t0} ~ ${t1}`])
    case 'motif': {
      const body = pick([`<${t0} ~ ${t0} ${t1}>`, `<${t0} ${t1} ${t0} ~>`, `<${t0} ${t1}>`])
      const mul = density === 'high' ? pick(['', '*2']) : ''
      return `${body}${mul}`
    }
    case 'sync':
      return `<~ ${t0}>${pick(['', '*2'])}`
    case 'plain':
    default: {
      const mul = density === 'high' ? pick(['', '*2']) : ''
      return mul ? `<${t0}>${mul}` : t0
    }
  }
}

function generateLeadLine(
  profile: ResolvedShuffleProfile,
  seed: SongSeed,
  walkDensity: WalkDensity = 1,
): string {
  const { fxBias, density } = profile
  const units = walkUnitCenters(seed.walk, walkDensity).map((pair) => {
    if (pair.length === 1) return leadCellFromCenter(seed, pair[0]!, density)
    const a = leadCellFromCenter(seed, pair[0]!, density)
    const b = leadCellFromCenter(seed, pair[1]!, density)
    // Keep each half as a group so two motifs share one cycle
    return `<[${a}] [${b}]>`
  })
  const synth = melodicSound(catalogSoundsForRole('lead'))
  if (seed.mix) {
    return stretchNoteExpr(units, synth, mixChain('lead', seed.mix), 'lead')
  }
  const fx = fxSnippet(fxBias === 'dry' ? 'delay' : fxBias, 'lead')
  const gain = densityGain(density, 'lead')
  return stretchNoteExpr(units, synth, `${fx}.gain(${gain})`, 'lead')
}

function padCell(seed: SongSeed, c: SongSeed['walk'][number]): string {
  const parts = centerTriadNotes(seed.root, c, 3)
  return `[${parts.join(',')}]`
}

function generatePadChord(
  profile: ResolvedShuffleProfile,
  seed: SongSeed,
  walkDensity: WalkDensity = 1,
): string {
  const { fxBias, density } = profile
  const units = walkUnitCenters(seed.walk, walkDensity).map((pair) => {
    if (pair.length === 1) return padCell(seed, pair[0]!)
    return `<${padCell(seed, pair[0]!)} ${padCell(seed, pair[1]!)}>`
  })
  const synth = melodicSound(catalogSoundsForRole('pad'))
  const room = fxBias === 'roomy' ? (0.7 + Math.random() * 0.25).toFixed(2) : (0.3 + Math.random() * 0.35).toFixed(2)
  const gain = densityGain(density, 'pad')
  const attack = fxBias === 'roomy' || density === 'low' ? `.attack(${(0.3 + Math.random() * 0.7).toFixed(1)})` : ''
  const lpf = fxBias === 'filtered' ? `.lpf(${500 + Math.floor(Math.random() * 900)})` : pick(['', `.lpf(${1100 + Math.floor(Math.random() * 500)})`])
  if (seed.mix) {
    return stretchNoteExpr(units, synth, `${attack}${mixChain('pad', seed.mix)}`, 'pad')
  }
  return stretchNoteExpr(units, synth, `.room(${room})${attack}${lpf}.gain(${gain})`, 'pad')
}

function arpCell(
  seed: SongSeed,
  c: SongSeed['walk'][number],
  density: Density,
): string {
  const notes = pickN(centerMelodyNotes(seed.root, seed.scale, c, 3), pick([2, 3]))
  const rate = density === 'high' ? pick([2, 4, 4]) : density === 'low' ? pick([2, 2]) : pick([2, 4])
  const fam =
    density === 'low' ? pick(['classic', 'sparse', 'sparse'])
    : density === 'high' ? pick(['classic', 'classic', 'sync'])
    : pick(['classic', 'sparse', 'sync'])
  if (fam === 'sparse') {
    const few = notes.slice(0, pick([2, 3]))
    return `<${few.join(' ~ ')}>*${pick([2, 4])}`
  }
  if (fam === 'sync') {
    return `<~ ${notes.join(' ')}>*${rate}`
  }
  return `<${notes.join(' ')}>*${rate}`
}

function generateArp(
  profile: ResolvedShuffleProfile,
  seed: SongSeed,
  walkDensity: WalkDensity = 1,
): string {
  const { fxBias, density } = profile
  const units = walkUnitCenters(seed.walk, walkDensity).map((pair) => {
    if (pair.length === 1) return arpCell(seed, pair[0]!, density)
    return `<[${arpCell(seed, pair[0]!, density)}] [${arpCell(seed, pair[1]!, density)}]>`
  })
  const synth = melodicSound(catalogSoundsForRole('arp'))
  const fx = fxBias === 'delay' || fxBias === 'roomy'
    ? pick(['.delay(0.5).delaytime(0.125)', '.delay(0.35).delaytime(0.0625)', '.room(0.4)'])
    : pick(['.delay(0.25).delaytime(0.125)', '.room(0.3)', ''])
  const gain = densityGain(density, 'arp')
  if (seed.mix) {
    return stretchNoteExpr(units, synth, mixChain('arp', seed.mix), 'arp')
  }
  return stretchNoteExpr(units, synth, `${fx}.gain(${gain})`, 'arp')
}

function generateVox(
  profile: ResolvedShuffleProfile,
  seed: SongSeed,
  walkDensity: WalkDensity = 1,
): string {
  const { fxBias } = profile
  const units = walkUnitCenters(seed.walk, walkDensity).map((pair) => {
    const notes = pair.flatMap((c) => pickN(centerMelodyNotes(seed.root, seed.scale, c, 4), 1))
    if (notes.length === 1) return notes[0]!
    return `<${notes.join(' ')}>`
  })
  const synth = melodicSound(catalogSoundsForRole('vox'))
  if (seed.mix) {
    return stretchNoteExpr(units, synth, mixChain('vox', seed.mix), 'vox')
  }
  return stretchNoteExpr(units, synth, `${fxSnippet(fxBias, 'lead')}.gain(0.18)`, 'vox')
}

function resolveProfile(opts?: ReshuffleOpts): ResolvedShuffleProfile {
  if (opts?.shuffle) {
    return {
      groove: opts.shuffle.groove,
      density: opts.shuffle.density,
      root: opts.shuffle.root ?? 'c',
      scale: opts.shuffle.scale ?? 'minor',
      // Field kept on profile; melodic generate uses role catalog, not this list.
      melodicSounds: opts.shuffle.melodicSounds ?? [],
      fxBias: opts.shuffle.fxBias ?? 'dry',
      pinN: opts.shuffle.pinN,
    }
  }
  return {
    groove: pick(['four_on_floor', 'breakbeat', 'halftime', 'sparse'] as GrooveFamily[]),
    density: pick(['low', 'mid', 'high'] as Density[]),
    root: 'c',
    scale: pick(['minor', 'major', 'dorian', 'pentatonic', 'mixolydian', 'phrygian', 'lydian', 'harmonic_minor'] as ScaleKind[]),
    melodicSounds: [],
    fxBias: pick(['dry', 'roomy', 'filtered', 'delay'] as FxBias[]),
    pinN: undefined,
  }
}

function generateRaw(
  role: TrackRole,
  currentCode: string,
  profile: ResolvedShuffleProfile,
  bank?: string | null,
  seed?: SongSeed | null,
  walkDensity: WalkDensity = 1,
): string {
  const song = ensureSeed(profile, seed)
  const melodicSeed = song
  switch (role) {
    case 'drums':
      return generateDrumRole('drums', profile.groove, profile.density, bank, profile.fxBias, profile.pinN, song)
    case 'hihats':
      return generateDrumRole('hihats', profile.groove, profile.density, bank, profile.fxBias, profile.pinN, song)
    case 'fx':
      return generateDrumRole('fx', profile.groove, profile.density, bank, profile.fxBias, profile.pinN, song)
    case 'bass':
      return generateBassLine(profile, melodicSeed!, walkDensity)
    case 'lead':
      return generateLeadLine(profile, melodicSeed!, walkDensity)
    case 'pad':
      return generatePadChord(profile, melodicSeed!, walkDensity)
    case 'arp':
      return generateArp(profile, melodicSeed!, walkDensity)
    case 'vox':
      return generateVox(profile, melodicSeed!, walkDensity)
    default:
      return currentCode
  }
}

/** Sound identity pinned across Shuffle (rhythm/notes may change). */
type PinnedSound =
  | { kind: 'bank'; bank: string; n: number | null }
  | { kind: 'sample'; sample: string }
  | { kind: 'sound'; sound: string }

/**
 * Capture current bank / primary sample / synth so Shuffle can regenerate
 * rhythm and melody while keeping the Sound sheet selection.
 */
function captureSoundIdentity(currentCode: string): PinnedSound | null {
  const code = currentCode?.trim() ?? ''
  if (!code) return null

  const bank = getBankFromCode(code)
  if (bank) {
    return { kind: 'bank', bank, n: getNFromCode(code) }
  }

  const hasLeadingS = /^\s*s\(\s*["'][^"']+["']\s*\)/.test(code)
  const hasSound = /\.sound\(/.test(code)
  const hasNote = /\bnote\(/.test(code)
  // Sample-voice drum lines: s("tabla:0 ~ …") with no .bank / .sound / note()
  if (hasLeadingS && !hasSound && !hasNote) {
    const sample = primarySSample(code) ?? getSoundFromCode(code)
    if (sample) return { kind: 'sample', sample }
    return null
  }

  const sound = getSoundFromCode(code)
  if (sound) return { kind: 'sound', sound }
  return null
}

/** One-shot sample trigger grid — never note() / synth. */
function sampleTriggerPattern(sample: string, density: Density): string {
  if (density === 'low') return `${sample} ~ ~ ~`
  if (density === 'high') return `${sample} ~ ${sample} ${sample}`
  return `${sample} ~ ${sample} ~`
}

/** Re-apply pinned Sound identity onto freshly generated pattern code. */
function applyPinnedSound(next: string, pinned: PinnedSound, density: Density): string {
  if (pinned.kind === 'bank') {
    let out = setBankInCode(next, pinned.bank)
    if (pinned.n != null) out = setNInCode(out, pinned.n)
    else out = removeEffectFromCode(out, 'n')
    return out
  }
  if (pinned.kind === 'sample') {
    const hasS = /\bs\(\s*["']/.test(next)
    const hasNote = /\bnote\(/.test(next)
    // Drum-style s() lines: rewrite the primary hit.
    if (hasS && !hasNote) {
      let out = removeEffectFromCode(removeEffectFromCode(next, 'bank'), 'n')
      return rewriteSPatternSample(out, pinned.sample)
    }
    // Melodic generate is note()+synth — that drops a recorded take. Stay on s().
    return `s("${sampleTriggerPattern(pinned.sample, density)}")`
  }
  return setSoundInCode(next, pinned.sound)
}

/**
 * Reshuffle one track (rhythm + notes may change). Pins Sound identity
 * (bank / .n / primary sample / synth) from currentCode when parseable.
 * Kit shuffle profile still picks groove family; New kit / applyKit stays full regen.
 */
export function reshuffleTrack(
  role: TrackRole,
  currentCode: string,
  opts?: ReshuffleOpts,
): string {
  const profile = resolveProfile(opts)
  const pinned = captureSoundIdentity(currentCode)

  // jam_mic_* Keep / Rec: pitch nudge always; time-stretch refit only when walk N ≠ baked.
  // Never fall through to melody generate or sampleTriggerPattern one-shots.
  const micName =
    jamMicNameFromCode(currentCode) ??
    (pinned?.kind === 'sample' && /jam_mic_\d+/.test(pinned.sample)
      ? pinned.sample
      : pinned?.kind === 'sound' && /jam_mic_\d+/.test(pinned.sound)
        ? pinned.sound
        : null)
  if (micName || isJamMicCode(currentCode)) {
    const walkLength = opts?.seed?.walk.length ?? 1
    let next = refitMicKeepCode(currentCode, {
      walkLength,
      bpm: opts?.bpm ?? 120,
      takeSec: opts?.takeSec,
    })
    if (opts?.pinEffects) {
      const { fx } = splitEffectSuffix(currentCode)
      // Refit owns smear; do not re-pin old speed/stretch onto a rebuilt line.
      const mixFx = fx
        .replace(/\.speed\([^)]*\)/g, '')
        .replace(/\.stretch\([^)]*\)/g, '')
      if (mixFx) {
        for (const call of mixFx.match(/\.[a-zA-Z_]\w*\([^()]*\)/g) ?? []) {
          const name = call.slice(1, call.indexOf('('))
          if (new RegExp(`\\.${name}\\(`).test(next)) continue
          next += call
        }
      }
    }
    return next
  }

  const bank =
    opts?.bank ??
    (opts?.lockKit ? getBankFromCode(currentCode) : null) ??
    getBankFromCode(currentCode) ??
    (DRUM_ROLES.includes(role) ? 'RolandTR909' : null)

  let next = generateRaw(role, currentCode, profile, DRUM_ROLES.includes(role) ? bank : null, opts?.seed, opts?.walkDensity ?? 1)

  if (pinned) {
    next = applyPinnedSound(next, pinned, profile.density)
  } else if (opts?.lockKit && DRUM_ROLES.includes(role)) {
    // No prior sound to pin (fresh/empty) — keep kit bank on bank-voice kits.
    const prevBank = opts.bank || getBankFromCode(currentCode)
    if (prevBank && resolveDrumVoice(prevBank) === 'bank') {
      next = setBankInCode(next, prevBank)
    }
  }

  if (opts?.pinEffects) {
    const { fx } = splitEffectSuffix(currentCode)
    if (fx) {
      const { head } = splitEffectSuffix(next)
      next = head + fx
    }
  }

  const oct = opts?.octaveOffset ?? 0
  if (oct && isMelodicRole(role) && /\bnote\(/.test(next)) {
    next = shiftNotesByOctaves(next, oct)
  }
  return next
}

/** Build fresh KitTrack[] from layout + shuffle profile (every call regenerates). */
export function generateKitTracks(kit: Kit, seed?: SongSeed, walkDensity: WalkDensity = 1): KitTrack[] {
  const profile = resolveShuffleProfile(kit)
  const bank = kit.drumsBank
  const song =
    seed ??
    rollSeed({
      root: profile.root,
      scale: profile.scale,
      vibe: kit.vibe,
      density: profile.density,
      groove: profile.groove,
      fxBias: profile.fxBias,
    })
  return kit.tracks.map((t) => ({
    name: t.name,
    role: t.role,
    code: generateRaw(t.role, '', profile, DRUM_ROLES.includes(t.role) ? bank : null, song, walkDensity),
  }))
}
