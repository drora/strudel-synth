/**
 * Jam Mutate — deterministic pattern transforms on s("...") / note("...") mini-notation.
 * Keeps Sound / bank / FX chain intact (splitEffectSuffix spirit). Not Shuffle, not Spice.
 */
import type { Track, TrackRole } from './types'
import { splitEffectSuffix } from './code-effects'
import { isMelodicRole, parseNoteToken, formatNote, SCALE_DEGREES, rootIndex } from './note-harmony'
import type { ScaleKind } from './kits-types'
import type { IntensityLevel } from './intensity'

export type MutateScope = 'track' | 'song'

/** Song Half/Double-time pole: normal ↔ half | normal ↔ double (opposite restores normal). */
export type SongTimeFeel = 'normal' | 'half' | 'double'

export type MutateId =
  | 'sparse'
  | 'denser'
  | 'straighten'
  | 'syncopate'
  | 'half-time'
  | 'ghosts'
  | 'skeleton'
  | 'stutter'
  | 'rotate-l'
  | 'rotate-r'
  | 'reverse'
  | 'every-other'
  | 'double-time'
  | 'densify-walk'
  | 'undensify-walk'
  | 'intensity-up'
  | 'intensity-down'

export type MutateDef = {
  id: MutateId
  label: string
  hint: string
  scope: MutateScope
}

/** Ordered menu — core 8 then safe extras. */
export const MUTATIONS: readonly MutateDef[] = [
  { id: 'sparse', label: 'Sparse', hint: 'Thin hits', scope: 'track' },
  { id: 'denser', label: 'Denser', hint: 'Pack more hits', scope: 'track' },
  { id: 'straighten', label: 'Straighten', hint: 'Less syncopation', scope: 'track' },
  { id: 'syncopate', label: 'Syncopate', hint: 'Push off the grid', scope: 'track' },
  { id: 'half-time', label: 'Half-time', hint: 'Stretch feel · all tracks · once (opp. restores)', scope: 'song' },
  { id: 'ghosts', label: 'Ghosts', hint: 'Quiet in-between hits', scope: 'track' },
  { id: 'skeleton', label: 'Skeleton', hint: 'Kick+hats / root drones', scope: 'track' },
  { id: 'stutter', label: 'Stutter', hint: 'Ratchet the last hit', scope: 'track' },
  { id: 'rotate-l', label: 'Rotate L', hint: 'Shift −1 beat', scope: 'track' },
  { id: 'rotate-r', label: 'Rotate R', hint: 'Shift +1 beat', scope: 'track' },
  { id: 'reverse', label: 'Reverse', hint: 'Flip the pattern', scope: 'track' },
  { id: 'every-other', label: 'Every other', hint: 'Keep alternate hits', scope: 'track' },
  { id: 'double-time', label: 'Double-time', hint: 'Tighten feel · all tracks · once (opp. restores)', scope: 'song' },
  { id: 'densify-walk', label: 'Densify walk', hint: '2 chords / drum cycle · unlocked melodic', scope: 'song' },
  { id: 'undensify-walk', label: 'Undensify walk', hint: '1 chord / drum cycle · unlocked melodic', scope: 'song' },
  { id: 'intensity-up', label: 'Intensity+', hint: '1 as-is · 2 hats fill gaps · 3 pad → arp → keys → fx · 4 bd ~ ~ ~ → bd ~ bd ~ · *N→*2N · perc snares; bass+keys walk @0.5', scope: 'song' },
  { id: 'intensity-down', label: 'Intensity−', hint: 'wind down those same steps', scope: 'song' },
] as const

export function getMutation(id: string): MutateDef | undefined {
  return MUTATIONS.find((m) => m.id === id)
}

/** Top-level mini tokens; keep [], <>, () groups intact. */
export function tokenizeMini(body: string): string[] {
  const s = body.trim()
  if (!s) return []
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i]!)) i++
    if (i >= s.length) break
    const start = i
    const open = s[i]
    if (open === '[' || open === '<' || open === '(') {
      const close = open === '[' ? ']' : open === '<' ? '>' : ')'
      let depth = 0
      for (; i < s.length; i++) {
        if (s[i] === open) depth++
        else if (s[i] === close) {
          depth--
          if (depth === 0) {
            i++
            break
          }
        }
      }
      // Absorb trailing *N so "[hh oh]*4" stays one token
      if (i < s.length && s[i] === '*') {
        const mulStart = i
        i++
        while (i < s.length && /[\d.]/.test(s[i]!)) i++
        if (i === mulStart + 1) i = mulStart
      }
      out.push(s.slice(start, i))
    } else {
      while (i < s.length && !/\s/.test(s[i]!)) i++
      out.push(s.slice(start, i))
    }
  }
  return out
}

export function joinMini(tokens: string[]): string {
  return tokens.join(' ')
}

function isRest(tok: string): boolean {
  return tok === '~' || tok === '-'
}

function stripMul(tok: string): { base: string; mul: number | null } {
  const m = tok.match(/^(.*?)(?:\*(\d+(?:\.\d+)?))?$/)
  if (!m) return { base: tok, mul: null }
  return { base: m[1]!, mul: m[2] != null ? Number(m[2]) : null }
}

function withMul(base: string, mul: number | null): string {
  if (mul == null || mul === 1) return base
  return `${base}*${mul}`
}

/** Euclid hits: +2 or half the remaining rests, cap at pulses. */
export function bumpEuclidHits(k: number, n: number): number {
  if (!Number.isFinite(k) || !Number.isFinite(n) || n <= 0) return k
  return Math.min(n, k + Math.max(2, Math.floor((n - k) / 2)))
}

const EUCLID_MINI_RE = /^(.+)\((\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?\)$/

function parseEuclidMini(
  tok: string,
): { name: string; k: number; n: number; rot: string | null } | null {
  const { base } = stripMul(tok)
  const m = base.match(EUCLID_MINI_RE)
  if (!m) return null
  return { name: m[1]!, k: Number(m[2]), n: Number(m[3]), rot: m[4] ?? null }
}

function formatEuclidMini(name: string, k: number, n: number, rot: string | null): string {
  return rot != null ? `${name}(${k},${n},${rot})` : `${name}(${k},${n})`
}

function bumpEuclidCalls(code: string): string {
  return code.replace(/\.euclid\((\d+)\s*,\s*(\d+)(\s*,\s*\d+)?\)/g, (_full, k, n, rot) => {
    const k2 = bumpEuclidHits(Number(k), Number(n))
    return `.euclid(${k2},${n}${rot ?? ''})`
  })
}

const KICK_RE = /^(bd|kick|bassdrum|lt|kick:|bd:)/i
const HAT_RE = /^(hh|oh|ch|ph|hat|shaker|sh|hc|ride|rd|cr)/i

export function isKickish(tok: string): boolean {
  const { base } = stripMul(tok)
  const bare = base.replace(/^\[|\]$/g, '').split(/[,\s]/)[0] ?? base
  return KICK_RE.test(bare)
}

function isHatish(tok: string): boolean {
  const { base } = stripMul(tok)
  const bare = base.replace(/^\[|\]$/g, '').split(/[,\s]/)[0] ?? base
  return HAT_RE.test(bare)
}

const SNARE_RE = /^(sd|sn|snare|rim|rs|rimshot|cp|clap)/i

export function isSnareish(tok: string): boolean {
  const { base } = stripMul(tok)
  const bare = base.replace(/^\[|\]$/g, '').split(/[,\s]/)[0] ?? base
  return SNARE_RE.test(bare)
}

function isClapish(tok: string): boolean {
  const { base } = stripMul(tok)
  const bare = base.replace(/^\[|\]$/g, '').split(/[,\s]/)[0] ?? base
  return /^(cp|clap)/i.test(bare)
}

/** Sparse: turn every other non-rest into ~ (keep first of each pair). */
export function transformSparse(tokens: string[]): string[] {
  let hit = 0
  return tokens.map((t) => {
    if (isRest(t)) return t
    hit++
    return hit % 2 === 0 ? '~' : t
  })
}

/** Denser: fill rests with previous hit; if no rests, double each hit via *2 / bump mul. */
export function transformDenser(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens
  const hasRest = tokens.some(isRest)
  if (hasRest) {
    let last: string | null = null
    return tokens.map((t) => {
      if (!isRest(t)) {
        last = t
        return t
      }
      return last ?? t
    })
  }
  return tokens.map((t) => {
    if (isRest(t)) return t
    const { base, mul } = stripMul(t)
    const next = mul == null ? 2 : Math.min(8, mul * 2)
    return withMul(base, next)
  })
}

/** Straighten: flatten <a b> → a; strip odd-position rests by shifting hits left onto a grid. */
export function transformStraighten(tokens: string[]): string[] {
  const flat = tokens.map((t) => {
    const m = t.match(/^<([^>]+)>$/)
    if (m) {
      const inner = tokenizeMini(m[1]!)
      return inner.find((x) => !isRest(x)) ?? '~'
    }
    return t
  })
  const hits = flat.filter((t) => !isRest(t))
  if (hits.length === 0) return flat
  const n = Math.max(flat.length, hits.length)
  const out: string[] = []
  let hi = 0
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0 && hi < hits.length) {
      out.push(hits[hi++]!)
    } else {
      out.push('~')
    }
  }
  while (hi < hits.length) out.push(hits[hi++]!)
  return out
}

/** Syncopate: move each hit one step later (wrap). */
export function transformSyncopate(tokens: string[]): string[] {
  if (tokens.length < 2) return tokens.length === 1 && !isRest(tokens[0]!) ? ['~', tokens[0]!] : tokens
  const out = tokens.map(() => '~')
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (isRest(t)) continue
    out[(i + 1) % tokens.length] = t
  }
  return out
}

/** Half-time: stretch — each token followed by ~. */
export function transformHalfTime(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens
  const out: string[] = []
  for (const t of tokens) {
    out.push(t, '~')
  }
  return out
}

/** Double-time: collapse hit/~ pairs; else drop odd rests; else pack two cycles into one. */
export function transformDoubleTime(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens
  if (tokens.length >= 2 && tokens.length % 2 === 0) {
    let pairs = true
    for (let i = 0; i < tokens.length; i += 2) {
      if (isRest(tokens[i]!)) {
        pairs = false
        break
      }
      if (!isRest(tokens[i + 1]!)) {
        pairs = false
        break
      }
    }
    if (pairs) return tokens.filter((_, i) => i % 2 === 0)
  }
  const withoutOddRests = tokens.filter((t, i) => !(isRest(t) && i % 2 === 1))
  if (withoutOddRests.length < tokens.length && withoutOddRests.some((t) => !isRest(t))) {
    return withoutOddRests
  }
  return [...tokens, ...tokens]
}

/** Ghosts: replace rests between hits with a soft copy of the previous hit as [hit, ~]. */
export function transformGhosts(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens
  let last: string | null = null
  const out: string[] = []
  let filledRest = false
  for (const t of tokens) {
    if (!isRest(t)) {
      last = stripMul(t).base
      out.push(t)
      continue
    }
    if (last && !filledRest) {
      out.push(`[${last},~]`)
      filledRest = true
    } else {
      out.push(t)
    }
  }
  if (!filledRest && last) {
    const woven: string[] = []
    for (let i = 0; i < tokens.length; i++) {
      woven.push(tokens[i]!)
      if (!isRest(tokens[i]!) && i < tokens.length - 1) {
        woven.push(`[${stripMul(tokens[i]!).base},~]`)
      }
    }
    return woven
  }
  return out
}

/** Skeleton: drums → kicks + sparse hats; melodic → root/first pitch drones. */
export function transformSkeleton(tokens: string[], kind: 's' | 'note', role: TrackRole): string[] {
  if (kind === 'note' || isMelodicRole(role)) {
    const pitches = tokens.filter((t) => !isRest(t))
    if (pitches.length === 0) return tokens
    const root = stripMul(pitches[0]!).base
    let keep = 0
    return tokens.map((t) => {
      if (isRest(t)) return t
      keep++
      return keep === 1 || keep % 4 === 1 ? root : '~'
    })
  }
  let hatCount = 0
  return tokens.map((t) => {
    if (isRest(t)) return t
    if (isKickish(t)) return stripMul(t).base
    if (isHatish(t)) {
      hatCount++
      return hatCount % 2 === 1 ? stripMul(t).base : '~'
    }
    return '~'
  })
}

/** Stutter: ratchet last non-rest — base*4 */
export function transformStutter(tokens: string[]): string[] {
  const out = [...tokens]
  for (let i = out.length - 1; i >= 0; i--) {
    if (isRest(out[i]!)) continue
    const { base } = stripMul(out[i]!)
    out[i] = `${base}*4`
    return out
  }
  return out
}

export function transformRotate(tokens: string[], dir: -1 | 1): string[] {
  if (tokens.length < 2) return tokens
  if (dir === 1) return [tokens[tokens.length - 1]!, ...tokens.slice(0, -1)]
  return [...tokens.slice(1), tokens[0]!]
}

export function transformReverse(tokens: string[]): string[] {
  return [...tokens].reverse()
}

export function transformEveryOther(tokens: string[]): string[] {
  let hit = 0
  return tokens.map((t) => {
    if (isRest(t)) return t
    hit++
    return hit % 2 === 1 ? t : '~'
  })
}


const PERC_ROLES = new Set<TrackRole>(['drums', 'hihats', 'fx'])

function intensityDir(id: MutateId): 1 | -1 | 0 {
  if (id === 'intensity-up') return 1
  if (id === 'intensity-down') return -1
  return 0
}

function sameHit(a: string, b: string): boolean {
  return stripMul(a).base === stripMul(b).base
}

export function isKickToken(tok: string): boolean {
  const b = stripMul(tok).base.toLowerCase()
  return /^(bd|kick|bassdrum\d*)$/.test(b) || b.startsWith('bd')
}

/** Fill rests; leave already-dense patterns alone (no 16→32). */
export function transformTo16NoDup(tokens: string[]): string[] {
  if (tokens.length === 0 || !tokens.some(isRest)) return tokens
  let last: string | null = null
  return tokens.map((t) => {
    if (!isRest(t)) {
      last = t
      return t
    }
    return last ?? t
  })
}

/** Like 16-fill, but never turn a kick rest into another kick. */
export function transformTo16KickSafe(tokens: string[]): string[] {
  if (tokens.length === 0 || !tokens.some(isRest)) return tokens
  let last: string | null = null
  return tokens.map((t) => {
    if (!isRest(t)) {
      last = t
      return t
    }
    if (last && isKickToken(last)) return t
    return last ?? t
  })
}

/** 8-beat → 16-beat: fill rests with the previous hit; if already dense, duplicate each. */
export function transformTo16(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens
  if (tokens.some(isRest)) {
    let last: string | null = null
    return tokens.map((t) => {
      if (!isRest(t)) {
        last = t
        return t
      }
      return last ?? t
    })
  }
  const out: string[] = []
  for (const t of tokens) {
    out.push(t, stripMul(t).base)
  }
  return out
}

/** Like transformTo16, but only fill/duplicate tokens matching pred (one pass; no stacked fills). */
export function transformTo16Where(tokens: string[], pred: (tok: string) => boolean): string[] {
  if (tokens.length === 0) return tokens
  if (tokens.some(isRest)) {
    let last: string | null = null
    return tokens.map((t) => {
      if (!isRest(t)) {
        last = t
        return t
      }
      if (last && pred(last)) return last
      return t
    })
  }
  const out: string[] = []
  for (const t of tokens) {
    if (pred(t)) out.push(t, stripMul(t).base)
    else out.push(t)
  }
  return out
}

/** 16-beat → 8-beat: paired same hits become hit/~; else keep the 8th-note grid. */
export function transformTo8(tokens: string[]): string[] {
  if (tokens.length < 2) return tokens
  if (tokens.length % 2 === 0) {
    const paired = tokens.every((_, i) => i % 2 === 1 || sameHit(tokens[i]!, tokens[i + 1]!))
    if (paired) {
      const out: string[] = []
      for (let i = 0; i < tokens.length; i += 2) {
        out.push(tokens[i]!, '~')
      }
      return out
    }
    return tokens.filter((_, i) => i % 2 === 0)
  }
  return transformSparse(tokens)
}

export function applyTokenTransform(
  tokens: string[],
  id: MutateId,
  kind: 's' | 'note',
  role: TrackRole,
): string[] {
  switch (id) {
    case 'sparse':
      return transformSparse(tokens)
    case 'denser':
      return transformDenser(tokens)
    case 'straighten':
      return transformStraighten(tokens)
    case 'syncopate':
      return transformSyncopate(tokens)
    case 'half-time':
      return transformHalfTime(tokens)
    case 'ghosts':
      return transformGhosts(tokens)
    case 'skeleton':
      return transformSkeleton(tokens, kind, role)
    case 'stutter':
      return transformStutter(tokens)
    case 'rotate-l':
      return transformRotate(tokens, -1)
    case 'rotate-r':
      return transformRotate(tokens, 1)
    case 'reverse':
      return transformReverse(tokens)
    case 'every-other':
      return transformEveryOther(tokens)
    case 'double-time':
      return transformDoubleTime(tokens)
    case 'intensity-up':
    case 'intensity-down': {
      const dir = intensityDir(id)
      if (!dir) return tokens
      const hits =
        dir === 1
          ? role === 'drums'
            ? transformTo16KickSafe(tokens)
            : transformTo16NoDup(tokens)
          : transformTo8(tokens)
      if (kind === 'note' && role === 'bass') return hits
      if (kind === 's' && PERC_ROLES.has(role)) return hits
      if (kind === 's' && role === 'bass' && tokens.length > 1) return hits
      return tokens
    }
    default:
      return tokens
  }
}

/**
 * Single-token s("sawtooth") before note(...) is a voice pin — skip.
 * Multi-token / rests / *mul are rhythmic patterns.
 */
export function isRhythmicSBody(body: string): boolean {
  const toks = tokenizeMini(body)
  if (toks.length === 0) return false
  if (toks.length > 1) return true
  const t = toks[0]!
  if (isRest(t)) return true
  if (/\*|~|<|>|\[|\]/.test(t)) return true
  if (parseEuclidMini(t)) return true
  return false
}

function mapQuotedCalls(
  code: string,
  fnName: 's' | 'note',
  mapBody: (body: string) => string | null,
): string {
  const re = new RegExp(`\\b${fnName}\\(\\s*(["'])([^"'\\\\]*)\\1\\s*\\)`, 'g')
  return code.replace(re, (full, quote: string, body: string) => {
    const next = mapBody(body)
    if (next == null || next === body) return full
    return `${fnName}(${quote}${next}${quote})`
  })
}

/** Transform pattern strings inside head; leave FX/sound chain alone. */
export function mutatePatternCode(
  code: string,
  id: MutateId,
  role: TrackRole,
): string {
  const { head, fx } = splitEffectSuffix(code)
  let next = head
  const hasNote = /\bnote\s*\(/.test(head)

  next = mapQuotedCalls(next, 'note', (body) => {
    const toks = tokenizeMini(body)
    if (toks.length === 0) return null
    return joinMini(applyTokenTransform(toks, id, 'note', role))
  })

  next = mapQuotedCalls(next, 's', (body) => {
    if (hasNote && !isRhythmicSBody(body)) return null
    if (!isRhythmicSBody(body) && !hasNote) {
      const toks = tokenizeMini(body)
      if (
        toks.length === 1 &&
        !isRest(toks[0]!) &&
        !/\*/.test(toks[0]!) &&
        !parseEuclidMini(toks[0]!)
      ) {
        if (
          id === 'stutter' ||
          id === 'skeleton' ||
          id === 'half-time' ||
          id === 'double-time' ||
          id === 'denser' ||
          id === 'ghosts'
        ) {
          return joinMini(applyTokenTransform(toks, id, 's', role))
        }
        return null
      }
    }
    const toks = tokenizeMini(body)
    if (toks.length === 0) return null
    return joinMini(applyTokenTransform(toks, id, 's', role))
  })

  if (next === head) return code
  return next + fx
}

/**
 * Map s()/note() bodies the same way mutatePatternCode does — FX/sound suffix stays put.
 */
function mapIntensityBodies(
  code: string,
  mapS: (toks: string[]) => string[] | null,
  mapNote: (toks: string[]) => string[] | null,
): string {
  const { head, fx } = splitEffectSuffix(code)
  let next = head
  const hasNote = /\bnote\s*\(/.test(head)

  next = mapQuotedCalls(next, 'note', (body) => {
    const toks = tokenizeMini(body)
    if (toks.length === 0) return null
    const mapped = mapNote(toks)
    return mapped ? joinMini(mapped) : null
  })

  next = mapQuotedCalls(next, 's', (body) => {
    if (hasNote && !isRhythmicSBody(body)) return null
    if (!isRhythmicSBody(body) && !hasNote) {
      const toks = tokenizeMini(body)
      if (
        toks.length === 1 &&
        !isRest(toks[0]!) &&
        !/\*/.test(toks[0]!) &&
        !parseEuclidMini(toks[0]!)
      ) {
        return null
      }
    }
    const toks = tokenizeMini(body)
    if (toks.length === 0) return null
    const mapped = mapS(toks)
    return mapped ? joinMini(mapped) : null
  })

  return next + fx
}

type BracketGroup = {
  open: '[' | '<'
  close: ']' | '>'
  inner: string
  mul: number | null
}

function parseBracketGroup(tok: string): BracketGroup | null {
  const m = tok.match(/^(\[)([\s\S]*)\](?:\*(\d+(?:\.\d+)?))?$/)
  if (m) {
    return { open: '[', close: ']', inner: m[2]!, mul: m[3] != null ? Number(m[3]) : null }
  }
  const m2 = tok.match(/^(<)([\s\S]*)>(?:\*(\d+(?:\.\d+)?))?$/)
  if (m2) {
    return { open: '<', close: '>', inner: m2[2]!, mul: m2[3] != null ? Number(m2[3]) : null }
  }
  return null
}

function rebuildBracketGroup(g: BracketGroup, innerToks: string[]): string {
  return withMul(`${g.open}${joinMini(innerToks)}${g.close}`, g.mul)
}

function barePitchToken(tok: string): string {
  let base = stripMul(tok).base
  base = base.replace(/@[\d.]+$/i, '')
  return base
}

function tokenMidi(tok: string): number | null {
  const p = parseNoteToken(barePitchToken(tok))
  if (!p) return null
  return p.pc + p.octave * 12
}

/**
 * Fill every rest from nearest matching hit (previous if any, else look-ahead).
 * Densify inner []/<> groups that contain rests first; if no top-level rests,
 * bump *N / euclid or duplicate matching tokens.
 */
export function fillSilences(tokens: string[], pred: (tok: string) => boolean): string[] {
  if (tokens.length === 0) return tokens

  const densified = tokens.map((t) => {
    const g = parseBracketGroup(t)
    if (!g) return t
    const inner = tokenizeMini(g.inner)
    if (!inner.some(isRest)) return t
    return rebuildBracketGroup(g, fillSilences(inner, pred))
  })

  const hasMatch = densified.some((t) => !isRest(t) && pred(t))
  if (!hasMatch) return densified

  if (densified.some(isRest)) {
    const n = densified.length
    const nextMatch: (string | null)[] = Array(n).fill(null)
    let upcoming: string | null = null
    for (let i = n - 1; i >= 0; i--) {
      nextMatch[i] = upcoming
      const t = densified[i]!
      if (!isRest(t) && pred(t)) upcoming = t
    }
    let last: string | null = null
    return densified.map((t, i) => {
      if (!isRest(t)) {
        if (pred(t)) last = t
        return t
      }
      const fill = last ?? nextMatch[i]
      if (!fill) return t
      last = fill
      return fill
    })
  }

  const out: string[] = []
  for (const t of densified) {
    if (isRest(t) || !pred(t)) {
      out.push(t)
      continue
    }
    const { base, mul } = stripMul(t)
    if (mul != null) {
      out.push(withMul(base, Math.min(16, mul * 2)))
      continue
    }
    const eu = parseEuclidMini(base)
    if (eu) {
      out.push(formatEuclidMini(eu.name, bumpEuclidHits(eu.k, eu.n), eu.n, eu.rot))
      continue
    }
    out.push(t, stripMul(t).base)
  }
  return out
}

/**
 * Double a voice in place: extra hit halfway to the next same-voice hit
 * (wraps). Only writes into rests — never overwrites. *N → *2N (cap 16).
 * bd ~ ~ ~ → bd ~ bd ~    ~ sd ~ ~ → ~ sd ~ sd    bd*4 → bd*8
 */
export function doubleImmediate(tokens: string[], pred: (tok: string) => boolean): string[] {
  if (tokens.length === 0) return tokens

  const densified = tokens.map((t) => {
    const g = parseBracketGroup(t)
    if (!g) return t
    const inner = tokenizeMini(g.inner)
    if (inner.length > 1 || inner.some(isRest)) {
      return rebuildBracketGroup(g, doubleImmediate(inner, pred))
    }
    return t
  })

  const n = densified.length
  const out = densified.map((t) => {
    if (isRest(t) || !pred(t)) return t
    const { base, mul } = stripMul(t)
    if (mul != null) return withMul(base, Math.min(16, mul * 2))
    return t
  })

  const idxs: number[] = []
  for (let i = 0; i < n; i++) {
    const t = densified[i]!
    if (!isRest(t) && pred(t) && stripMul(t).mul == null) idxs.push(i)
  }
  if (idxs.length === 0) return out

  for (let k = 0; k < idxs.length; k++) {
    const i = idxs[k]!
    const next = k + 1 < idxs.length ? idxs[k + 1]! : idxs[0]! + n
    const mid = (i + Math.floor((next - i) / 2)) % n
    if (mid !== i && isRest(out[mid]!)) out[mid] = densified[i]!
  }
  return out
}

export type BassWalkOpts = {
  root?: string
  scale?: ScaleKind
  /** Named Keys/Piano/… lane — same L4 walk as bass. */
  keys?: boolean
}

function collectPhraseMidis(tokens: string[]): number[] {
  const out: number[] = []
  for (const t of tokens) {
    if (isRest(t)) continue
    const g = parseBracketGroup(t)
    if (g) {
      out.push(...collectPhraseMidis(tokenizeMini(g.inner)))
      continue
    }
    const m = tokenMidi(t)
    if (m != null) out.push(m)
  }
  return out
}

function scaleMidisBetween(lo: number, hi: number, rootPc: number, degs: number[]): number[] {
  const out: number[] = []
  for (let m = lo + 1; m < hi; m++) {
    const rel = (((m % 12) + 12) % 12 - rootPc + 12) % 12
    if (degs.includes(rel)) out.push(m)
  }
  return out
}

function walkNoteAt(midi: number): string {
  const pc = ((midi % 12) + 12) % 12
  const oct = Math.floor(midi / 12)
  return `${formatNote(pc, oct)}@0.5`
}

/**
 * L4 bass: keep core pitches in order; plant short walk tones (@0.5) in rests
 * or between hits. Walk pitches come from in-scale steps between neighbors
 * (inferred from the phrase, optional song root/scale).
 */
export function enrichBassWalk(tokens: string[], opts?: BassWalkOpts): string[] {
  if (tokens.length === 0) return tokens

  const withGroups = tokens.map((t) => {
    const g = parseBracketGroup(t)
    if (!g) return t
    const inner = tokenizeMini(g.inner)
    if (inner.length < 2 && !inner.some(isRest)) return t
    return rebuildBracketGroup(g, enrichBassWalk(inner, opts))
  })

  const phraseMidis = collectPhraseMidis(withGroups)
  if (phraseMidis.length === 0) {
    // Non-pitch rhythmic bass — fall back to same-hit densify
    return fillSilences(withGroups, (t) => !isRest(t))
  }

  const rootPc =
    opts?.root != null ? rootIndex(opts.root) : (((phraseMidis[0]! % 12) + 12) % 12)
  const scale: ScaleKind = opts?.scale ?? 'minor'
  const degs = SCALE_DEGREES[scale] ?? SCALE_DEGREES.minor

  const phraseMin = Math.min(...phraseMidis)
  const phraseMax = Math.max(...phraseMidis)
  const usedWalks: number[] = []

  const pickWalk = (prev: string | null, next: string | null): string => {
    const pM = prev ? tokenMidi(prev) : null
    const nM = next ? tokenMidi(next) : null

    if (pM != null && nM != null) {
      const lo = Math.min(pM, nM)
      const hi = Math.max(pM, nM)
      const cands = scaleMidisBetween(lo, hi, rootPc, degs)
      if (cands.length) {
        const pick = cands[Math.floor(cands.length / 2)]!
        usedWalks.push(pick)
        return walkNoteAt(pick)
      }
    }

    const span = scaleMidisBetween(phraseMin, phraseMax, rootPc, degs).filter(
      (m) => m !== pM && m !== nM,
    )
    for (const m of span) {
      if (!usedWalks.includes(m)) {
        usedWalks.push(m)
        return walkNoteAt(m)
      }
    }
    if (span.length) {
      const m = span[usedWalks.length % span.length]!
      usedWalks.push(m)
      return walkNoteAt(m)
    }

    const anchor = pM ?? nM ?? phraseMidis[0]!
    for (const delta of [2, -2, 3, -3, 1, -1]) {
      const m = anchor + delta
      if (m === pM || m === nM) continue
      usedWalks.push(m)
      return walkNoteAt(m)
    }
    usedWalks.push(anchor + 2)
    return walkNoteAt(anchor + 2)
  }

  const findNextPitch = (from: number): string | null => {
    for (let i = from; i < withGroups.length; i++) {
      const t = withGroups[i]!
      if (isRest(t)) continue
      if (parseBracketGroup(t)) continue
      if (tokenMidi(t) != null) return t
    }
    return null
  }

  if (withGroups.some(isRest)) {
    let lastPitch: string | null = null
    return withGroups.map((t, i) => {
      if (!isRest(t)) {
        if (!parseBracketGroup(t) && tokenMidi(t) != null) lastPitch = t
        return t
      }
      const nextPitch = findNextPitch(i + 1)
      return pickWalk(lastPitch, nextPitch)
    })
  }

  // No rests: insert short walks between consecutive pitch tokens (cores stay).
  const out: string[] = []
  for (let i = 0; i < withGroups.length; i++) {
    const t = withGroups[i]!
    out.push(t)
    if (parseBracketGroup(t) || isRest(t) || tokenMidi(t) == null) continue
    let j = i + 1
    while (j < withGroups.length && (isRest(withGroups[j]!) || parseBracketGroup(withGroups[j]!))) {
      j++
    }
    if (j >= withGroups.length) continue
    const next = withGroups[j]!
    if (tokenMidi(next) == null) continue
    out.push(pickWalk(t, next))
  }
  return out
}

/**
 * L4 densify layer only (kick/snare double, bass/keys walk, fx snare-family).
 * No hat fillSilences, no bumpEuclidCalls — for stacking on L3 (= L2 hats + spawn).
 */
export function applyIntensityL4Layer(
  code: string,
  role: TrackRole,
  harmony?: BassWalkOpts,
): string {
  return mapIntensityBodies(
    code,
    (toks) => {
      if (role === 'drums') {
        return doubleImmediate(toks, (t) => isKickish(t) || isSnareish(t))
      }
      if (role === 'fx') {
        return doubleImmediate(toks, (t) => isKickish(t) || isSnareish(t) || isClapish(t))
      }
      if (role === 'bass' || harmony?.keys) return enrichBassWalk(toks, harmony)
      return null
    },
    (toks) => {
      if (role === 'bass' || harmony?.keys) return enrichBassWalk(toks, harmony)
      return null
    },
  )
}

/**
 * Rebuild intensity pattern from a level-1 generate (L1→L2 hats, L1→L4 hats+densify).
 * Prefer applyIntensityL4Layer when stacking L4 on an L3/L2 base (do not re-run hats).
 * No mush FX.
 */
export function applyIntensityFromBase(
  code: string,
  role: TrackRole,
  level: IntensityLevel,
  harmony?: BassWalkOpts & { from?: IntensityLevel },
): string {
  if (level <= 1) return code
  const from = harmony?.from ?? 1
  // Already at L2/L3 pattern base: only apply L4 densify layer (no hats/euclid).
  if (from >= 2) {
    if (level >= 4) return applyIntensityL4Layer(code, role, harmony)
    return code
  }
  let next = mapIntensityBodies(
    code,
    (toks) => {
      if (role === 'hihats' && level >= 2) return fillSilences(toks, (t) => !isRest(t))
      if (role === 'drums') {
        if (level >= 4) {
          const doubled = doubleImmediate(toks, (t) => isKickish(t) || isSnareish(t))
          return fillSilences(doubled, isHatish)
        }
        if (level >= 2) return fillSilences(toks, isHatish)
      }
      if (role === 'fx' && level >= 4) {
        return doubleImmediate(toks, (t) => isKickish(t) || isSnareish(t) || isClapish(t))
      }
      if ((role === 'bass' || harmony?.keys) && level >= 4) return enrichBassWalk(toks, harmony)
      return null
    },
    (toks) => {
      if ((role === 'bass' || harmony?.keys) && level >= 4) return enrichBassWalk(toks, harmony)
      return null
    },
  )
  if ((role === 'hihats' || role === 'drums') && level >= 2) next = bumpEuclidCalls(next)
  return next
}

export type MutateApplyResult = {
  id: MutateId
  label: string
  scope: MutateScope
  changes: { trackId: string; code: string }[]
}

/**
 * Compute mutated codes. Song scope = all unlocked tracks; track scope = preferTrackId.
 */
export function applyMutateToTracks(
  tracks: readonly Track[],
  mutateId: MutateId,
  preferTrackId?: string | null,
): MutateApplyResult | null {
  const def = getMutation(mutateId)
  if (!def) return null
  if (tracks.length === 0) return null

  const targets: Track[] =
    def.scope === 'song'
      ? tracks.filter((t) => !t.locked)
      : (() => {
          const id =
            preferTrackId && tracks.some((t) => t.id === preferTrackId)
              ? preferTrackId
              : tracks[0]?.id
          const t = tracks.find((x) => x.id === id)
          if (!t) return []
          if (t.locked) return []
          return [t]
        })()

  if (targets.length === 0) return null

  const changes: { trackId: string; code: string }[] = []
  for (const t of targets) {
    const code = mutatePatternCode(t.code, mutateId, t.role)
    if (code !== t.code) changes.push({ trackId: t.id, code })
  }
  if (changes.length === 0) return null
  return { id: def.id, label: def.label, scope: def.scope, changes }
}
