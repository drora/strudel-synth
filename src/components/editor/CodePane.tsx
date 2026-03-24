import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { createExtensions } from './extensions'
import { useSessionStore } from '../../store/session-store'
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

function StudioCodePane() {
  const tracks = useSessionStore((s) => s.tracks)
  const activeTrackId = useSessionStore((s) => s.activeTrackId)

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        Pick a template or add a track to get started
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {tracks.map((track) => (
        <TrackCodePane
          key={track.id}
          track={track}
          isActive={track.id === activeTrackId}
        />
      ))}
    </div>
  )
}
