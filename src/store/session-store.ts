import { create } from 'zustand'
import type { Track, Template } from '../engine/types'

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
  setTrackName: (trackId: string, name: string) => void
  loadTemplate: (template: Template) => void
  addTrack: (track: Omit<Track, 'id'>) => void
  removeTrack: (trackId: string) => void
  toggleMute: (trackId: string) => void
  toggleSolo: (trackId: string) => void
  toggleLock: (trackId: string) => void
  lockAll: () => void
  reorderTracks: (fromIndex: number, toIndex: number) => void
}

let nextId = 1
function genId(): string {
  return `track-${nextId++}`
}

export const useSessionStore = create<SessionState>((set) => ({
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

  loadTemplate: (template) => {
    const tracks: Track[] = template.tracks.map((t) => ({
      ...t,
      id: genId(),
      muted: false,
      soloed: false,
      locked: false,
      volume: 1,
      error: null,
    }))
    set({
      tracks,
      bpm: template.bpm,
      activeTrackId: tracks[0]?.id ?? null,
      templateId: template.id,
      isPlaying: false,
    })
  },

  addTrack: (track) => {
    const id = genId()
    set((state) => ({
      tracks: [...state.tracks, { ...track, id }],
      activeTrackId: id,
    }))
  },

  removeTrack: (trackId) =>
    set((state) => {
      const tracks = state.tracks.filter((t) => t.id !== trackId)
      return {
        tracks,
        activeTrackId:
          state.activeTrackId === trackId
            ? tracks[0]?.id ?? null
            : state.activeTrackId,
      }
    }),

  toggleMute: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    })),

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
}))
