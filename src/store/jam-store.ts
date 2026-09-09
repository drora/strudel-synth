import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VibeId } from '../engine/kits'
import type { MutationCard } from '../engine/mutators'

export interface JamUndoEntry {
  trackId: string
  code: string
  label: string
}

interface JamState {
  vibe: VibeId
  kitId: string | null
  lockKit: boolean
  showKitPicker: boolean
  hasPickedKit: boolean
  mutationDeal: MutationCard[]
  undoStack: JamUndoEntry[]
  lastPeek: string | null
  soundTrackId: string | null

  setVibe: (vibe: VibeId) => void
  setKitId: (kitId: string | null) => void
  setLockKit: (lock: boolean) => void
  setShowKitPicker: (show: boolean) => void
  setHasPickedKit: (v: boolean) => void
  setMutationDeal: (cards: MutationCard[]) => void
  pushUndo: (entry: JamUndoEntry) => void
  popUndo: () => JamUndoEntry | null
  setLastPeek: (peek: string | null) => void
  setSoundTrackId: (id: string | null) => void
}

export const useJamStore = create<JamState>()(
  persist(
    (set, get) => ({
      vibe: 'techno',
      kitId: null,
      lockKit: true,
      showKitPicker: true,
      hasPickedKit: false,
      mutationDeal: [],
      undoStack: [],
      lastPeek: null,
      soundTrackId: null,

      setVibe: (vibe) => set({ vibe }),
      setKitId: (kitId) => set({ kitId }),
      setLockKit: (lockKit) => set({ lockKit }),
      setShowKitPicker: (showKitPicker) => set({ showKitPicker }),
      setHasPickedKit: (hasPickedKit) => set({ hasPickedKit }),
      setMutationDeal: (mutationDeal) => set({ mutationDeal }),
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
