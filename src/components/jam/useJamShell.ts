import { useEffect, useCallback, useMemo, useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { useJamStore } from '../../store/jam-store'
import {
  KITS,
  getKit,
} from '../../engine/kits'
import { filterKits, pickRandomKit } from '../../engine/kit-browser'
import {
  applyKit as applyKitAction,
  freshStartJam,
  resetFreshStartGuard,
  reshuffleUnlocked,
  spiceTracks,
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
  const songRoot = useJamStore((s) => s.songRoot)
  const songScale = useJamStore((s) => s.songScale)
  const lockKit = useJamStore((s) => s.lockKit)
  const showKitPicker = useJamStore((s) => s.showKitPicker)
  const lastPeek = useJamStore((s) => s.lastPeek)
  const soundTrackId = useJamStore((s) => s.soundTrackId)
  const undoLen = useJamStore((s) => s.undoStack.length)

  /** Soft-tag / search filters for kit browser (+ New Kit). */
  const [kitFilterSearch, setKitFilterSearch] = useState('')
  const [showMutateSheet, setShowMutateSheet] = useState(false)
  // Soft tags start empty (kit-first). Persisted `vibe` still updates on applyKit.
  const [kitFilterTags, setKitFilterTags] = useState<string[]>([])

  const kits = KITS
  const filteredKits = useMemo(
    () => filterKits(kits, { search: kitFilterSearch, tags: kitFilterTags }),
    [kits, kitFilterSearch, kitFilterTags],
  )
  const activeKit = kitId ? getKit(kitId) : undefined
  const soundTrack = tracks.find((t) => t.id === soundTrackId)

  const applyKit = useCallback((id: string, fromPicker = false) => {
    applyKitAction(id, { fromPicker })
  }, [])

  useEffect(() => {
    freshStartJam()
    let afterMount = false
    const markReady = () => {
      afterMount = true
    }
    queueMicrotask(markReady)
    const onPageShow = (event: PageTransitionEvent) => {
      if (!(event.persisted || afterMount)) return
      resetFreshStartGuard()
      freshStartJam()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onUndo = () => {
    const entry = useJamStore.getState().popUndo()
    if (!entry) return
    const session = useSessionStore.getState()
    if (entry.batch && entry.batch.length > 0) {
      for (const snap of entry.batch) {
        session.setCode(snap.trackId, snap.code)
      }
    } else {
      session.setCode(entry.trackId, entry.code)
    }
    const jam = useJamStore.getState()
    jam.touchTrack(entry.trackId)
    jam.setLastPeek(`Undo · ${entry.label}`)
    queueJam('jam')
  }

  const onShuffle = () => {
    reshuffleUnlocked()
  }

  const onNewKit = () => {
    const pool = filteredKits.length > 0 ? filteredKits : kits
    const pick = pickRandomKit(pool, kitId)
    if (pick) applyKit(pick.id)
  }

  const onSpice = () => {
    spiceTracks(useSessionStore.getState().activeTrackId)
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
    songRoot,
    songScale,
    lockKit,
    showKitPicker,
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
    applyKit,
    onUndo,
    onShuffle,
    onNewKit,
    onSpice,
    showMutateSheet,
    setShowMutateSheet,
  }
}

export type JamShellModel = ReturnType<typeof useJamShell>
