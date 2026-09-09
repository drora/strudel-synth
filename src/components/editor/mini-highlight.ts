import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view'

/**
 * Lightweight mini-notation highlighter for quoted string interiors.
 * Uses mark decorations (no nested Lezer grammar) so we stay on the
 * existing React/Vite/CM6 stack without new packages.
 */

type MiniKind = 'rest' | 'op' | 'bracket' | 'number' | 'note' | 'punct'

const MARK: Record<MiniKind, Decoration> = {
  rest: Decoration.mark({ class: 'cm-mini-rest' }),
  op: Decoration.mark({ class: 'cm-mini-op' }),
  bracket: Decoration.mark({ class: 'cm-mini-bracket' }),
  number: Decoration.mark({ class: 'cm-mini-number' }),
  note: Decoration.mark({ class: 'cm-mini-note' }),
  punct: Decoration.mark({ class: 'cm-mini-punct' }),
}

/** Tokenize one mini-notation string (content between quotes). */
export function tokenizeMini(inner: string): { from: number; to: number; kind: MiniKind }[] {
  const tokens: { from: number; to: number; kind: MiniKind }[] = []
  let i = 0
  while (i < inner.length) {
    const c = inner[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '~' || c === '-') {
      tokens.push({ from: i, to: i + 1, kind: 'rest' })
      i++
      continue
    }
    if (c === '*' || c === '/' || c === '@' || c === '!' || c === '?') {
      tokens.push({ from: i, to: i + 1, kind: 'op' })
      i++
      continue
    }
    if ('[]<>(){}'.includes(c)) {
      tokens.push({ from: i, to: i + 1, kind: 'bracket' })
      i++
      continue
    }
    if (c === ',' || c === '|' || c === ':' || c === '%' || c === '^') {
      tokens.push({ from: i, to: i + 1, kind: 'punct' })
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1
      while (j < inner.length && /[0-9.]/.test(inner[j])) j++
      tokens.push({ from: i, to: j, kind: 'number' })
      i = j
      continue
    }
    // Sample / note / atom names (incl. sharp-ish # and unicode letter ranges used by mini)
    if (/[A-Za-z_#]/.test(c)) {
      let j = i + 1
      while (j < inner.length && /[\w#]/.test(inner[j])) j++
      tokens.push({ from: i, to: j, kind: 'note' })
      i = j
      continue
    }
    i++
  }
  return tokens
}

/** Find non-template quoted string ranges: { from, to, contentFrom, contentTo, inner } */
export function findQuotedStrings(
  text: string,
): { from: number; to: number; contentFrom: number; contentTo: number; inner: string }[] {
  const out: {
    from: number
    to: number
    contentFrom: number
    contentTo: number
    inner: string
  }[] = []
  const re = /(["'])((?:\\.|(?!\1).)*?)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const from = m.index
    const to = m.index + m[0].length
    const contentFrom = from + 1
    const contentTo = to - 1
    out.push({ from, to, contentFrom, contentTo, inner: m[2] })
  }
  return out
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const text = view.state.doc.toString()
  for (const str of findQuotedStrings(text)) {
    // Skip empty / very long non-pattern strings (e.g. pasted prose)
    if (!str.inner || str.inner.length > 400) continue
    for (const tok of tokenizeMini(str.inner)) {
      const from = str.contentFrom + tok.from
      const to = str.contentFrom + tok.to
      if (from >= to || to > view.state.doc.length) continue
      builder.add(from, to, MARK[tok.kind])
    }
  }
  return builder.finish()
}

export const miniHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)
