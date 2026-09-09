import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { liveUpdateEngine } from '../../engine/live-update'
import {
  AUTOSAVE_KEY,
  SESSIONS_KEY,
  buildShareUrl,
  shareUrlTooLong,
  snapshotFromStore,
  type SavedSession,
} from '../../engine/session-codec'

export type { SavedSession }

interface SectionSnap {
  bpm: number
  tracks: Array<{ id: string; code: string; muted: boolean }>
  savedAt: number
}

const SECTION_KEY = 'strudel-studio-sections-ab'

function loadSections(): { a: SectionSnap | null; b: SectionSnap | null } {
  try {
    const raw = localStorage.getItem(SECTION_KEY)
    if (!raw) return { a: null, b: null }
    const p = JSON.parse(raw) as { a?: SectionSnap | null; b?: SectionSnap | null }
    return { a: p.a ?? null, b: p.b ?? null }
  } catch {
    return { a: null, b: null }
  }
}

function persistSections(a: SectionSnap | null, b: SectionSnap | null) {
  try {
    localStorage.setItem(SECTION_KEY, JSON.stringify({ a, b }))
  } catch { /* quota */ }
}

function captureSection(): SectionSnap {
  const state = useSessionStore.getState()
  return {
    bpm: state.bpm,
    savedAt: Date.now(),
    tracks: state.tracks.map((t) => ({
      id: t.id,
      code: t.code,
      muted: t.muted,
    })),
  }
}

export function useSessionManager() {
  const saveSession = useCallback((name?: string) => {
    const state = useSessionStore.getState()
    const session = snapshotFromStore({
      ...state,
      name: name || `Session ${new Date().toLocaleString()}`,
    })

    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session))

    let sessions: SavedSession[] = []
    try {
      sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
    } catch { /* corrupt */ }
    sessions.unshift(session)
    if (sessions.length > 20) sessions.pop()
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))

    return session
  }, [])

  const loadSession = useCallback((session: SavedSession) => {
    useSessionStore.getState().loadSavedSession(session)
  }, [])

  const getAutoSave = useCallback((): SavedSession | null => {
    const data = localStorage.getItem(AUTOSAVE_KEY)
    try {
      return data ? (JSON.parse(data) as SavedSession) : null
    } catch {
      return null
    }
  }, [])

  const getSessions = useCallback((): SavedSession[] => {
    try {
      return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') as SavedSession[]
    } catch {
      return []
    }
  }, [])

  const exportSession = useCallback(() => {
    const session = snapshotFromStore({
      ...useSessionStore.getState(),
      name: 'Exported Session',
    })
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `strudel-session-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const importSession = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const session = JSON.parse(e.target?.result as string) as SavedSession
          loadSession(session)
        } catch (err) {
          console.error('Failed to import session:', err)
        }
      }
      reader.readAsText(file)
    },
    [loadSession],
  )

  const copyShareLink = useCallback(async (): Promise<'ok' | 'long' | 'fail'> => {
    const session = snapshotFromStore({
      ...useSessionStore.getState(),
      name: 'Shared',
    })
    const url = buildShareUrl(session)
    const hashIdx = url.indexOf('#')
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : ''
    if (hash && typeof history !== 'undefined') {
      try {
        history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
      } catch { /* ignore */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      return shareUrlTooLong(url) ? 'long' : 'ok'
    } catch {
      return 'fail'
    }
  }, [])

  return {
    saveSession,
    loadSession,
    getAutoSave,
    getSessions,
    exportSession,
    importSession,
    copyShareLink,
  }
}

/** Compact A/B arrangement controls — sidebar + transport + mobile More. */
export function ArrangementLite({ compact = false }: { compact?: boolean }) {
  const [sectionA, setSectionA] = useState<SectionSnap | null>(null)
  const [sectionB, setSectionB] = useState<SectionSnap | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    const { a, b } = loadSections()
    setSectionA(a)
    setSectionB(b)
  }, [])

  const flashMsg = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1200)
  }

  const save = (which: 'a' | 'b') => {
    const snap = captureSection()
    if (which === 'a') {
      setSectionA(snap)
      persistSections(snap, sectionB)
      flashMsg('Saved A')
    } else {
      setSectionB(snap)
      persistSections(sectionA, snap)
      flashMsg('Saved B')
    }
  }

  const recall = (which: 'a' | 'b') => {
    const snap = which === 'a' ? sectionA : sectionB
    if (!snap) {
      flashMsg(which === 'a' ? 'A empty' : 'B empty')
      return
    }
    useSessionStore.getState().applySection(snap)
    const playing = useSessionStore.getState().isPlaying
    if (playing) {
      const q = useUIStore.getState().getEffectiveQuantization(
        useSessionStore.getState().activeTrackId,
      )
      liveUpdateEngine.queueUpdate(q, 'section')
    }
    flashMsg(which === 'a' ? 'Recall A' : 'Recall B')
  }

  const btn =
    compact
      ? 'px-1.5 py-0.5 text-[9px] bg-bg-elevated text-text-muted hover:text-text rounded transition-colors disabled:opacity-40'
      : 'px-2 py-1 text-[10px] bg-bg-elevated text-text-muted hover:text-text rounded transition-colors disabled:opacity-40'

  return (
    <div className={compact ? 'flex items-center gap-0.5' : 'flex items-center gap-1 flex-wrap'}>
      <button type="button" className={btn} onClick={() => save('a')} title="Save section A (codes + mute)">
        Save A
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => recall('a')}
        disabled={!sectionA}
        title="Recall section A"
      >
        Recall A
      </button>
      <button type="button" className={btn} onClick={() => save('b')} title="Save section B (codes + mute)">
        Save B
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => recall('b')}
        disabled={!sectionB}
        title="Recall section B"
      >
        Recall B
      </button>
      {flash && (
        <span className="text-[9px] text-accent ml-1 tabular-nums">{flash}</span>
      )}
    </div>
  )
}

export function SessionControls({
  showArrangement = true,
}: {
  showArrangement?: boolean
}) {
  const { saveSession, exportSession, importSession, copyShareLink } = useSessionManager()
  const pinEffects = useUIStore((s) => s.pinEffects)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onShare = async () => {
    const result = await copyShareLink()
    if (shareTimer.current) clearTimeout(shareTimer.current)
    setShareStatus(
      result === 'ok'
        ? 'Link copied'
        : result === 'long'
          ? 'Copied (long URL)'
          : 'Hash set — copy address bar',
    )
    shareTimer.current = setTimeout(() => setShareStatus(null), 2000)
  }

  return (
    <div className="px-3 py-2 border-b border-border space-y-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => saveSession()}
          className="px-2 py-1 text-[10px] bg-bg-elevated text-text-muted hover:text-text rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={exportSession}
          className="px-2 py-1 text-[10px] bg-bg-elevated text-text-muted hover:text-text rounded transition-colors"
        >
          Export
        </button>
        <label className="px-2 py-1 text-[10px] bg-bg-elevated text-text-muted hover:text-text rounded transition-colors cursor-pointer">
          Import
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importSession(file)
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void onShare()}
          className="px-2 py-1 text-[10px] bg-bg-elevated text-accent hover:bg-accent/15 rounded transition-colors"
          title="Copy shareable URL (session in hash)"
        >
          Copy share link
        </button>
        {shareStatus && (
          <span className="text-[9px] text-accent">{shareStatus}</span>
        )}
      </div>

      <label
        className="flex items-center gap-1.5 text-[10px] text-text-muted cursor-pointer select-none"
        title="When shuffling, keep trailing .lpf/.room/… effect chain"
      >
        <input
          type="checkbox"
          checked={pinEffects}
          onChange={(e) => useUIStore.getState().setPinEffects(e.target.checked)}
          className="accent-accent"
        />
        Pin effects on shuffle
      </label>

      {showArrangement && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-text-muted mb-1">
            Arrangement
          </div>
          <ArrangementLite />
        </div>
      )}
    </div>
  )
}

/** First-load autosave restore prompt (hash takes priority and skips this). */
export function RestoreAutosavePrompt({
  session,
  onRestore,
  onDismiss,
}: {
  session: SavedSession
  onRestore: () => void
  onDismiss: () => void
}) {
  const when = new Date(session.timestamp).toLocaleString()
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-lg font-semibold text-text mb-1">Restore last session?</h2>
        <p className="text-sm text-text-muted mb-4">
          Found an autosave from <span className="text-text">{when}</span>
          {' '}({session.tracks.length} tracks · {session.bpm} BPM)
          {session.name ? ` — “${session.name}”` : ''}.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-2 text-sm rounded bg-bg-elevated text-text-muted hover:text-text"
          >
            Start fresh
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="px-3 py-2 text-sm rounded bg-accent/25 text-accent font-medium hover:bg-accent/35"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}
