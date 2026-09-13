import type { Track } from './types'

/** Header Code sheet — one editor for every track. */
export const CODE_ALL = '__all__'

export const ALL_CODE_FILENAME = 'strudel-studio.strudel'

/** Picker hint. Import is content-based — `.strudel` needs no `.js`. */
export const IMPORT_FILE_ACCEPT = '.strudel,.txt,text/plain,*/*'

export function slugJamPart(s: string): string {
  const t = s
    .toLowerCase()
    .replace(/#/g, 's')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return t.slice(0, 40) || 'jam'
}

/** kit-root-scale-bpm — used by Export and Take. */
export function jamFileStem(meta: {
  kit?: string | null
  root?: string | null
  scale?: string | null
  bpm?: number | null
}): string {
  const kit = slugJamPart(meta.kit ?? 'jam')
  const root = slugJamPart(meta.root ?? 'c')
  const scale = slugJamPart(meta.scale ?? 'minor')
  const bpm = Math.round(Number(meta.bpm))
  const tempo = Number.isFinite(bpm) && bpm > 0 ? String(bpm) : '120'
  return `${kit}-${root}-${scale}-${tempo}`
}

export function allCodeFilename(meta: {
  kit?: string | null
  root?: string | null
  scale?: string | null
  bpm?: number | null
}): string {
  return `${jamFileStem(meta)}.strudel`
}

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

function unbalancedSyntax(text: string): boolean {
  const pairs: [string, string][] = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ]
  for (const [open, close] of pairs) {
    let depth = 0
    let quote: string | null = null
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!
      if (quote) {
        if (ch === '\\') {
          i++
          continue
        }
        if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
        continue
      }
      if (ch === open) depth++
      else if (ch === close) depth--
      if (depth < 0) return true
    }
    if (depth !== 0) return true
  }
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
  }
  return quote != null
}

const SNIPPET_RE = /\b(?:s|note|sound)\s*\(/

export type ImportCheck = { ok: true } | { ok: false; message: string }

/** Paste / file import: syntax + // @track shape. */
export function checkImportCode(text: string, tracks: Track[]): ImportCheck {
  const t = text.trim()
  if (!t) return { ok: false, message: 'Nothing to import' }
  if (unbalancedSyntax(t)) {
    return { ok: false, message: 'Invalid syntax — unmatched brackets or quotes' }
  }
  const parsed = parseAllCode(text, tracks)
  if (parsed.length > 0) return { ok: true }
  if (/\/\/\s*@track\b/.test(text)) {
    return { ok: false, message: 'No // @track ids match this jam' }
  }
  if (SNIPPET_RE.test(t)) return { ok: true }
  return { ok: false, message: 'Need // @track id lines, or a s()/note() line' }
}

/**
 * Apply an import buffer: @track sections, or a single snippet onto last-touched.
 */
export function applyImportToTracks(
  text: string,
  tracks: Track[],
  lastTouchedId?: string | null,
): { id: string; code: string }[] {
  const fromHeads = applyAllCodeToTracks(text, tracks)
  if (fromHeads.length > 0 || parseAllCode(text, tracks).length > 0) return fromHeads
  const t = text.trim()
  if (!SNIPPET_RE.test(t)) return []
  const id =
    lastTouchedId && tracks.some((x) => x.id === lastTouchedId)
      ? lastTouchedId
      : tracks[0]?.id
  if (!id) return []
  const cur = tracks.find((x) => x.id === id)
  if (!cur || cur.code === t) return []
  return [{ id, code: t }]
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Browser download of the all-tracks buffer. */
export function downloadAllCode(text: string, filename = ALL_CODE_FILENAME): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename)
}
