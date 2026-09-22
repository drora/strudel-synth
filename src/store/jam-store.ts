import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VibeId, ScaleKind } from '../engine/kits'
import type { SongSeed } from '../engine/song-seed'
import type { WalkDensity } from '../engine/reshuffle'
import type { SongTimeFeel } from '../engine/mutate'
import type { SectionSnap } from '../engine/session-manager'
import { useSessionStore } from './session-store'
import { liveUpdateEngine } from '../engine/live-update'
import { useUIStore } from './ui-store'
import {
  keepOrFallbackLastTouched,
  afterTrackRemoved,
} from '../engine/last-touched'
import { IMPROV_MIX_DEFAULT, type ImprovPadMix } from '../engine/improv-plate'
import type { IntensityLevel, IntensitySnap } from '../engine/intensity'
import type { Track } from '../engine/types'
import { CODE_ALL } from '../engine/all-code'

export interface JamUndoEntry {
  trackId: string
  code: string
  label: string
  /** Song-global Mutate (half/double-time): restore all codes in one Undo. */
  batch?: { trackId: string; code: string; muted?: boolean; volume?: number }[]
  addedTrackIds?: string[]
  removedTracks?: Track[]
  intensityLevel?: IntensityLevel
  /** Previous song Half/Double-time feel (restore on Undo). */
  songTimeFeel?: SongTimeFeel
  songTimeFeelBase?: { trackId: string; code: string }[] | null
}

export type AbSlot = 'a' | 'b'

interface JamState {
  vibe: VibeId
  kitId: string | null
  /** Song-level melodic root (feeds Shuffle / remap). */
  songRoot: string
  /** Song-level scale kind. */
  songScale: ScaleKind
  /** Shared chord walk for melodic generate / track shuffle. */
  songSeed: SongSeed | null
  /** Chords per drum cycle for melodic walk (1 stretch · 2 densified). */
  walkDensity: WalkDensity
  /** Song Half/Double-time pole (normal | half | double). */
  songTimeFeel: SongTimeFeel
  /** Codes before leaving normal — restore when opposite returns to normal. */
  songTimeFeelBase: { trackId: string; code: string }[] | null
  lockKit: boolean
  showKitPicker: boolean
  hasPickedKit: boolean
  /** Current song Intensity 1–4. Kit select resets to 1 (not persisted). */
  intensityLevel: IntensityLevel
  /** Edits at each intensity for this generate. Cleared on kit select. */
  intensitySnaps: Partial<Record<IntensityLevel, IntensitySnap>>
  /** Pad lane spawned by Intensity 3+ (removed on wind-down). */
  spawnedPadId: string | null
  /** Bass lane spawned by Intensity 4 when kit had none (removed below 4). */
  spawnedBassId: string | null
  undoStack: JamUndoEntry[]
  lastPeek: string | null
  soundTrackId: string | null
  /** Track id for the Jam Code sheet overlay (null = closed). */
  codeTrackId: string | null
  /** File / paste buffer waiting for the all-tracks editor. Not persisted. */
  pendingAllCode: string | null
  /**
   * Last-touched track for header Code + chip mark: chip tap / open Code / content edits.
   * Mute/solo do not update. Separate from activeTrackId.
   */
  lastTouchedTrackId: string | null
  /** Simple A/B arrangement slots (session-local, not persisted). */
  variantA: SectionSnap | null
  variantB: SectionSnap | null
  activeVariant: AbSlot | null
  /** Live improv pad overlay pattern (not persisted). null = silence lane. */
  improvHold: string | null
  /** Last Pads sheet settings — survive close/open (and refresh). */
  improvOctave: number
  improvMix: ImprovPadMix
  improvVoice: string

  setVibe: (vibe: VibeId) => void
  setKitId: (kitId: string | null) => void
  setSongRoot: (root: string) => void
  setSongScale: (scale: ScaleKind) => void
  setSongSeed: (seed: SongSeed | null) => void
  setWalkDensity: (d: WalkDensity) => void
  setSongTimeFeel: (feel: SongTimeFeel) => void
  setSongTimeFeelBase: (base: { trackId: string; code: string }[] | null) => void
  resetSongTimeFeel: () => void
  /** Structure change → back to 1 chord/cycle (align with half/double + intensity). */
  resetWalkDensity: () => void
  setLockKit: (lock: boolean) => void
  setShowKitPicker: (show: boolean) => void
  setHasPickedKit: (v: boolean) => void
  setIntensityLevel: (level: IntensityLevel) => void
  saveIntensitySnap: (level: IntensityLevel, snap: IntensitySnap) => void
  resetIntensitySession: () => void
  setSpawnedPadId: (id: string | null) => void
  setSpawnedBassId: (id: string | null) => void
  pushUndo: (entry: JamUndoEntry) => void
  popUndo: () => JamUndoEntry | null
  setLastPeek: (peek: string | null) => void
  setSoundTrackId: (id: string | null) => void
  setCodeTrackId: (id: string | null) => void
  setPendingAllCode: (text: string | null) => void
  setLastTouchedTrackId: (id: string | null) => void
  /** Mark a track as last-touched (no-op if falsy). Mute must not call this. */
  touchTrack: (id: string | null | undefined) => void
  /** Song Shuffle / New kit: keep mark if still present, else first unlocked. */
  reconcileLastTouchedAfterSongReshuffle: () => void
  /** Clear mark if it pointed at a removed track. */
  clearLastTouchedIfRemoved: (removedId: string) => void
  /** Capture current track codes+mute (+bpm + key) into A or B. */
  stashVariant: (slot: AbSlot) => void
  /** Apply A or B (no-op if empty). */
  punchVariant: (slot: AbSlot) => void
  /** Punch the other slot, or stash+activate if empty. */
  toggleAb: () => void
  setImprovHold: (hold: string | null) => void
  setImprovOctave: (octave: number) => void
  setImprovVoice: (voice: string) => void
  patchImprovMix: (patch: Partial<ImprovPadMix>) => void
}

function cloneSeed(seed: SongSeed | null): SongSeed | null {
  if (!seed) return null
  return {
    ...seed,
    walk: seed.walk.map((c) => ({ ...c })),
    budget: seed.budget ? { ...seed.budget } : seed.budget,
    mix: seed.mix ? { ...seed.mix } : seed.mix,
  }
}

function snapshotSection(): SectionSnap {
  const s = useSessionStore.getState()
  const j = useJamStore.getState()
  return {
    bpm: s.bpm,
    tracks: s.tracks.map((t) => ({ id: t.id, code: t.code, muted: t.muted })),
    songRoot: j.songRoot,
    songScale: j.songScale,
    songSeed: cloneSeed(j.songSeed),
    walkDensity: j.walkDensity,
    songTimeFeel: j.songTimeFeel,
    songTimeFeelBase: j.songTimeFeelBase
      ? j.songTimeFeelBase.map((c) => ({ ...c }))
      : null,
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
      songRoot: 'c',
      songScale: 'minor',
      songSeed: null,
      walkDensity: 1,
      songTimeFeel: 'normal',
      songTimeFeelBase: null,
      lockKit: true,
      showKitPicker: true,
      hasPickedKit: false,
      intensityLevel: 1,
      intensitySnaps: {},
      spawnedPadId: null,
      spawnedBassId: null,
      undoStack: [],
      lastPeek: null,
      soundTrackId: null,
      codeTrackId: null,
      pendingAllCode: null,
      lastTouchedTrackId: null,
      variantA: null,
      variantB: null,
      activeVariant: null,
      improvHold: null,
      improvOctave: 4,
      improvMix: IMPROV_MIX_DEFAULT,
      improvVoice: 'sawtooth',

      setVibe: (vibe) => set({ vibe }),
      setKitId: (kitId) => set({ kitId }),
      setSongRoot: (songRoot) => set({ songRoot }),
      setSongScale: (songScale) => set({ songScale }),
      setSongSeed: (songSeed) => set({ songSeed }),
      setWalkDensity: (walkDensity) => set({ walkDensity }),
      setSongTimeFeel: (songTimeFeel) => set({ songTimeFeel }),
      setSongTimeFeelBase: (songTimeFeelBase) => set({ songTimeFeelBase }),
      resetSongTimeFeel: () => set({ songTimeFeel: 'normal', songTimeFeelBase: null }),
      resetWalkDensity: () => set({ walkDensity: 1 }),
      setLockKit: (lockKit) => set({ lockKit }),
      setShowKitPicker: (showKitPicker) => set({ showKitPicker }),
      setHasPickedKit: (hasPickedKit) => set({ hasPickedKit }),
      setIntensityLevel: (intensityLevel) => set({ intensityLevel }),
      saveIntensitySnap: (level, snap) =>
        set((s) => ({ intensitySnaps: { ...s.intensitySnaps, [level]: snap } })),
      resetIntensitySession: () =>
        set({ intensityLevel: 1, intensitySnaps: {}, spawnedPadId: null, spawnedBassId: null }),
      setSpawnedPadId: (spawnedPadId) => set({ spawnedPadId }),
      setSpawnedBassId: (spawnedBassId) => set({ spawnedBassId }),
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
      setSoundTrackId: (soundTrackId) =>
        set(
          soundTrackId
            ? { soundTrackId, lastTouchedTrackId: soundTrackId }
            : { soundTrackId },
        ),
      setCodeTrackId: (codeTrackId) =>
        set(
          codeTrackId && codeTrackId !== CODE_ALL
            ? { codeTrackId, lastTouchedTrackId: codeTrackId }
            : { codeTrackId },
        ),
      setPendingAllCode: (pendingAllCode) => set({ pendingAllCode }),
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
        if (snap.songRoot) set({ songRoot: snap.songRoot })
        if (snap.songScale) set({ songScale: snap.songScale })
        if ('songSeed' in snap) set({ songSeed: cloneSeed(snap.songSeed ?? null) })
        if ('walkDensity' in snap && snap.walkDensity) set({ walkDensity: snap.walkDensity })
        if ('songTimeFeel' in snap && snap.songTimeFeel) set({ songTimeFeel: snap.songTimeFeel })
        if ('songTimeFeelBase' in snap) {
          set({
            songTimeFeelBase: snap.songTimeFeelBase
              ? snap.songTimeFeelBase.map((c) => ({ ...c }))
              : null,
          })
        }
        set({ activeVariant: slot })
        get().setLastPeek(`A/B · punch ${slot.toUpperCase()}`)
        queueSectionUpdate()
      },


      setImprovHold: (improvHold) => set({ improvHold }),
      setImprovOctave: (improvOctave) => set({ improvOctave }),
      setImprovVoice: (improvVoice) => set({ improvVoice }),
      patchImprovMix: (patch) =>
        set((s) => ({ improvMix: { ...s.improvMix, ...patch } })),

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
        const next: AbSlot = activeVariant === 'a' ? 'b' : 'a'
        get().punchVariant(next)
      },
    }),
    {
      name: 'strudel-studio-jam',
      partialize: (s) => ({
        vibe: s.vibe,
        kitId: s.kitId,
        songRoot: s.songRoot,
        songScale: s.songScale,
        songSeed: s.songSeed,
        walkDensity: s.walkDensity,
        songTimeFeel: s.songTimeFeel,
        songTimeFeelBase: s.songTimeFeelBase,
        lockKit: s.lockKit,
        hasPickedKit: s.hasPickedKit,
        improvOctave: s.improvOctave,
        improvMix: s.improvMix,
        improvVoice: s.improvVoice,
      }),
    },
  ),
)
