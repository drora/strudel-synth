import { useEffect, useRef, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { createExtensions } from './extensions'
import { useSessionStore } from '../../store/session-store'
import { evaluateCode, stop, composeTracks, initEngine } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'
import { liveUpdateEngine } from '../../engine/live-update'
import { reshuffleTrack } from '../../engine/reshuffle'
import { ROLE_PRESETS } from '../../engine/presets'
import type { Track } from '../../engine/types'

interface TrackCodePaneProps {
  track: Track
  isActive: boolean
}

export function TrackCodePane({ track, isActive }: TrackCodePaneProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const codeRef = useRef(track.code)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preset = ROLE_PRESETS[track.role]

  const handleEvaluate = useCallback(async () => {
    const state = useSessionStore.getState()
    try {
      await resumeAudioContext()
      await initEngine()
      const code = composeTracks(state.tracks, state.bpm)
      await evaluateCode(code)
      state.setPlaying(true)
      state.setError(track.id, null)
    } catch (err) {
      state.setError(track.id, err instanceof Error ? err.message : String(err))
    }
  }, [track.id])

  const handleStop = useCallback(async () => {
    await stop()
    useSessionStore.getState().setPlaying(false)
  }, [])

  const handleChange = useCallback(
    (code: string) => {
      codeRef.current = code
      const state = useSessionStore.getState()
      state.setCode(track.id, code)

      // Auto-update when locked
      const currentTrack = state.tracks.find((t) => t.id === track.id)
      if (currentTrack?.locked && state.isPlaying) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          liveUpdateEngine.queueUpdate('1')
        }, 300)
      }
    },
    [track.id]
  )

  const handleReshuffle = useCallback(() => {
    const newCode = reshuffleTrack(track.role, track.code)
    useSessionStore.getState().setCode(track.id, newCode)
    // If playing, queue update
    if (useSessionStore.getState().isPlaying) {
      liveUpdateEngine.queueUpdate('1')
    }
  }, [track.id, track.role, track.code])

  const handleToggleLock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useSessionStore.getState().toggleLock(track.id)
  }, [track.id])

  useEffect(() => {
    if (!editorRef.current) return

    const extensions = createExtensions({
      onEvaluate: handleEvaluate,
      onStop: handleStop,
      onChange: handleChange,
    })

    const state = EditorState.create({
      doc: track.code,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [track.id])

  // Sync external code changes into the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (codeRef.current === track.code) return

    codeRef.current = track.code
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: track.code },
    })
  }, [track.code])

  return (
    <div
      className={`
        flex flex-col border-b border-border transition-colors
        ${isActive ? 'bg-bg' : 'bg-bg/50'}
        ${track.locked ? 'border-l-2' : ''}
      `}
      style={track.locked ? { borderLeftColor: track.color } : undefined}
    >
      {/* Track header bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/50 cursor-pointer"
        onClick={() => useSessionStore.getState().setActiveTrack(track.id)}
        style={{ borderLeftWidth: track.locked ? 0 : 3, borderLeftColor: track.color }}
      >
        <span className="text-xs">{preset.icon}</span>
        <span className="text-xs font-medium text-text">{track.name}</span>
        <span className="text-[10px] text-text-muted">{preset.label}</span>
        {track.muted && <span className="text-[10px] text-error font-medium">M</span>}
        {track.soloed && <span className="text-[10px] text-accent font-medium">S</span>}
        <div className="flex-1" />
        {track.error && <span className="text-[10px] text-error mr-1">error</span>}

        {/* Reshuffle button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleReshuffle() }}
          className="px-1.5 py-0.5 text-[10px] rounded bg-bg-elevated text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
          title="Reshuffle pattern (Ctrl+Shift+R)"
        >
          Shuffle
        </button>

        {/* Lock + Update button group */}
        <div className="flex items-center rounded overflow-hidden">
          {/* Lock toggle (icon) */}
          <button
            onClick={handleToggleLock}
            className={`px-1.5 py-0.5 text-[10px] transition-colors border-r ${
              track.locked
                ? 'bg-accent/30 text-accent border-accent/30'
                : 'bg-bg-elevated text-text-muted hover:text-text border-border'
            }`}
            title={`${track.locked ? 'Unlock' : 'Lock'} auto-update (Ctrl+L) — when locked, edits auto-evaluate on the beat`}
          >
            {track.locked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
          </button>

          {/* Update button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              const state = useSessionStore.getState()
              if (state.isPlaying) {
                liveUpdateEngine.queueUpdate('1')
              } else {
                handleEvaluate()
              }
            }}
            className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
              track.locked
                ? 'bg-accent/30 text-accent'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            }`}
            title="Update on the one (Ctrl+Enter)"
          >
            Update
          </button>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className={`overflow-auto ${isActive ? 'min-h-24 max-h-64' : 'min-h-12 max-h-24'}`}
      />

      {/* Error display */}
      {track.error && (
        <div className="px-3 py-1 bg-error/10 text-error text-xs font-mono truncate">
          {track.error}
        </div>
      )}
    </div>
  )
}
