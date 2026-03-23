import { useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import type { Track, Template } from '../../engine/types'

interface SavedSession {
  version: 1
  timestamp: number
  name: string
  bpm: number
  tracks: Omit<Track, 'error'>[]
  templateId: string | null
}

const STORAGE_KEY = 'strudel-studio-session'
const SESSIONS_KEY = 'strudel-studio-sessions'

export function useSessionManager() {
  const saveSession = useCallback((name?: string) => {
    const state = useSessionStore.getState()
    const session: SavedSession = {
      version: 1,
      timestamp: Date.now(),
      name: name || `Session ${new Date().toLocaleString()}`,
      bpm: state.bpm,
      tracks: state.tracks.map(({ error, ...t }) => t),
      templateId: state.templateId,
    }

    // Save as current
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

    // Add to sessions list
    let sessions: SavedSession[] = []
    try { sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') } catch { /* corrupt data */ }
    sessions.unshift(session)
    if (sessions.length > 20) sessions.pop() // keep last 20
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))

    return session
  }, [])

  const loadSession = useCallback((session: SavedSession) => {
    const store = useSessionStore.getState()
    const template: Template = {
      id: session.templateId || 'loaded',
      name: session.name,
      description: '',
      bpm: session.bpm,
      tracks: session.tracks.map((t) => ({
        name: t.name,
        role: t.role,
        code: t.code,
        color: t.color,
      })),
    }
    store.loadTemplate(template)
    store.setBpm(session.bpm)
  }, [])

  const getAutoSave = useCallback((): SavedSession | null => {
    const data = localStorage.getItem(STORAGE_KEY)
    try { return data ? JSON.parse(data) : null } catch { return null }
  }, [])

  const getSessions = useCallback((): SavedSession[] => {
    try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') } catch { return [] }
  }, [])

  const exportSession = useCallback(() => {
    const state = useSessionStore.getState()
    const session: SavedSession = {
      version: 1,
      timestamp: Date.now(),
      name: 'Exported Session',
      bpm: state.bpm,
      tracks: state.tracks.map(({ error, ...t }) => t),
      templateId: state.templateId,
    }
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `strudel-session-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const importSession = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const session: SavedSession = JSON.parse(e.target?.result as string)
        loadSession(session)
      } catch (err) {
        console.error('Failed to import session:', err)
      }
    }
    reader.readAsText(file)
  }, [loadSession])

  return { saveSession, loadSession, getAutoSave, getSessions, exportSession, importSession }
}

export function SessionControls() {
  const { saveSession, exportSession, importSession } = useSessionManager()

  return (
    <div className="px-3 py-2 border-b border-border">
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
      </div>
    </div>
  )
}
