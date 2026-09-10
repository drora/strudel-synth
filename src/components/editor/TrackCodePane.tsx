import { useEffect, useRef, useCallback, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorSelection, EditorState } from '@codemirror/state'
import { createExtensions } from './extensions'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import { getKit } from '../../engine/kits'
import { useUIStore, QUANT_OPTIONS } from '../../store/ui-store'
import { liveUpdateEngine, type UpdateStatus, type Quantization } from '../../engine/live-update'
import { startOrQueueUpdate, stopPlayback } from '../../engine/playback'
import { reshuffleTrack } from '../../engine/reshuffle'
import { ROLE_PRESETS } from '../../engine/presets'
import type { Track } from '../../engine/types'

interface TrackCodePaneProps {
  track: Track
  isActive: boolean
  /** Mobile one-track focus: inactive → header only; active → full-height editor */
  focusMode?: boolean
}

export function TrackCodePane({ track, isActive, focusMode = false }: TrackCodePaneProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const codeRef = useRef(track.code)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const preset = ROLE_PRESETS[track.role]
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [menuOpen, setMenuOpen] = useState(false)

  const defaultQuantization = useUIStore((s) => s.defaultQuantization)
  const trackQuant = useUIStore((s) => s.trackQuantization[track.id])
  const effectiveQuant = trackQuant ?? defaultQuantization
  const quantShort =
    QUANT_OPTIONS.find((o) => o.value === effectiveQuant)?.short ?? effectiveQuant

  useEffect(() => liveUpdateEngine.subscribe((s) => setUpdateStatus(s)), [])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const handleEvaluate = useCallback(async (quant?: Quantization) => {
    const q = quant ?? useUIStore.getState().getEffectiveQuantization(track.id)
    try {
      await startOrQueueUpdate(q)
      useSessionStore.getState().setError(track.id, null)
    } catch (err) {
      useSessionStore.getState().setError(
        track.id,
        err instanceof Error ? err.message : String(err),
      )
    }
  }, [track.id])

  const handleStop = useCallback(async () => {
    await stopPlayback()
  }, [])

  const handleChange = useCallback(
    (code: string) => {
      codeRef.current = code
      const state = useSessionStore.getState()
      state.setCode(track.id, code)
      useJamStore.getState().touchTrack(track.id)
      liveUpdateEngine.markDirty()

      const currentTrack = state.tracks.find((t) => t.id === track.id)
      if (currentTrack?.locked && state.isPlaying) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          const q = useUIStore.getState().getEffectiveQuantization(track.id)
          liveUpdateEngine.queueUpdate(q, 'lock')
        }, 300)
      }
    },
    [track.id],
  )

  const handleReshuffle = useCallback(() => {
    const pinEffects = useUIStore.getState().pinEffects
    const jam = useJamStore.getState()
    const activeKit = jam.kitId ? getKit(jam.kitId) : undefined
    const newCode = reshuffleTrack(track.role, track.code, {
      pinEffects,
      lockKit: jam.lockKit || !!activeKit,
      bank: activeKit?.drumsBank,
      shuffle: activeKit?.shuffle,
    })
    useSessionStore.getState().setCode(track.id, newCode)
    useJamStore.getState().touchTrack(track.id)
    liveUpdateEngine.markDirty()
    if (useSessionStore.getState().isPlaying) {
      const q = useUIStore.getState().getEffectiveQuantization(track.id)
      liveUpdateEngine.queueUpdate(q, 'reshuffle')
    }
  }, [track.id, track.role, track.code])

  const handleToggleLock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useSessionStore.getState().toggleLock(track.id)
  }, [track.id])

  const pickQuant = useCallback(
    (q: Quantization, asDefault: boolean) => {
      const ui = useUIStore.getState()
      ui.setTrackQuantization(track.id, q)
      if (asDefault) ui.setDefaultQuantization(q)
      setMenuOpen(false)
      void handleEvaluate(q)
    },
    [track.id, handleEvaluate],
  )

  const showEditor = !focusMode || isActive

  // Keep CM callbacks stable across re-renders so we never remount the editor.
  const handleEvaluateRef = useRef(handleEvaluate)
  const handleStopRef = useRef(handleStop)
  const handleChangeRef = useRef(handleChange)
  handleEvaluateRef.current = handleEvaluate
  handleStopRef.current = handleStop
  handleChangeRef.current = handleChange

  useEffect(() => {
    if (!showEditor || !editorRef.current) return

    const extensions = createExtensions({
      onEvaluate: () => handleEvaluateRef.current(),
      onStop: () => handleStopRef.current(),
      onChange: (code) => handleChangeRef.current(code),
    })

    const state = EditorState.create({
      doc: codeRef.current,
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
  }, [track.id, showEditor])

  // External store → editor only when docs differ. Never replace on our own keystrokes
  // (view may be ahead until React commits). Preserve selection so caret does not jump to EOL.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === track.code) {
      codeRef.current = track.code
      return
    }

    const main = view.state.selection.main
    const len = track.code.length
    codeRef.current = track.code
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: track.code },
      selection: EditorSelection.range(
        Math.min(main.anchor, len),
        Math.min(main.head, len),
      ),
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

  const touchBtn = focusMode ? 'min-h-11 min-w-11 px-2 py-2 text-xs' : 'px-1.5 py-0.5 text-[10px]'
  const touchUpdate = focusMode ? 'min-h-11 px-3 py-2 text-xs' : 'px-2 py-0.5 text-[10px]'

  return (
    <div
      className={`
        flex flex-col border-b border-border transition-colors
        ${isActive ? 'bg-bg' : 'bg-bg/50'}
        ${track.locked ? 'border-l-2' : ''}
        ${focusMode && isActive ? 'flex-1 min-h-0' : ''}
        ${focusMode && !isActive ? 'shrink-0' : ''}
      `}
      style={track.locked ? { borderLeftColor: track.color } : undefined}
    >
      <div
        className={`flex items-center gap-1.5 px-3 border-b border-border/50 cursor-pointer ${
          focusMode ? 'py-2 min-h-11' : 'py-1.5'
        }`}
        onClick={() => useSessionStore.getState().setActiveTrack(track.id)}
        style={{ borderLeftWidth: track.locked ? 0 : 3, borderLeftColor: track.color }}
      >
        <span className="text-xs">{preset.icon}</span>
        <span className={`${focusMode ? 'text-sm font-semibold tracking-tight' : 'text-xs font-medium'} text-text`}>{track.name}</span>
        <span className="text-[10px] text-text-muted">{preset.label}</span>
        {track.muted && <span className="text-[10px] text-error font-medium">M</span>}
        {track.soloed && <span className="text-[10px] text-accent font-medium">S</span>}
        <div className="flex-1" />
        {track.error && <span className="text-[10px] text-error mr-1">error</span>}

        {(!focusMode || isActive) && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handleReshuffle() }}
              className={`${touchBtn} rounded bg-bg-elevated text-text-muted hover:text-accent hover:bg-accent/10 transition-colors flex items-center justify-center`}
              title="Reshuffle pattern (Ctrl+Shift+R)"
            >
              Shuffle
            </button>

            <div className="relative flex items-center rounded overflow-visible" ref={menuRef}>
              <button
                onClick={handleToggleLock}
                className={`${touchBtn} transition-colors border-r flex items-center justify-center ${
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
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenuOpen(true)
                }}
                className={`${touchUpdate} font-medium transition-colors ${updateBtnClass}`}
                title={`Update (${effectiveQuant}) — right-click or ▾ for quantization`}
              >
                {updateStatus === 'queued'
                  ? `Queued ·${quantShort}`
                  : updateStatus === 'dirty'
                    ? 'Dirty'
                    : updateStatus === 'applied'
                      ? 'Applied'
                      : `Update ·${quantShort}`}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen((o) => !o)
                }}
                className={`${focusMode ? 'min-h-11 min-w-11 px-2 text-xs' : 'px-1 py-0.5 text-[10px]'} border-l border-border/40 ${updateBtnClass}`}
                title="Quantization: 1 / 2 / 4 / immediate"
                aria-label="Quantization menu"
              >
                ▾
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded border border-border bg-bg-surface shadow-lg py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-text-muted">
                    This track
                  </div>
                  {QUANT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent/15 ${
                        effectiveQuant === opt.value ? 'text-accent' : 'text-text'
                      }`}
                      onClick={() => pickQuant(opt.value, false)}
                    >
                      {opt.label}
                      {trackQuant === opt.value ? ' ✓' : ''}
                    </button>
                  ))}
                  <div className="border-t border-border my-1" />
                  <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-text-muted">
                    Set global default
                  </div>
                  {QUANT_OPTIONS.map((opt) => (
                    <button
                      key={`def-${opt.value}`}
                      className={`w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent/15 ${
                        defaultQuantization === opt.value ? 'text-accent' : 'text-text-muted'
                      }`}
                      onClick={() => pickQuant(opt.value, true)}
                    >
                      Default → {opt.label}
                      {defaultQuantization === opt.value ? ' ★' : ''}
                    </button>
                  ))}
                  {trackQuant && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        className="w-full text-left px-2 py-1.5 text-[11px] text-text-muted hover:bg-accent/15"
                        onClick={() => {
                          useUIStore.getState().setTrackQuantization(track.id, null)
                          setMenuOpen(false)
                        }}
                      >
                        Clear track override
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showEditor && (
        <div
          ref={editorRef}
          className={`overflow-auto ${
            focusMode
              ? 'flex-1 min-h-0'
              : isActive
                ? 'min-h-24 max-h-64'
                : 'min-h-12 max-h-24'
          }`}
        />
      )}

      {track.error && (
        <div className="px-3 py-1 bg-error/10 text-error text-xs font-mono truncate">
          {track.error}
        </div>
      )}
    </div>
  )
}
