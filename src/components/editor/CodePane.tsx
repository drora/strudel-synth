import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorSelection, EditorState } from '@codemirror/state'
import { createExtensions } from './extensions'

interface CodePaneProps {
  learnMode?: boolean
  learnCode?: string
  onLearnCodeChange?: (code: string) => void
}

function LearnEditor({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const codeRef = useRef(code)

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

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === code) {
      codeRef.current = code
      return
    }
    const main = view.state.selection.main
    const len = code.length
    codeRef.current = code
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: code },
      selection: EditorSelection.range(
        Math.min(main.anchor, len),
        Math.min(main.head, len),
      ),
    })
  }, [code])

  return (
    <div className="h-full overflow-auto bg-bg" ref={editorRef} />
  )
}

/** Shared editor entry — Learn uses a local buffer; Jam uses TrackCodePane via JamCodeSheet. */
export function CodePane({ learnMode, learnCode, onLearnCodeChange }: CodePaneProps) {
  if (learnMode && onLearnCodeChange) {
    return <LearnEditor code={learnCode ?? ''} onChange={onLearnCodeChange} />
  }

  return (
    <div className="flex items-center justify-center h-full text-text-muted text-sm px-4 text-center">
      Open a track’s Code sheet from Jam to edit patterns.
    </div>
  )
}
