/**
 * Compact session encode/decode for share URLs + autosave helpers.
 * AGPL-3.0-or-later — client-side only.
 */

import type { Track, TrackRole, Template } from './types'
import { ROLE_COLORS } from './types'

/** Full session shape used by SessionManager localStorage (v1). */
export interface SavedSession {
  version: 1
  timestamp: number
  name: string
  bpm: number
  tracks: Omit<Track, 'error'>[]
  templateId: string | null
}

/** Wire-compact form for location.hash (shorter keys). */
export interface CompactSession {
  v: 1
  b: number
  n?: string
  tid?: string | null
  t: Array<{
    n: string
    r: TrackRole
    c: string
    m?: 0 | 1
    s?: 0 | 1
    v?: number
    o?: number
    col?: string
    id?: string
  }>
}

export const AUTOSAVE_KEY = 'strudel-studio-session'
export const SESSIONS_KEY = 'strudel-studio-sessions'
export const SHARE_HASH_PREFIX = '#s='

const TRACK_ROLES: TrackRole[] = [
  'drums', 'hihats', 'bass', 'lead', 'pad', 'arp', 'fx', 'vox', 'custom',
]

function isTrackRole(v: unknown): v is TrackRole {
  return typeof v === 'string' && (TRACK_ROLES as string[]).includes(v)
}

/** UTF-8 → base64url (no padding). */
export function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  const b64 = btoa(bin)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function sessionToCompact(session: SavedSession): CompactSession {
  return {
    v: 1,
    b: session.bpm,
    n: session.name,
    tid: session.templateId,
    t: session.tracks.map((tr) => ({
      id: tr.id,
      n: tr.name,
      r: tr.role,
      c: tr.code,
      m: tr.muted ? 1 : 0,
      s: tr.soloed ? 1 : 0,
      v: tr.volume === 1 ? undefined : tr.volume,
      o: (tr.octave ?? 0) === 0 ? undefined : tr.octave,
      col: tr.color,
    })),
  }
}

export function compactToSession(c: CompactSession): SavedSession {
  return {
    version: 1,
    timestamp: Date.now(),
    name: c.n || 'Shared Session',
    bpm: typeof c.b === 'number' ? c.b : 120,
    templateId: c.tid ?? null,
    tracks: (c.t || []).map((tr, i) => {
      const role: TrackRole = isTrackRole(tr.r) ? tr.r : 'custom'
      return {
        id: tr.id || `shared-${i}`,
        name: tr.n || `Track ${i + 1}`,
        role,
        code: typeof tr.c === 'string' ? tr.c : 'silence',
        color: tr.col || ROLE_COLORS[role],
        muted: tr.m === 1,
        soloed: tr.s === 1,
        locked: false,
        volume: typeof tr.v === 'number' ? tr.v : 1,
        octave: typeof tr.o === 'number' ? tr.o : 0,
      }
    }),
  }
}

export function encodeSharePayload(session: SavedSession): string {
  const json = JSON.stringify(sessionToCompact(session))
  const bytes = new TextEncoder().encode(json)
  return toBase64Url(bytes)
}

export function decodeSharePayload(payload: string): SavedSession | null {
  try {
    const bytes = fromBase64Url(payload)
    const json = new TextDecoder().decode(bytes)
    const raw = JSON.parse(json) as CompactSession
    if (!raw || raw.v !== 1 || !Array.isArray(raw.t)) return null
    return compactToSession(raw)
  } catch {
    return null
  }
}

/** Parse `#s=…` (or bare payload) from location.hash. */
export function decodeShareHash(hash: string): SavedSession | null {
  if (!hash) return null
  let payload = hash
  if (payload.startsWith('#')) payload = payload.slice(1)
  if (payload.startsWith('s=')) payload = payload.slice(2)
  if (!payload) return null
  return decodeSharePayload(payload)
}

export function buildShareUrl(session: SavedSession, base?: string): string {
  const origin =
    base ??
    (typeof location !== 'undefined'
      ? `${location.origin}${location.pathname}${location.search}`
      : '')
  return `${origin}${SHARE_HASH_PREFIX}${encodeSharePayload(session)}`
}

export function snapshotFromStore(state: {
  bpm: number
  tracks: Track[]
  templateId: string | null
  name?: string
}): SavedSession {
  return {
    version: 1,
    timestamp: Date.now(),
    name: state.name || `Session ${new Date().toLocaleString()}`,
    bpm: state.bpm,
    tracks: state.tracks.map(({ error: _e, ...t }) => t),
    templateId: state.templateId,
  }
}

export function sessionToTemplate(session: SavedSession): Template {
  return {
    id: session.templateId || 'loaded',
    name: session.name,
    description: '',
    bpm: session.bpm,
    tracks: session.tracks.map((t) => ({
      name: t.name,
      role: t.role,
      code: t.code,
      color: t.color,
    })),
  }
}

/** Soft URL length guard — browsers vary; warn above ~6k chars. */
export function shareUrlTooLong(url: string, limit = 6000): boolean {
  return url.length > limit
}
