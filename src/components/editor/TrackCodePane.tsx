import { useEffect, useRef, useCallback, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { createExtensions } from './extensions'
import { useSessionStore } from '../../store/session-store'
import { stop, composeTracks, initEngine, evaluateCode } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'
import { liveUpdateEngine, type UpdateStatus } from '../../engine/live-update'
import { reshuffleTrack } from '../../engine/reshuffle'
import { ROLE_PRESETS } from '../../engine/presets'
import type { Track } from '../../engine/types'

interface TrackCodePaneProps {
  track: Track
  isActive: boolean
}

async function startOrQueueUpdate(quant: 'immediate' | '1' | '2' | '4' = '1') {
  const state = useSessionStore.getState()
  if (state.isPlaying) {
    liveUpdateEngine.queueUpdate(quant, 'manual')
    return
  }
  await resumeAudioContext()
  await initEngine()
  state.setPlaying(true)
  liveUpdateEngine.markPlayStarted()
  const code = composeTracks(state.tracks, state.bpm)
  await evaluateCode(code)
  liveUpdateEngine.markPlayStarted()
}

export function TrackCodePane({ track, isActive }: TrackCodePaneProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const codeRef = useRef(track.code)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preset = ROLE_PRESETS[track.role]
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')

  useEffect(() => liveUpdateEngine.subscribe((s) => setUpdateStatus(s)), [])

  const handleEvaluate = useCallback(async () => {
    try {
      await startOrQueueUpdate('1')
      useSessionStore.getState().setError(track.id, null)
    } catch (err) {
      useSessionStore.getState().setError(
        track.id,
        err instanceof Error ? err.message : String(err),
      )
    }
  }, [track.id])

  const handleStop = useCallback(async () => {
    liveUpdateEngine.markPlayStopped()
    await stop()
    useSessionStore.getState().setPlaying(false)
  }, [])

  const handleChange = useCallback(
    (code: string) => {
      codeRef.current = code
      const state = useSessionStore.getState()
      state.setCode(track.id, code)
      liveUpdateEngine.markDirty()

      const currentTrack = state.tracks.find((t) => t.id === track.id)
      if (currentTrack?.locked && state.isPlaying) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          liveUpdateEngine.queueUpdate('1', 'lock')
        }, 300)
      }
    },
    [track.id],
  )

  const handleReshuffle = useCallback(() => {
    const newCode = reshuffleTrack(track.role, track.code)
    useSessionStore.getState().setCode(track.id, newCode)
    liveUpdateEngine.markDirty()
    if (useSessionStore.getState().isPlaying) {
      liveUpdateEngine.queueUpdate('1', 'reshuffle')
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

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (codeRef.current === track.code) return

    codeRef.current = track.code
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: track.code },
    })
  }, [track.code])

  const updateBtnClass =
    updateStatus === 'queued'
      ? 'bg-orange-500/30 text-orange-300'
      : updateStatus === 'dirty'
        ? 'bg-yellow-500/20 text-yellow-300'
        : updateStatus === 'applied'
          ? 'bg-success/30 text-success'
          : updateStatus === 'error'
            ? 'bg-error/30 text-error'
            : track.locked
              ? 'bg-accent/30 text-accent'
              : 'bg-accent/10 text-accent hover:bg-accent/20'

  return (
    <div
      className={`
        flex flex-col border-b border-border transition-colors
        ${isActive ? 'bg-bg' : 'bg-bg/50'}
        ${track.locked ? 'border-l-2' : ''}
      `}
      style={track.locked ? { borderLeftColor: track.color } : undefined}
    >
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

        <button
          onClick={(e) => { e.stopPropagation(); handleReshuffle() }}
          className="px-1.5 py-0.5 text-[10px] rounded bg-bg-elevated text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
          title="Reshuffle pattern (Ctrl+Shift+R)"
        >
          Shuffle
        </button>

        <div className="flex items-center rounded overflow-hidden">
          <button
            onClick={handleToggleLock}
            className={`px-1.5 py-0.5 text-[10px] transition-colors border-r ${
              track.locked
                ? 'bg-accent/30 text-accent border-accent/30'
                : 'bg-bg-elevated text-text-muted hover:text-text border-border'
            }`}
            title={`${track.locked ? 'Unlock' : 'Lock'} auto-update (Ctrl+L)`}
          >
            {track.locked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              void handleEvaluate()
            }}
            className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${updateBtnClass}`}
            title="Update on the one (Ctrl+Enter)"
          >
            {updateStatus === 'queued'
              ? 'Queued'
              : updateStatus === 'dirty'
                ? 'Dirty'
                : updateStatus === 'applied'
                  ? 'Applied'
                  : 'Update'}
          </button>
        </div>
      </div>

      <div
        ref={editorRef}
        className={`overflow-auto ${isActive ? 'min-h-24 max-h-64' : 'min-h-12 max-h-24'}`}
      />

      {track.error && (
        <div className="px-3 py-1 bg-error/10 text-error text-xs font-mono truncate">
          {track.error}
        </div>
      )}
    </div>
  )
}
