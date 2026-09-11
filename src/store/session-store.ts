import { create } from 'zustand'
import type { Track, TrackRole, Template } from '../engine/types'
import type { SavedSession } from '../engine/session-codec'
import {
  applyTemplate,
  applySavedSession,
  applySectionToTracks,
  buildLearnTrack,
} from '../engine/session-manager'
import { useJamStore } from './jam-store'

interface SessionState {
  tracks: Track[]
  bpm: number
  isPlaying: boolean
  activeTrackId: string | null
  templateId: string | null

  setCode: (trackId: string, code: string) => void
  setBpm: (bpm: number) => void
  setPlaying: (playing: boolean) => void
  setActiveTrack: (trackId: string) => void
  setError: (trackId: string, error: string | null) => void
  setVolume: (trackId: string, volume: number) => void
  setOctave: (trackId: string, octave: number) => void
  setTrackName: (trackId: string, name: string) => void
  loadTemplate: (template: Template, opts?: { preserveBpm?: boolean }) => void
  addTrack: (track: Omit<Track, 'id'>) => string
  removeTrack: (trackId: string) => void
  toggleMute: (trackId: string) => void
  toggleSolo: (trackId: string) => void
  toggleLock: (trackId: string) => void
  lockAll: () => void
  reorderTracks: (fromIndex: number, toIndex: number) => void
  /**
   * Promote Learn challenge code into a Jam session track.
   * Always adds a new track (never clobbers existing work).
   * Returns the new track id.
   */
  applyLearnCode: (opts: {
    code: string
    name?: string
    role?: TrackRole
  }) => string
  /** Phase 5: restore a SavedSession including mute/volume (new ids). */
  loadSavedSession: (session: SavedSession) => void
  /** Phase 5: A/B arrangement — apply codes+mute (match by id, else index). */
  applySection: (section: {
    bpm?: number
    tracks: Array<{ id: string; code: string; muted: boolean }>
  }) => void
  setMuted: (trackId: string, muted: boolean) => void
}

let nextId = 1
function genId(): string {
  return `track-${nextId++}`
}

export const useSessionStore = create<SessionState>((set, get) => ({
  tracks: [],
  bpm: 128,
  isPlaying: false,
  activeTrackId: null,
  templateId: null,

  setCode: (trackId, code) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, code, error: null } : t
      ),
    })),

  setBpm: (bpm) => set({ bpm: Math.max(40, Math.min(300, bpm)) }),

  setPlaying: (isPlaying) => set({ isPlaying }),

  setActiveTrack: (activeTrackId) => set({ activeTrackId }),

  setError: (trackId, error) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, error } : t
      ),
    })),

  loadTemplate: (template, opts) => {
    const next = applyTemplate(template, genId)
    if (opts?.preserveBpm) {
      next.bpm = get().bpm
    }
    set(next)
  },

  addTrack: (track) => {
    const id = genId()
    set((state) => ({
      tracks: [
        ...state.tracks,
        { ...track, id, octave: track.octave ?? 0 },
      ],
      activeTrackId: id,
    }))
    return id
  },

  applyLearnCode: ({ code, name, role }) => {
    const track = buildLearnTrack({ code, name, role, genId })
    set((state) => ({
      tracks: [...state.tracks, track],
      activeTrackId: track.id,
    }))
    return track.id
  },

  removeTrack: (trackId) => {
    set((state) => {
      // Soft floor: always keep ≥1 track
      if (state.tracks.length <= 1) return state
      if (!state.tracks.some((t) => t.id === trackId)) return state
      const tracks = state.tracks.filter((t) => t.id !== trackId)
      return {
        tracks,
        activeTrackId:
          state.activeTrackId === trackId
            ? tracks[0]?.id ?? null
            : state.activeTrackId,
      }
    })
    // Always drop jam overlay ids pointing at a missing track (removed or already stale).
    if (!get().tracks.some((t) => t.id === trackId)) {
      const jam = useJamStore.getState()
      if (jam.soundTrackId === trackId) jam.setSoundTrackId(null)
      if (jam.codeTrackId === trackId) jam.setCodeTrackId(null)
    }
  },

  toggleMute: (trackId) => {
    // Sanity: never mute a non-existent id (no-op; avoids fighting UI after delete).
    if (!get().tracks.some((t) => t.id === trackId)) return
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    }))
  },

  toggleSolo: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, soloed: !t.soloed } : t
      ),
    })),

  toggleLock: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      ),
    })),

  lockAll: () =>
    set((state) => {
      const anyLocked = state.tracks.some((t) => t.locked)
      return {
        tracks: state.tracks.map((t) => ({ ...t, locked: !anyLocked })),
      }
    }),

  setVolume: (trackId, volume) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1.5, volume)) } : t
      ),
    })),

  setOctave: (trackId, octave) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, octave: Math.max(-3, Math.min(3, Math.trunc(octave))) }
          : t
      ),
    })),

  setTrackName: (trackId, name) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, name } : t
      ),
    })),

  reorderTracks: (fromIndex, toIndex) =>
    set((state) => {
      const tracks = [...state.tracks]
      const [moved] = tracks.splice(fromIndex, 1)
      tracks.splice(toIndex, 0, moved)
      return { tracks }
    }),

  loadSavedSession: (session) => {
    set(applySavedSession(session, genId))
  },

  applySection: (section) =>
    set((state) => {
      const merged = applySectionToTracks(state.tracks, section)
      return {
        bpm: merged.bpm ?? state.bpm,
        tracks: merged.tracks,
      }
    }),

  setMuted: (trackId, muted) => {
    if (!get().tracks.some((t) => t.id === trackId)) return
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, muted } : t
      ),
    }))
  },
}))
