import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createExtensions } from '../editor/extensions'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import { liveUpdateEngine, type UpdateStatus } from '../../engine/live-update'
import { startOrQueueUpdate } from '../../engine/playback'
import {
  applyImportToTracks,
  applyJamHeader,
  checkImportCode,
  allCodeFilename,
  IMPORT_FILE_ACCEPT,
  downloadAllCode,
  tracksToAllCode,
  type AllCodeMeta,
} from '../../engine/all-code'
import { getKit } from '../../engine/kits'

/**
 * Header Code — one editor for every track.
 * Chip long-press / Edit in Code still opens the single-track sheet.
 */
export function JamAllCodeSheet() {
  const tracks = useSessionStore((s) => s.tracks)
  const pendingAllCode = useJamStore((s) => s.pendingAllCode)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const holdImport = useRef(false)
  const initial = useRef<string | null>(null)

  const jamMeta = (): AllCodeMeta => {
    const jam = useJamStore.getState()
    return {
      kitId: jam.kitId,
      kitName: jam.kitId ? getKit(jam.kitId)?.name : null,
      root: jam.songRoot,
      scale: jam.songScale,
      bpm: useSessionStore.getState().bpm,
    }
  }

  if (initial.current == null) {
    const pending = useJamStore.getState().pendingAllCode
    if (pending != null) {
      initial.current = pending
      holdImport.current = true
      useJamStore.getState().setPendingAllCode(null)
    } else {
      initial.current = tracksToAllCode(tracks, jamMeta())
    }
  }
  const textRef = useRef(initial.current)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [issue, setIssue] = useState<string | null>(null)

  const close = () => {
    useJamStore.getState().setPendingAllCode(null)
    useJamStore.getState().setCodeTrackId(null)
  }

  const applyText = useCallback((text: string) => {
    textRef.current = text
    const session = useSessionStore.getState()
    const check = checkImportCode(text, session.tracks)
    setIssue(check.ok ? null : check.message)
    if (!check.ok) return
    const last = useJamStore.getState().lastTouchedTrackId
    const diffs = applyImportToTracks(text, session.tracks, last)
    for (const d of diffs) {
      session.setCode(d.id, d.code)
    }
    const chromeChanged = applyJamHeader(text)
    if (holdImport.current || chromeChanged) {
      useJamStore.getState().resetIntensitySession()
    }
    if (diffs.length > 0) {
      useJamStore.getState().touchTrack(diffs[diffs.length - 1]!.id)
      liveUpdateEngine.markDirty()
    } else if (chromeChanged) {
      liveUpdateEngine.markDirty()
    }
  }, [])

  const setDoc = useCallback((text: string) => {
    textRef.current = text
    const view = viewRef.current
    if (view) {
      const main = view.state.selection.main
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: EditorSelection.range(
          Math.min(main.anchor, text.length),
          Math.min(main.head, text.length),
        ),
      })
    }
    applyText(text)
  }, [applyText])

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
    applyRef.current(textRef.current)
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    if (pendingAllCode == null) return
    holdImport.current = true
    useJamStore.getState().setPendingAllCode(null)
    setDoc(pendingAllCode)
  }, [pendingAllCode, setDoc])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (holdImport.current) {
      holdImport.current = false
      return
    }
    const next = tracksToAllCode(tracks, jamMeta())
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

  const onPickFile = (file: File | undefined) => {
    if (!file) return
    void file.text().then((text) => {
      holdImport.current = true
      setDoc(text)
    })
  }

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
            <input
              ref={fileRef}
              type="file"
              accept={IMPORT_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                onPickFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-11 px-3 rounded-xl text-xs font-medium bg-bg text-text-muted border border-border hover:text-text"
            >
              Load file
            </button>
            <button
              type="button"
              onClick={() => {
                const jam = useJamStore.getState()
                const meta = jamMeta()
                const name = allCodeFilename({
                  kit: jam.kitId ? getKit(jam.kitId)?.name : null,
                  root: jam.songRoot,
                  scale: jam.songScale,
                  bpm: useSessionStore.getState().bpm,
                })
                downloadAllCode(
                  tracksToAllCode(useSessionStore.getState().tracks, meta),
                  name,
                )
              }}
              className="min-h-11 px-3 rounded-xl text-xs font-medium bg-bg text-text-muted border border-border hover:text-text"
            >
              Export
            </button>
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
        {issue && (
          <div
            className="shrink-0 px-3 py-2 bg-error/15 border-b border-error/40 text-error text-xs font-medium"
            role="alert"
          >
            {issue}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div ref={editorRef} className="flex-1 min-h-0 overflow-auto" />
        </div>
      </div>
    </div>
  )
}
