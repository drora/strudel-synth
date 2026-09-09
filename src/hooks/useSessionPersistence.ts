/**
 * Boot restore (share hash → autosave prompt) + debounced autosave.
 * Mount once inside StudioShell.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/session-store'
import { useUIStore } from '../store/ui-store'
import {
  AUTOSAVE_KEY,
  decodeShareHash,
  snapshotFromStore,
  type SavedSession,
} from '../engine/session-codec'

const DEBOUNCE_MS = 500

function readAutosave(): SavedSession | null {
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

function writeAutosave(session: SavedSession): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session))
  } catch (err) {
    console.warn('[Strudel Studio] autosave failed:', err)
  }
}

export function useSessionPersistence() {
  const [restoreCandidate, setRestoreCandidate] = useState<SavedSession | null>(null)
  const booted = useRef(false)
  const skipNextAutosave = useRef(false)

  const applySession = useCallback((session: SavedSession) => {
    useSessionStore.getState().loadSavedSession(session)
  }, [])

  // Boot: hash first, else prompt autosave if empty session
  useEffect(() => {
    if (booted.current) return
    booted.current = true

    const fromHash = decodeShareHash(
      typeof location !== 'undefined' ? location.hash : '',
    )
    if (fromHash && fromHash.tracks.length > 0) {
      skipNextAutosave.current = true
      applySession(fromHash)
      useUIStore.getState().setShowTemplateModal(false)
      return
    }

    const auto = readAutosave()
    const empty = useSessionStore.getState().tracks.length === 0
    if (auto && auto.tracks.length > 0 && empty) {
      setRestoreCandidate(auto)
    }
  }, [applySession])

  // Debounced autosave on tracks / bpm
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const unsub = useSessionStore.subscribe((state, prev) => {
      if (state.tracks === prev.tracks && state.bpm === prev.bpm) return
      if (skipNextAutosave.current) {
        skipNextAutosave.current = false
        return
      }
      if (state.tracks.length === 0) return

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const s = useSessionStore.getState()
        writeAutosave(snapshotFromStore(s))
      }, DEBOUNCE_MS)
    })

    return () => {
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [])

  const acceptRestore = useCallback(() => {
    if (!restoreCandidate) return
    skipNextAutosave.current = true
    applySession(restoreCandidate)
    useUIStore.getState().setShowTemplateModal(false)
    setRestoreCandidate(null)
  }, [restoreCandidate, applySession])

  const dismissRestore = useCallback(() => {
    setRestoreCandidate(null)
  }, [])

  return {
    restoreCandidate,
    acceptRestore,
    dismissRestore,
  }
}
