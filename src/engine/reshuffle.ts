import type { TrackRole } from './types'
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
import { isMelodicRole, shiftNotesByOctaves } from './note-harmony'
import {
  type SongSeed,
  rollSeed,
  hydrateSeed,
  centerTriadNotes,
  centerMelodyNotes,
  mixChain,
} from './song-seed'

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

function noteExpr(pattern: string, sound: string, suffix: string): string {
  if (isSampleLeadSound(sound)) {
    return `s("${sound}").note(${pattern})${suffix}`
  }
  return `note(${pattern}).sound("${sound}")${suffix}`
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

function generateBassLine(profile: ResolvedShuffleProfile, seed: SongSeed): string {
  const { melodicSounds, fxBias, density } = profile
  const notes: string[] = []
  for (const c of seed.walk) {
    const triad = centerTriadNotes(seed.root, c, 2)
    const root = triad[0]!
    // Sometimes fifth
    if (Math.random() < 0.35) {
      notes.push(root, triad[2] ?? root)
    } else {
      notes.push(root)
    }
  }
  // First note may drop to octave 1
  if (notes.length && Math.random() < 0.35) {
    notes[0] = notes[0]!.replace(/(\d+)$/, (_, d) => String(Math.max(1, Number(d) - 1)))
  }
  const spaced =
    density === 'low' || Math.random() < 0.45
      ? notes.join(' ~ ')
      : pick([notes.join(' '), `<${notes.join(' ')}>`])
  const synth = melodicSound(melodicSounds)
  const mix = seed.mix
  if (mix) {
    return noteExpr(`"${spaced}"`, synth, mixChain('bass', mix))
  }
  const lpf = fxBias === 'roomy' ? 250 + Math.floor(Math.random() * 200) : 350 + Math.floor(Math.random() * 550)
  const gain = densityGain(density, 'bass')
  const fx = fxSnippet(fxBias, 'bass')
  const lpq = fxBias === 'filtered' && Math.random() < 0.5 ? `.lpq(${6 + Math.floor(Math.random() * 8)})` : ''
  return noteExpr(`"${spaced}"`, synth, `.lpf(${lpf})${lpq}.gain(${gain})${fx}`)
}

/** Lead note-pattern from walk centers; cap *2 (no *3/*4). */
function leadPatternFromSeed(seed: SongSeed, density: Density): string {
  type Fam = 'held' | 'motif' | 'rests' | 'plain' | 'sync'
  const weights: Fam[] =
    density === 'low'
      ? ['held', 'held', 'rests', 'motif', 'plain']
      : density === 'high'
        ? ['motif', 'sync', 'plain', 'motif', 'rests']
        : ['held', 'motif', 'rests', 'plain', 'sync', 'held']
  const fam = pick(weights)
  const centers = seed.walk
  const tone = (c: (typeof centers)[0], oct = 4) =>
    pick(centerMelodyNotes(seed.root, seed.scale, c, oct))

  switch (fam) {
    case 'held': {
      const few = centers.slice(0, Math.min(3, centers.length)).map((c) => tone(c))
      const body = pick([
        few.join(' ~ '),
        `${few[0]} ~ ~ ${few[1] ?? few[0]}`,
        `<${few.join(' ~ ')}>`,
        `<${few.join(' ')}>`,
      ])
      return `"${body}"`
    }
    case 'rests': {
      const ns = centers.map((c) => tone(c))
      const body = pick([
        `~ ${ns.join(' ~ ')}`,
        `<~ ${ns.join(' ')}>`,
        `${ns[0]} ~ ${ns.slice(1).join(' ~ ')}`,
      ])
      const mul = density === 'high' ? pick(['', '*2']) : ''
      return `"${body}${body.startsWith('<') ? mul : ''}"`
    }
    case 'motif': {
      const cycle = [...centers, ...centers].slice(0, 4)
      const ns = cycle.map((c) => tone(c))
      const body = pick([
        `<${ns[0]} ~ ${ns[0]} ${ns[1]}>`,
        `<${ns[0]} ${ns[1]} ${ns[0]} ~>`,
        `<${ns.join(' ')}>`,
      ])
      const mul = density === 'high' ? pick(['', '*2']) : pick(['', ''])
      return `"${body}${mul}"`
    }
    case 'sync': {
      const ns = centers.map((c) => tone(c))
      const body = `<~ ${ns.join(' ')}>`
      return `"${body}${pick(['', '*2'])}"`
    }
    case 'plain':
    default: {
      const ns = centers.map((c) => tone(c))
      const mul = density === 'high' ? pick(['', '*2']) : ''
      return `"<${ns.join(' ')}>${mul}"`
    }
  }
}

function generateLeadLine(profile: ResolvedShuffleProfile, seed: SongSeed): string {
  const { melodicSounds, fxBias, density } = profile
  const synth = melodicSound(melodicSounds)
  if (seed.mix) {
    return noteExpr(leadPatternFromSeed(seed, density), synth, mixChain('lead', seed.mix))
  }
  const fx = fxSnippet(fxBias === 'dry' ? 'delay' : fxBias, 'lead')
  const gain = densityGain(density, 'lead')
  return noteExpr(leadPatternFromSeed(seed, density), synth, `${fx}.gain(${gain})`)
}

function generatePadChord(profile: ResolvedShuffleProfile, seed: SongSeed): string {
  const { melodicSounds, fxBias, density } = profile
  const chords = seed.walk.map((c) => {
    const parts = centerTriadNotes(seed.root, c, 3)
    return `[${parts.join(',')}]`
  })
  const synth = melodicSound(melodicSounds.filter((s) => s !== 'square').concat(melodicSounds).slice(0, 6))
  const room = fxBias === 'roomy' ? (0.7 + Math.random() * 0.25).toFixed(2) : (0.3 + Math.random() * 0.35).toFixed(2)
  const gain = densityGain(density, 'pad')
  const attack = fxBias === 'roomy' || density === 'low' ? `.attack(${(0.3 + Math.random() * 0.7).toFixed(1)})` : ''
  const lpf = fxBias === 'filtered' ? `.lpf(${500 + Math.floor(Math.random() * 900)})` : pick(['', `.lpf(${1100 + Math.floor(Math.random() * 500)})`])
  if (seed.mix) {
    return noteExpr(`"<${chords.join(' ')}>"`, synth, `${attack}${mixChain('pad', seed.mix)}`)
  }
  return noteExpr(`"<${chords.join(' ')}>"`, synth, `.room(${room})${attack}${lpf}.gain(${gain})`)
}

function generateArp(profile: ResolvedShuffleProfile, seed: SongSeed): string {
  const { melodicSounds, fxBias, density } = profile
  const notes: string[] = []
  for (const c of seed.walk) {
    notes.push(...pickN(centerMelodyNotes(seed.root, seed.scale, c, 3), pick([2, 3])))
  }
  const rate = density === 'high' ? pick([2, 4, 4]) : density === 'low' ? pick([2, 2]) : pick([2, 4])
  const synth = melodicSound(melodicSounds)
  const fx = fxBias === 'delay' || fxBias === 'roomy'
    ? pick(['.delay(0.5).delaytime(0.125)', '.delay(0.35).delaytime(0.0625)', '.room(0.4)'])
    : pick(['.delay(0.25).delaytime(0.125)', '.room(0.3)', ''])
  const gain = densityGain(density, 'arp')
  const fam =
    density === 'low' ? pick(['classic', 'sparse', 'sparse'])
    : density === 'high' ? pick(['classic', 'classic', 'sync'])
    : pick(['classic', 'sparse', 'sync'])
  let pat: string
  if (fam === 'sparse') {
    const few = notes.slice(0, pick([3, 4]))
    pat = `"<${few.join(' ~ ')}>*${pick([2, 4])}"`
  } else if (fam === 'sync') {
    pat = `"<~ ${notes.slice(0, 4).join(' ')}>*${rate}"`
  } else {
    pat = `"<${notes.slice(0, 6).join(' ')}>*${rate}"`
  }
  if (seed.mix) {
    return noteExpr(pat, synth, mixChain('arp', seed.mix))
  }
  return noteExpr(pat, synth, `${fx}.gain(${gain})`)
}

function generateVox(profile: ResolvedShuffleProfile, seed: SongSeed): string {
  const { melodicSounds, fxBias } = profile
  const pool = seed.walk.flatMap((c) => centerMelodyNotes(seed.root, seed.scale, c, 4))
  const notes = pickN(pool, pick([2, 3]))
  const synth = melodicSound(melodicSounds)
  if (seed.mix) {
    return noteExpr(`"<${notes.join(' ')}>"`, synth, mixChain('vox', seed.mix))
  }
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
  seed?: SongSeed | null,
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
      return generateBassLine(profile, melodicSeed!)
    case 'lead':
      return generateLeadLine(profile, melodicSeed!)
    case 'pad':
      return generatePadChord(profile, melodicSeed!)
    case 'arp':
      return generateArp(profile, melodicSeed!)
    case 'vox':
      return generateVox(profile, melodicSeed!)
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

/** Re-apply pinned Sound identity onto freshly generated pattern code. */
function applyPinnedSound(next: string, pinned: PinnedSound): string {
  if (pinned.kind === 'bank') {
    let out = setBankInCode(next, pinned.bank)
    if (pinned.n != null) out = setNInCode(out, pinned.n)
    else out = removeEffectFromCode(out, 'n')
    return out
  }
  if (pinned.kind === 'sample') {
    // Drop bank/n if generator emitted a bank-voice line; pin sample hits only.
    let out = removeEffectFromCode(removeEffectFromCode(next, 'bank'), 'n')
    return rewriteSPatternSample(out, pinned.sample)
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
  const bank =
    opts?.bank ??
    (opts?.lockKit ? getBankFromCode(currentCode) : null) ??
    getBankFromCode(currentCode) ??
    (DRUM_ROLES.includes(role) ? 'RolandTR909' : null)

  let next = generateRaw(role, currentCode, profile, DRUM_ROLES.includes(role) ? bank : null, opts?.seed)

  if (pinned) {
    next = applyPinnedSound(next, pinned)
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
  if (oct && isMelodicRole(role)) {
    next = shiftNotesByOctaves(next, oct)
  }
  return next
}

/** Build fresh KitTrack[] from layout + shuffle profile (every call regenerates). */
export function generateKitTracks(kit: Kit, seed?: SongSeed): KitTrack[] {
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
    code: generateRaw(t.role, '', profile, DRUM_ROLES.includes(t.role) ? bank : null, song),
  }))
}
