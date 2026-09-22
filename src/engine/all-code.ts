import type { Track, TrackRole } from './types'
import { ROLE_COLORS, defaultTrackVolume } from './types'
import type { ScaleKind } from './kits-types'
import { getKit, KITS } from './kits'
import { SONG_SCALES } from './note-harmony'
import { useJamStore } from '../store/jam-store'
import { useSessionStore } from '../store/session-store'

/** Header Code sheet — one editor for every track. */
export const CODE_ALL = '__all__'

export const ALL_CODE_FILENAME = 'strudel-studio.strudel'

/** Picker hint. Import is content-based — `.strudel` needs no `.js`. */
export const IMPORT_FILE_ACCEPT = '.strudel,.txt,text/plain,*/*'

export type AllCodeMeta = {
  kitId?: string | null
  kitName?: string | null
  root?: string | null
  scale?: string | null
  bpm?: number | null
}

export type JamHeader = {
  kitId?: string
  kitName?: string
  root?: string
  scale?: string
  bpm?: number
}

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

const HEAD = /^\/\/ @track (\S+)(?:\s+(.*))?$/
const JAM_LINE = /^\/\/\s*@jam\b(.*)$/

function escapeJamName(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function unescapeJamName(name: string): string {
  return name.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

/** First-line chrome header so paste Import can restore kit/root/scale/tempo. */
export function formatJamHeader(meta: AllCodeMeta): string {
  const kit = (meta.kitId ?? '').trim() || 'none'
  const name = escapeJamName((meta.kitName ?? '').trim())
  const root = (meta.root ?? '').trim() || 'c'
  const scale = (meta.scale ?? '').trim() || 'minor'
  const bpm = Math.round(Number(meta.bpm))
  const tempo = Number.isFinite(bpm) && bpm > 0 ? bpm : 120
  return `// @jam kit=${kit} name="${name}" root=${root} scale=${scale} bpm=${tempo}`
}

export function parseJamHeader(text: string): JamHeader | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const line of lines) {
    const m = line.match(JAM_LINE)
    if (!m) continue
    const rest = m[1] ?? ''
    const kitM = rest.match(/\bkit=(\S+)/)
    const nameM = rest.match(/\bname="((?:\\.|[^"\\])*)"/)
    const rootM = rest.match(/\broot=(\S+)/)
    const scaleM = rest.match(/\bscale=(\S+)/)
    const bpmM = rest.match(/\bbpm=(\S+)/)
    const out: JamHeader = {}
    if (kitM?.[1] && kitM[1] !== 'none') out.kitId = kitM[1]
    if (nameM) out.kitName = unescapeJamName(nameM[1]!)
    if (rootM?.[1]) out.root = rootM[1]
    if (scaleM?.[1]) out.scale = scaleM[1]
    if (bpmM?.[1]) {
      const n = Number(bpmM[1])
      if (Number.isFinite(n)) out.bpm = n
    }
    return out
  }
  return null
}

function isScaleKind(s: string): s is ScaleKind {
  return (SONG_SCALES as string[]).includes(s)
}

/**
 * Restore Jam chrome from `// @jam` — kit/root/scale/bpm only.
 * Does not remap notes or call applyKit.
 * @returns true if any chrome field was applied
 */
export function applyJamHeader(text: string): boolean {
  const h = parseJamHeader(text)
  if (!h) return false
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  let changed = false

  let kit = h.kitId ? getKit(h.kitId) : undefined
  if (!kit && h.kitName) {
    const want = h.kitName.toLowerCase()
    kit = KITS.find((k) => k.name.toLowerCase() === want)
  }
  if (kit) {
    if (jam.kitId !== kit.id) {
      jam.setKitId(kit.id)
      changed = true
    }
    if (jam.vibe !== kit.vibe) {
      jam.setVibe(kit.vibe)
      changed = true
    }
  }
  if (h.root && jam.songRoot !== h.root) {
    jam.setSongRoot(h.root)
    changed = true
  }
  if (h.scale && isScaleKind(h.scale) && jam.songScale !== h.scale) {
    jam.setSongScale(h.scale)
    changed = true
  }
  if (h.bpm != null && Number.isFinite(h.bpm) && h.bpm > 0) {
    const bpm = Math.round(h.bpm)
    if (session.bpm !== bpm) {
      session.setBpm(bpm)
      changed = true
    }
  }
  return changed
}

export function isCodeAllOpen(codeTrackId: string | null | undefined): boolean {
  return codeTrackId === CODE_ALL
}

/** Serialize session tracks into one editable buffer. Optional meta prepends `// @jam`. */
export function tracksToAllCode(tracks: Track[], meta?: AllCodeMeta): string {
  const body =
    tracks.length === 0
      ? '// no tracks'
      : tracks.map((t) => `// @track ${t.id}  ${t.name}\n${t.code.trim()}`).join('\n\n')
  if (!meta) return body
  return `${formatJamHeader(meta)}\n${body}`
}

/**
 * Split the all-tracks buffer back onto known ids.
 * Unknown headers are ignored. Tracks missing a section stay unchanged.
 * `// @jam` lines are never treated as tracks.
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
    if (JAM_LINE.test(line)) continue
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

export type AllTrackSection = { id: string; name: string; code: string }

/**
 * Parse every `// @track <id> [Name]` section — does not filter by known session ids.
 * `// @jam` lines are skipped.
 */
export function parseAllTrackSections(text: string): AllTrackSection[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: AllTrackSection[] = []
  let curId: string | null = null
  let curName = ''
  let buf: string[] = []

  const flush = () => {
    if (curId) {
      out.push({
        id: curId,
        name: (curName.trim() || curId),
        code: buf.join('\n').trim(),
      })
    }
    curId = null
    curName = ''
    buf = []
  }

  for (const line of lines) {
    if (JAM_LINE.test(line)) continue
    const m = line.match(HEAD)
    if (m) {
      flush()
      curId = m[1]!
      curName = (m[2] ?? '').trim()
      buf = []
      continue
    }
    if (curId) buf.push(line)
  }
  flush()
  return out
}

/** Infer TrackRole from a track display name (case-insensitive). */
export function inferRoleFromTrackName(name: string): TrackRole {
  const n = name.toLowerCase()
  if (/\bhat|\bhihat|\bhh\b/.test(n) || n.includes('hat')) return 'hihats'
  if (/\bbass\b/.test(n) || n.includes('bass')) return 'bass'
  if (/\bpad\b/.test(n) || n.includes('pad')) return 'pad'
  if (/\barp\b/.test(n) || n.includes('arp')) return 'arp'
  if (/\blead\b|\bmotif\b|\bstab\b/.test(n) || /lead|motif|stab/.test(n)) return 'lead'
  if (/\bvox\b|\bvocal\b/.test(n)) return 'vox'
  if (/\bfx\b|\bperc\b|\brim\b/.test(n) || /perc|rim/.test(n)) return 'fx'
  if (/\bsnare\b|\bclap\b/.test(n) || /snare|clap/.test(n)) return 'drums'
  if (/\bkick\b|\bdrum\b/.test(n) || /kick|drum/.test(n)) return 'drums'
  return 'drums'
}

/**
 * Full-jam replace from a foreign (or any) `@track` buffer.
 * Keeps imported ids for Export round-trip. Applies `// @jam` chrome, resets intensity.
 */
export function importJamBuffer(text: string): { trackCount: number } {
  const sections = parseAllTrackSections(text)
  const tracks: Track[] = sections.map((s) => {
    const name = s.name.trim() || s.id
    const role = inferRoleFromTrackName(name)
    return {
      id: s.id,
      name,
      role,
      code: s.code,
      color: ROLE_COLORS[role],
      muted: false,
      soloed: false,
      locked: false,
      volume: defaultTrackVolume(role),
      octave: 0,
      error: null,
    }
  })
  useSessionStore.setState({
    tracks,
    activeTrackId: tracks[0]?.id ?? null,
  })
  applyJamHeader(text)
  const jam = useJamStore.getState()
  jam.resetIntensitySession()
  if (tracks[0]) jam.touchTrack(tracks[0].id)
  jam.setLastPeek(`Import · ${tracks.length} tracks`)
  return { trackCount: tracks.length }
}

export function hasUnbalancedSyntax(text: string): boolean {
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

/** Paste / file import: syntax + // @track shape (known or foreign ids). */
export function checkImportCode(text: string, tracks: Track[]): ImportCheck {
  const t = text.trim()
  if (!t) return { ok: false, message: 'Nothing to import' }
  if (hasUnbalancedSyntax(t)) {
    return { ok: false, message: 'Invalid syntax — unmatched brackets or quotes' }
  }
  if (parseAllCode(text, tracks).length > 0) return { ok: true }
  if (parseAllTrackSections(text).length > 0) return { ok: true }
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
