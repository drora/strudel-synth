import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createExtensions } from '../editor/extensions'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import { liveUpdateEngine, type UpdateStatus } from '../../engine/live-update'
import { startOrQueueUpdate } from '../../engine/playback'
import {
  applyAllCodeToTracks,
  tracksToAllCode,
} from '../../engine/all-code'

/**
 * Header Code — one editor for every track.
 * Chip long-press / Edit in Code still opens the single-track sheet.
 */
export function JamAllCodeSheet() {
  const tracks = useSessionStore((s) => s.tracks)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const textRef = useRef(tracksToAllCode(tracks))
  const [status, setStatus] = useState<UpdateStatus>('idle')

  const close = () => useJamStore.getState().setCodeTrackId(null)

  const applyText = useCallback((text: string) => {
    textRef.current = text
    const session = useSessionStore.getState()
    const diffs = applyAllCodeToTracks(text, session.tracks)
    for (const d of diffs) {
      session.setCode(d.id, d.code)
    }
    if (diffs.length > 0) {
      useJamStore.getState().touchTrack(diffs[diffs.length - 1]!.id)
      liveUpdateEngine.markDirty()
    }
  }, [])

  const handleEvaluate = useCallback(async () => {
    try {
      await startOrQueueUpdate('1')
      for (const t of useSessionStore.getState().tracks) {
        useSessionStore.getState().setError(t.id, null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      useJamStore.getState().setLastPeek(`Code · ${msg}`)
    }
  }, [])

  const applyRef = useRef(applyText)
  const evalRef = useRef(handleEvaluate)
  applyRef.current = applyText
  evalRef.current = handleEvaluate

  useEffect(() => liveUpdateEngine.subscribe((s) => setStatus(s)), [])

  useEffect(() => {
    if (!editorRef.current) return
    const extensions = createExtensions({
      onEvaluate: () => void evalRef.current(),
      onStop: () => {},
      onChange: (code) => applyRef.current(code),
    })
    const view = new EditorView({
      state: EditorState.create({
        doc: textRef.current,
        extensions,
      }),
      parent: editorRef.current,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const next = tracksToAllCode(tracks)
    const current = view.state.doc.toString()
    if (current === next) {
      textRef.current = next
      return
    }
    const main = view.state.selection.main
    textRef.current = next
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      selection: EditorSelection.range(
        Math.min(main.anchor, next.length),
        Math.min(main.head, next.length),
      ),
    })
  }, [tracks])

  const updateCls =
    status === 'queued'
      ? 'bg-orange-500/30 text-orange-300'
      : status === 'dirty'
        ? 'bg-yellow-500/20 text-yellow-300'
        : status === 'applied'
          ? 'bg-success/30 text-success'
          : status === 'error'
            ? 'bg-error/30 text-error'
            : 'bg-accent/10 text-accent hover:bg-accent/20'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-label="Code · all tracks"
      onClick={close}
    >
      <div
        className="w-full max-w-4xl max-h-[92dvh] sm:max-h-[88vh] h-[88dvh] flex flex-col rounded-2xl bg-bg-elevated border border-border overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-accent">Code</div>
            <div className="text-sm font-semibold truncate text-text">
              All tracks · {tracks.length}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleEvaluate()}
              className={`min-h-11 px-3 rounded-xl text-xs font-medium border border-border ${updateCls}`}
            >
              {status === 'queued' ? 'Queued' : status === 'dirty' ? 'Dirty' : 'Save'}
            </button>
            <button
              type="button"
              onClick={close}
              className="min-h-11 min-w-11 px-3 rounded-xl text-xs font-medium bg-bg text-text-muted border border-border hover:text-text"
            >
              Done
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div ref={editorRef} className="flex-1 min-h-0 overflow-auto" />
        </div>
      </div>
    </div>
  )
}
