import type { Track } from './types'

/** Header Code sheet — one editor for every track. */
export const CODE_ALL = '__all__'

const HEAD = /^\/\/ @track (\S+)(?:\s+.*)?$/

export function isCodeAllOpen(codeTrackId: string | null | undefined): boolean {
  return codeTrackId === CODE_ALL
}

/** Serialize session tracks into one editable buffer. */
export function tracksToAllCode(tracks: Track[]): string {
  if (tracks.length === 0) return '// no tracks'
  return tracks
    .map((t) => `// @track ${t.id}  ${t.name}\n${t.code.trim()}`)
    .join('\n\n')
}

/**
 * Split the all-tracks buffer back onto known ids.
 * Unknown headers are ignored. Tracks missing a section stay unchanged.
 */
export function parseAllCode(
  text: string,
  tracks: Track[],
): { id: string; code: string }[] {
  const known = new Set(tracks.map((t) => t.id))
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: { id: string; code: string }[] = []
  let cur: string | null = null
  let buf: string[] = []

  const flush = () => {
    if (cur && known.has(cur)) {
      out.push({ id: cur, code: buf.join('\n').trim() })
    }
    cur = null
    buf = []
  }

  for (const line of lines) {
    const m = line.match(HEAD)
    if (m) {
      flush()
      cur = m[1]!
      buf = []
      continue
    }
    if (cur) buf.push(line)
  }
  flush()
  return out
}

export function applyAllCodeToTracks(
  text: string,
  tracks: Track[],
): { id: string; code: string }[] {
  const parsed = parseAllCode(text, tracks)
  return parsed.filter((p) => {
    const t = tracks.find((tr) => tr.id === p.id)
    return t != null && t.code !== p.code
  })
}
