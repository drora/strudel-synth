import { useEffect, useCallback, useMemo, useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { useJamStore } from '../../store/jam-store'
import {
  KITS,
  getKit,
} from '../../engine/kits'
import { filterKits, pickRandomKit } from '../../engine/kit-browser'
import { suggestMutations, applyMutationToTracks, type MutationCard } from '../../engine/mutators'
import { suggestMissions, applyMissionToTracks, type MissionCard } from '../../engine/missions'
import { liveUpdateEngine } from '../../engine/live-update'
import {
  applyKit as applyKitAction,
  freshStartJam,
  reshuffleUnlocked,
} from '../../engine/jam-actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useVisualViewportHeight } from '../../hooks/useVisualViewport'
import {
  PREBAKE_MIN_VISIBLE_MS,
  queueJam,
  useMinVisible,
} from './jam-shell-utils'

export function useJamShell() {
  const isMobile = useIsMobile()
  const vvHeight = useVisualViewportHeight()
  const tracks = useSessionStore((s) => s.tracks)
  const bpm = useSessionStore((s) => s.bpm)
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const sampleLoading = useUIStore((s) => s.sampleLoading)
  const kitSamplesLoading = sampleLoading.phase === 'prebake' && !sampleLoading.done
  const showKitLoadingBanner = useMinVisible(kitSamplesLoading, PREBAKE_MIN_VISIBLE_MS)

  const vibe = useJamStore((s) => s.vibe)
  const kitId = useJamStore((s) => s.kitId)
  const lockKit = useJamStore((s) => s.lockKit)
  const showKitPicker = useJamStore((s) => s.showKitPicker)
  const mutationDeal = useJamStore((s) => s.mutationDeal)
  const missionDeal = useJamStore((s) => s.missionDeal)
  const lastPeek = useJamStore((s) => s.lastPeek)
  const soundTrackId = useJamStore((s) => s.soundTrackId)
  const undoLen = useJamStore((s) => s.undoStack.length)

  /** Soft-tag / search filters for kit browser (+ New Kit). */
  const [kitFilterSearch, setKitFilterSearch] = useState('')
  // Soft tags start empty (kit-first). Persisted `vibe` still updates on applyKit.
  const [kitFilterTags, setKitFilterTags] = useState<string[]>([])

  const kits = KITS
  const filteredKits = useMemo(
    () => filterKits(kits, { search: kitFilterSearch, tags: kitFilterTags }),
    [kits, kitFilterSearch, kitFilterTags],
  )
  const activeKit = kitId ? getKit(kitId) : undefined
  const soundTrack = tracks.find((t) => t.id === soundTrackId)

  const redeal = useCallback(() => {
    const stateTracks = useSessionStore.getState().tracks
    const jam = useJamStore.getState()
    jam.setMutationDeal(suggestMutations(stateTracks, 3))
    jam.setMissionDeal(suggestMissions(stateTracks, 2))
  }, [])

  const applyKit = useCallback((id: string, fromPicker = false) => {
    // Picker / New Kit: leave recipe as-is (no auto-reshuffle).
    applyKitAction(id, { fromPicker })
  }, [])

  // Once per page load (module guard inside freshStartJam) — random kit when empty + reshuffle.
  useEffect(() => {
    freshStartJam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMutation = (card: MutationCard) => {
    const state = useSessionStore.getState()
    const result = applyMutationToTracks(state.tracks, card)
    if (!result) {
      redeal()
      return
    }
    const prev = state.tracks.find((t) => t.id === result.trackId)
    if (prev) {
      useJamStore.getState().pushUndo({
        trackId: prev.id,
        code: prev.code,
        label: card.label,
      })
    }
    state.setCode(result.trackId, result.code)
    useJamStore.getState().setLastPeek(`${card.label}`)
    liveUpdateEngine.markDirty()
    queueJam('jam')
    redeal()
  }

  const onMission = (mission: MissionCard) => {
    const state = useSessionStore.getState()
    const result = applyMissionToTracks(state.tracks, mission)
    if (!result) {
      useJamStore.getState().setLastPeek(`Mission · ${mission.label} (already there)`)
      useJamStore.getState().setMissionDeal(suggestMissions(state.tracks, 2))
      return
    }
    const prev = state.tracks.find((t) => t.id === result.trackId)
    if (prev) {
      useJamStore.getState().pushUndo({
        trackId: prev.id,
        code: prev.code,
        label: `Mission · ${mission.label}`,
      })
    }
    state.setCode(result.trackId, result.code)
    useJamStore.getState().setLastPeek(`Mission · ${mission.label}`)
    liveUpdateEngine.markDirty()
    queueJam('jam')
    useJamStore.getState().setMissionDeal(suggestMissions(useSessionStore.getState().tracks, 2))
    useJamStore.getState().setMutationDeal(suggestMutations(useSessionStore.getState().tracks, 3))
  }

  const onUndo = () => {
    const entry = useJamStore.getState().popUndo()
    if (!entry) return
    useSessionStore.getState().setCode(entry.trackId, entry.code)
    useJamStore.getState().setLastPeek(`Undo · ${entry.label}`)
    queueJam('jam')
  }

  const onShuffle = () => {
    reshuffleUnlocked()
  }

  const onNewKit = () => {
    // Prefer filtered list; fall back to all kits when filter is empty / no matches.
    const pool = filteredKits.length > 0 ? filteredKits : kits
    const pick = pickRandomKit(pool, kitId)
    if (pick) applyKit(pick.id)
  }

  const onSpice = () => {
    const cards = suggestMutations(tracks, 1).filter((c) => c.kind === 'timbre')
    const card = cards[0] ?? suggestMutations(tracks, 1)[0]
    if (card) onMutation(card)
  }

  const shellStyle = isMobile
    ? { height: vvHeight > 0 ? vvHeight : undefined, minHeight: 0 }
    : undefined

  return {
    isMobile,
    tracks,
    bpm,
    isPlaying,
    sampleLoading,
    showKitLoadingBanner,
    vibe,
    kitId,
    lockKit,
    showKitPicker,
    mutationDeal,
    missionDeal,
    lastPeek,
    undoLen,
    kits,
    filteredKits,
    kitFilterSearch,
    setKitFilterSearch,
    kitFilterTags,
    setKitFilterTags,
    activeKit,
    soundTrack,
    shellStyle,
    redeal,
    applyKit,
    onMutation,
    onMission,
    onUndo,
    onShuffle,
    onNewKit,
    onSpice,
  }
}

export type JamShellModel = ReturnType<typeof useJamShell>
