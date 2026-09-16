/**
 * Song bar length (1 / 2 / 4). One Strudel cycle = one bar at Jam cps.
 * Multi-bar form uses top-level cat(...) — no .slow / time-stretch.
 */

export type SongBars = 1 | 2 | 4

export const SONG_BARS_OPTIONS: SongBars[] = [1, 2, 4]

export function isSongBars(n: unknown): n is SongBars {
  return n === 1 || n === 2 || n === 4
}

export function clampSongBars(n: unknown): SongBars {
  const v = typeof n === 'string' ? Number(n) : n
  if (v === 2 || v === 4) return v
  return 1
}

/** Split top-level comma args; respects strings, parens, brackets, braces. */
export function splitTopLevelArgs(src: string): string[] {
  const out: string[] = []
  let buf = ''
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0
  let quote: string | null = null
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quote) {
      buf += ch
      if (ch === '\\') {
        if (i + 1 < src.length) {
          buf += src[++i]!
        }
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      buf += ch
      continue
    }
    if (ch === '(') {
      depthParen++
      buf += ch
      continue
    }
    if (ch === ')') {
      depthParen = Math.max(0, depthParen - 1)
      buf += ch
      continue
    }
    if (ch === '[') {
      depthBracket++
      buf += ch
      continue
    }
    if (ch === ']') {
      depthBracket = Math.max(0, depthBracket - 1)
      buf += ch
      continue
    }
    if (ch === '{') {
      depthBrace++
      buf += ch
      continue
    }
    if (ch === '}') {
      depthBrace = Math.max(0, depthBrace - 1)
      buf += ch
      continue
    }
    if (
      ch === ',' &&
      depthParen === 0 &&
      depthBracket === 0 &&
      depthBrace === 0
    ) {
      const part = buf.trim()
      if (part) out.push(part)
      buf = ''
      continue
    }
    buf += ch
  }
  const last = buf.trim()
  if (last) out.push(last)
  return out
}

/**
 * If code is a bare top-level cat(...), return its parts; else [code].
 * Nested cat inside method chains is treated as a single cell.
 */
export function splitSongBarParts(code: string): string[] {
  const t = code.trim()
  if (!t) return ['silence']
  const m = /^cat\s*\(([\s\S]*)\)\s*$/.exec(t)
  if (!m) return [t]
  const parts = splitTopLevelArgs(m[1]!)
  return parts.length > 0 ? parts : [t]
}

export function joinSongBarParts(parts: string[]): string {
  const clean = parts.map((p) => p.trim()).filter(Boolean)
  if (clean.length === 0) return 'silence'
  if (clean.length === 1) return clean[0]!
  return `cat(${clean.join(', ')})`
}

/**
 * Fit track code to N bars without time-stretch:
 * - lengthen → tile existing bar cells
 * - shorten → keep the first N cells
 * Bare 1-cell code becomes cat(cell×N) when N>1.
 */
export function fitCodeToSongBars(code: string, bars: SongBars): string {
  const n = clampSongBars(bars)
  const parts = splitSongBarParts(code)
  if (n === 1) return parts[0]!.trim() || 'silence'
  if (parts.length === n) return joinSongBarParts(parts)
  if (parts.length > n) return joinSongBarParts(parts.slice(0, n))
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(parts[i % parts.length]!)
  return joinSongBarParts(out)
}

/** Bar index within the song [1, bars] from absolute cycle count. */
export function songBarIndex(cycleInt: number, bars: SongBars): number {
  const n = clampSongBars(bars)
  const c = Math.floor(cycleInt)
  return ((c % n) + n) % n + 1
}
