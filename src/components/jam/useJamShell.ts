import { useEffect, useCallback, useMemo } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { useJamStore } from '../../store/jam-store'
import {
  getKitsForVibe,
  getKit,
  kitToTemplate,
  type VibeId,
} from '../../engine/kits'
import { suggestMutations, applyMutationToTracks, type MutationCard } from '../../engine/mutators'
import { suggestMissions, applyMissionToTracks, type MissionCard } from '../../engine/missions'
import { reshuffleTrack } from '../../engine/reshuffle'
import { liveUpdateEngine } from '../../engine/live-update'
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
  const hasPickedKit = useJamStore((s) => s.hasPickedKit)
  const mutationDeal = useJamStore((s) => s.mutationDeal)
  const missionDeal = useJamStore((s) => s.missionDeal)
  const lastPeek = useJamStore((s) => s.lastPeek)
  const soundTrackId = useJamStore((s) => s.soundTrackId)
  const undoLen = useJamStore((s) => s.undoStack.length)
  const kits = useMemo(() => getKitsForVibe(vibe), [vibe])
  const activeKit = kitId ? getKit(kitId) : undefined
  const soundTrack = tracks.find((t) => t.id === soundTrackId)

  const redeal = useCallback(() => {
    const stateTracks = useSessionStore.getState().tracks
    const jam = useJamStore.getState()
    jam.setMutationDeal(suggestMutations(stateTracks, 3))
    jam.setMissionDeal(suggestMissions(stateTracks, 2))
  }, [])

  const applyKit = useCallback((id: string, fromPicker = false) => {
    const kit = getKit(id)
    if (!kit) return
    const template = kitToTemplate(kit)
    useSessionStore.getState().loadTemplate(template)
    const jam = useJamStore.getState()
    jam.setKitId(kit.id)
    jam.setVibe(kit.vibe)
    jam.setHasPickedKit(true)
    if (fromPicker) jam.setShowKitPicker(false)
    jam.setLastPeek(`kit · ${kit.name}`)
    const nextTracks = useSessionStore.getState().tracks
    jam.setMutationDeal(suggestMutations(nextTracks, 3))
    jam.setMissionDeal(suggestMissions(nextTracks, 2))
    queueJam('kit')
  }, [])

  useEffect(() => {
    if (tracks.length === 0) {
      const first = getKitsForVibe(vibe)[0]
      if (first) applyKit(first.id)
    } else if (mutationDeal.length === 0 || missionDeal.length === 0) {
      redeal()
    }
    if (!hasPickedKit) {
      useJamStore.getState().setShowKitPicker(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onVibe = (v: VibeId) => {
    useJamStore.getState().setVibe(v)
    const list = getKitsForVibe(v)
    const preferred = list.find((k) => k.id === kitId) ?? list[0]
    if (preferred) applyKit(preferred.id)
  }

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
    const state = useSessionStore.getState()
    const pinEffects = useUIStore.getState().pinEffects
    const jam = useJamStore.getState()
    for (const t of state.tracks) {
      if (t.locked) continue
      const next = reshuffleTrack(t.role, t.code, {
        pinEffects,
        lockKit: jam.lockKit,
        bank: jam.lockKit ? activeKit?.drumsBank : undefined,
      })
      state.setCode(t.id, next)
    }
    jam.setLastPeek(jam.lockKit ? 'Shuffle · same kit' : 'Shuffle · free')
    queueJam('reshuffle')
    redeal()
  }

  const onNewKit = () => {
    const list = getKitsForVibe(vibe)
    if (list.length === 0) return
    const others = list.filter((k) => k.id !== kitId)
    const pick = others[Math.floor(Math.random() * Math.max(others.length, 1))] ?? list[0]
    applyKit(pick.id)
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
    activeKit,
    soundTrack,
    shellStyle,
    redeal,
    applyKit,
    onVibe,
    onMutation,
    onMission,
    onUndo,
    onShuffle,
    onNewKit,
    onSpice,
  }
}

export type JamShellModel = ReturnType<typeof useJamShell>
