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
} from '../../engine/jam-actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useVisualViewportHeight } from '../../hooks/useVisualViewport'
import {
  PREBAKE_MIN_VISIBLE_MS,
  queueJam,
  useMinVisible,
} from './jam-shell-utils'
import { liveUpdateEngine } from '../../engine/live-update'
import { applySpiceToTracks } from '../../engine/spice'

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

  const applyKit = useCallback((id: string, fromPicker = false) => {
    // Picker / New Kit: leave recipe as-is (no auto-reshuffle).
    applyKitAction(id, { fromPicker })
  }, [])

  // Fresh start on mount; bfcache / pageshow re-run so restore yields new riffs.
  useEffect(() => {
    freshStartJam()
    let afterMount = false
    const markReady = () => {
      afterMount = true
    }
    // Skip the initial pageshow that can race with mount; always re-run after that.
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
    const state = useSessionStore.getState()
    const activeId = state.activeTrackId
    const result = applySpiceToTracks(state.tracks, activeId)
    if (!result) {
      useJamStore.getState().setLastPeek('Spice · (no change)')
      return
    }
    const prev = state.tracks.find((t) => t.id === result.trackId)
    if (prev) {
      useJamStore.getState().pushUndo({
        trackId: prev.id,
        code: prev.code,
        label: `Spice · ${result.label}`,
      })
    }
    state.setCode(result.trackId, result.code)
    useJamStore.getState().setLastPeek(`Spice · ${result.label}`)
    liveUpdateEngine.markDirty()
    queueJam('jam')
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
  }
}

export type JamShellModel = ReturnType<typeof useJamShell>
