/**
 * Jam Mutate — deterministic pattern transforms on s("...") / note("...") mini-notation.
 * Keeps Sound / bank / FX chain intact (splitEffectSuffix spirit). Not Shuffle, not Spice.
 */
import type { Track, TrackRole } from './types'
import { splitEffectSuffix } from './code-effects'
import { isMelodicRole } from './note-harmony'

export type MutateScope = 'track' | 'song'

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
  { id: 'half-time', label: 'Half-time', hint: 'Stretch feel · all tracks', scope: 'song' },
  { id: 'ghosts', label: 'Ghosts', hint: 'Quiet in-between hits', scope: 'track' },
  { id: 'skeleton', label: 'Skeleton', hint: 'Kick+hats / root drones', scope: 'track' },
  { id: 'stutter', label: 'Stutter', hint: 'Ratchet the last hit', scope: 'track' },
  { id: 'rotate-l', label: 'Rotate L', hint: 'Shift −1 beat', scope: 'track' },
  { id: 'rotate-r', label: 'Rotate R', hint: 'Shift +1 beat', scope: 'track' },
  { id: 'reverse', label: 'Reverse', hint: 'Flip the pattern', scope: 'track' },
  { id: 'every-other', label: 'Every other', hint: 'Keep alternate hits', scope: 'track' },
  { id: 'double-time', label: 'Double-time', hint: 'Tighten feel · all tracks', scope: 'song' },
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

const KICK_RE = /^(bd|kick|bassdrum|lt|kick:|bd:)/i
const HAT_RE = /^(hh|oh|ch|ph|hat|shaker|rim|clap|cp|hc)/i

function isKickish(tok: string): boolean {
  const { base } = stripMul(tok)
  const bare = base.replace(/^\[|\]$/g, '').split(/[,\s]/)[0] ?? base
  return KICK_RE.test(bare)
}

function isHatish(tok: string): boolean {
  const { base } = stripMul(tok)
  const bare = base.replace(/^\[|\]$/g, '').split(/[,\s]/)[0] ?? base
  return HAT_RE.test(bare)
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
export function mutatePatternCode(code: string, id: MutateId, role: TrackRole): string {
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
      if (toks.length === 1 && !isRest(toks[0]!) && !/\*/.test(toks[0]!)) {
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
