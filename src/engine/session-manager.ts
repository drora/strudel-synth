/**
 * SessionManager — load/save/share/template apply helpers.
 * Pure / localStorage concerns extracted from the fat session store + UI hook.
 * No new Sessions screen — Studio transport still owns the UI chrome.
 */
import type { Track, TrackRole, Template } from './types'
import { ROLE_COLORS } from './types'
import {
  AUTOSAVE_KEY,
  SESSIONS_KEY,
  buildShareUrl,
  shareUrlTooLong,
  snapshotFromStore,
  type SavedSession,
} from './session-codec'

export type IdFactory = () => string

export interface SessionSnapshotInput {
  bpm: number
  tracks: Track[]
  templateId: string | null
  name?: string
}

export interface LoadedSessionState {
  tracks: Track[]
  bpm: number
  activeTrackId: string | null
  templateId: string | null
}

export interface SectionSnap {
  bpm?: number
  tracks: Array<{ id: string; code: string; muted: boolean }>
}

/** Build tracks + bpm from a Template (new ids). */
export function applyTemplate(
  template: Template,
  genId: IdFactory,
): LoadedSessionState {
  const tracks: Track[] = template.tracks.map((t) => ({
    ...t,
    id: genId(),
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    error: null,
  }))
  return {
    tracks,
    bpm: template.bpm,
    activeTrackId: tracks[0]?.id ?? null,
    templateId: template.id,
  }
}

/** Restore a SavedSession (new ids; mute/volume preserved). */
export function applySavedSession(
  session: SavedSession,
  genId: IdFactory,
): LoadedSessionState {
  const tracks: Track[] = session.tracks.map((t) => ({
    id: genId(),
    name: t.name,
    role: t.role,
    code: t.code,
    color: t.color || ROLE_COLORS[t.role],
    muted: !!t.muted,
    soloed: !!t.soloed,
    locked: false,
    volume: typeof t.volume === 'number' ? t.volume : 1,
    error: null,
  }))
  return {
    tracks,
    bpm: session.bpm,
    activeTrackId: tracks[0]?.id ?? null,
    templateId: session.templateId,
  }
}

/** A/B arrangement — apply codes+mute (match by id, else index). */
export function applySectionToTracks(
  current: Track[],
  section: SectionSnap,
): { tracks: Track[]; bpm?: number } {
  const byId = new Map(section.tracks.map((t) => [t.id, t]))
  return {
    bpm: typeof section.bpm === 'number' ? section.bpm : undefined,
    tracks: current.map((t, i) => {
      const snap = byId.get(t.id) ?? section.tracks[i]
      if (!snap) return t
      return { ...t, code: snap.code, muted: snap.muted, error: null }
    }),
  }
}

export function buildLearnTrack(opts: {
  code: string
  name?: string
  role?: TrackRole
  genId: IdFactory
}): Track {
  const resolvedRole: TrackRole = opts.role ?? 'custom'
  return {
    id: opts.genId(),
    name: opts.name?.trim() || 'From Learn',
    role: resolvedRole,
    code: opts.code,
    color: ROLE_COLORS[resolvedRole],
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    error: null,
  }
}

export function saveAutosave(input: SessionSnapshotInput): SavedSession {
  const session = snapshotFromStore(input)
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session))
  } catch (err) {
    console.warn('[SessionManager] autosave failed:', err)
  }
  return session
}

export function readAutosave(): SavedSession | null {
  try {
    const data = localStorage.getItem(AUTOSAVE_KEY)
    if (!data) return null
    const parsed = JSON.parse(data) as SavedSession
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tracks)) return null
    return parsed
  } catch {
    return null
  }
}

export function listSavedSessions(): SavedSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') as SavedSession[]
  } catch {
    return []
  }
}

/** Persist named session to the rolling list (max 20) + autosave slot. */
export function saveNamedSession(input: SessionSnapshotInput): SavedSession {
  const session = snapshotFromStore(input)
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session))
    let sessions = listSavedSessions()
    sessions.unshift(session)
    if (sessions.length > 20) sessions = sessions.slice(0, 20)
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } catch (err) {
    console.warn('[SessionManager] save failed:', err)
  }
  return session
}

export function shareSession(
  input: SessionSnapshotInput,
  opts?: { updateHash?: boolean },
): { url: string; tooLong: boolean } {
  const session = snapshotFromStore({ ...input, name: input.name || 'Shared' })
  const url = buildShareUrl(session)
  if (opts?.updateHash !== false && typeof history !== 'undefined' && typeof location !== 'undefined') {
    const hashIdx = url.indexOf('#')
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : ''
    if (hash) {
      try {
        history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
      } catch { /* ignore */ }
    }
  }
  return { url, tooLong: shareUrlTooLong(url) }
}

export type { SavedSession }
