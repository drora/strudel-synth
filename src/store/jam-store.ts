import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VibeId } from '../engine/kits'
import type { SectionSnap } from '../engine/session-manager'
import { useSessionStore } from './session-store'
import { liveUpdateEngine } from '../engine/live-update'
import { useUIStore } from './ui-store'
import {
  keepOrFallbackLastTouched,
  afterTrackRemoved,
} from '../engine/last-touched'

export interface JamUndoEntry {
  trackId: string
  code: string
  label: string
}

export type AbSlot = 'a' | 'b'

interface JamState {
  vibe: VibeId
  kitId: string | null
  lockKit: boolean
  showKitPicker: boolean
  hasPickedKit: boolean
  undoStack: JamUndoEntry[]
  lastPeek: string | null
  soundTrackId: string | null
  /** Track id for the Jam Code sheet overlay (null = closed). */
  codeTrackId: string | null
  /**
   * Last *content-modified* track (Sound/FX/gain, Code edits, Shuffle this, Spice).
   * Separate from codeTrackId / activeTrackId so header Code ignores mere peek/open.
   */
  lastTouchedTrackId: string | null
  /** Simple A/B arrangement slots (session-local, not persisted). */
  variantA: SectionSnap | null
  variantB: SectionSnap | null
  activeVariant: AbSlot | null

  setVibe: (vibe: VibeId) => void
  setKitId: (kitId: string | null) => void
  setLockKit: (lock: boolean) => void
  setShowKitPicker: (show: boolean) => void
  setHasPickedKit: (v: boolean) => void
  pushUndo: (entry: JamUndoEntry) => void
  popUndo: () => JamUndoEntry | null
  setLastPeek: (peek: string | null) => void
  setSoundTrackId: (id: string | null) => void
  setCodeTrackId: (id: string | null) => void
  setLastTouchedTrackId: (id: string | null) => void
  /** Mark a track as last content-touched (no-op if falsy). */
  touchTrack: (id: string | null | undefined) => void
  /** Song Shuffle / New kit: keep mark if still present, else first unlocked. */
  reconcileLastTouchedAfterSongReshuffle: () => void
  /** Clear mark if it pointed at a removed track. */
  clearLastTouchedIfRemoved: (removedId: string) => void
  /** Capture current track codes+mute (+bpm) into A or B. */
  stashVariant: (slot: AbSlot) => void
  /** Apply A or B (no-op if empty). */
  punchVariant: (slot: AbSlot) => void
  /** Punch the other slot, or stash+activate if empty. */
  toggleAb: () => void
}

function snapshotSection(): SectionSnap {
  const s = useSessionStore.getState()
  return {
    bpm: s.bpm,
    tracks: s.tracks.map((t) => ({ id: t.id, code: t.code, muted: t.muted })),
  }
}

function queueSectionUpdate() {
  if (!useSessionStore.getState().isPlaying) return
  const q = useUIStore.getState().getEffectiveQuantization(
    useSessionStore.getState().activeTrackId,
  )
  liveUpdateEngine.queueUpdate(q, 'section')
}

export const useJamStore = create<JamState>()(
  persist(
    (set, get) => ({
      vibe: 'techno',
      kitId: null,
      lockKit: true,
      showKitPicker: true,
      hasPickedKit: false,
      undoStack: [],
      lastPeek: null,
      soundTrackId: null,
      codeTrackId: null,
      lastTouchedTrackId: null,
      variantA: null,
      variantB: null,
      activeVariant: null,

      setVibe: (vibe) => set({ vibe }),
      setKitId: (kitId) => set({ kitId }),
      setLockKit: (lockKit) => set({ lockKit }),
      setShowKitPicker: (showKitPicker) => set({ showKitPicker }),
      setHasPickedKit: (hasPickedKit) => set({ hasPickedKit }),
      pushUndo: (entry) =>
        set((s) => ({ undoStack: [...s.undoStack.slice(-19), entry] })),
      popUndo: () => {
        const stack = get().undoStack
        if (stack.length === 0) return null
        const entry = stack[stack.length - 1]!
        set({ undoStack: stack.slice(0, -1) })
        return entry
      },
      setLastPeek: (lastPeek) => set({ lastPeek }),
      setSoundTrackId: (soundTrackId) => set({ soundTrackId }),
      setCodeTrackId: (codeTrackId) => set({ codeTrackId }),
      setLastTouchedTrackId: (lastTouchedTrackId) => set({ lastTouchedTrackId }),
      touchTrack: (id) => {
        if (!id) return
        set({ lastTouchedTrackId: id })
      },
      reconcileLastTouchedAfterSongReshuffle: () => {
        const tracks = useSessionStore.getState().tracks
        const trackIds = tracks.map((t) => t.id)
        const unlockedIds = tracks.filter((t) => !t.locked).map((t) => t.id)
        set({
          lastTouchedTrackId: keepOrFallbackLastTouched(
            get().lastTouchedTrackId,
            trackIds,
            unlockedIds,
          ),
        })
      },
      clearLastTouchedIfRemoved: (removedId) => {
        set({
          lastTouchedTrackId: afterTrackRemoved(get().lastTouchedTrackId, removedId),
        })
      },

      stashVariant: (slot) => {
        const snap = snapshotSection()
        if (slot === 'a') {
          set({ variantA: snap, activeVariant: 'a' })
          get().setLastPeek('A/B · saved A')
        } else {
          set({ variantB: snap, activeVariant: 'b' })
          get().setLastPeek('A/B · saved B')
        }
      },

      punchVariant: (slot) => {
        const snap = slot === 'a' ? get().variantA : get().variantB
        if (!snap) {
          get().stashVariant(slot)
          return
        }
        useSessionStore.getState().applySection(snap)
        set({ activeVariant: slot })
        get().setLastPeek(`A/B · punch ${slot.toUpperCase()}`)
        queueSectionUpdate()
      },

      toggleAb: () => {
        const { variantA, variantB, activeVariant } = get()
        if (!variantA && !variantB) {
          get().stashVariant('a')
          return
        }
        if (variantA && !variantB) {
          get().stashVariant('b')
          return
        }
        if (!variantA && variantB) {
          get().stashVariant('a')
          return
        }
        // Both set — punch the other
        const next: AbSlot = activeVariant === 'a' ? 'b' : 'a'
        get().punchVariant(next)
      },
    }),
    {
      name: 'strudel-studio-jam',
      partialize: (s) => ({
        vibe: s.vibe,
        kitId: s.kitId,
        lockKit: s.lockKit,
        hasPickedKit: s.hasPickedKit,
      }),
    },
  ),
)
