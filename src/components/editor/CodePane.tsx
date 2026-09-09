import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { createExtensions } from './extensions'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { useIsMobile } from '../../hooks/useIsMobile'
import { TrackCodePane } from './TrackCodePane'

interface CodePaneProps {
  learnMode?: boolean
  learnCode?: string
  onLearnCodeChange?: (code: string) => void
}

function LearnEditor({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const codeRef = useRef(code)

  // Create editor
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return

    const extensions = createExtensions({
      onEvaluate: () => {},
      onStop: () => {},
      onChange: (newCode) => {
        codeRef.current = newCode
        onChange(newCode)
      },
    })

    const state = EditorState.create({
      doc: code,
      extensions,
    })

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external code changes (challenge switch)
  useEffect(() => {
    const view = viewRef.current
    if (!view || code === codeRef.current) return
    codeRef.current = code
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: code },
    })
  }, [code])

  return (
    <div className="h-full overflow-auto bg-bg" ref={editorRef} />
  )
}

export function CodePane({ learnMode, learnCode, onLearnCodeChange }: CodePaneProps) {
  if (learnMode && onLearnCodeChange) {
    return <LearnEditor code={learnCode ?? ''} onChange={onLearnCodeChange} />
  }

  return <StudioCodePane />
}

/**
 * Studio multi-track editors.
 * Mobile (Phase 3): one-track focus — active track editor fills height;
 * inactive tracks collapse to headers only (full list still in left drawer).
 */
function StudioCodePane() {
  const tracks = useSessionStore((s) => s.tracks)
  const activeTrackId = useSessionStore((s) => s.activeTrackId)
  const isMobile = useIsMobile()

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="text-4xl opacity-80" aria-hidden>▶</div>
        <div>
          <p className="text-text font-medium text-base mb-1">Ready to make music?</p>
          <p className="text-text-muted text-sm max-w-xs mx-auto">
            Load a template, then tap Play in the transport bar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => useUIStore.getState().setShowTemplateModal(true)}
          className="mt-1 px-6 py-3 rounded-xl bg-accent text-bg font-semibold text-sm shadow-[0_0_20px_rgba(167,139,250,0.35)] hover:bg-accent/90 active:scale-95 transition-all"
        >
          Play with a template
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col h-full ${
        isMobile ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
    >
      {tracks.map((track) => (
        <TrackCodePane
          key={track.id}
          track={track}
          isActive={track.id === activeTrackId}
          focusMode={isMobile}
        />
      ))}
    </div>
  )
}
