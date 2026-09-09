import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/**
 * Cursor → docs bridge (Phase 1).
 *
 * Editors dispatch lightweight context into a tiny pub/sub store.
 * DocsPanel (and SuggestionBanner) subscribe without coupling to
 * live-update / transport.
 *
 * Integration point for DocsPanel:
 *   import { subscribeCursorDocs, type CursorDocsContext } from '../editor/cursor-docs'
 *   useEffect(() => subscribeCursorDocs((ctx) => { ... }), [])
 */

export type CursorDocsKind = 'method' | 'global' | 'mini' | 'none'

export interface CursorDocsContext {
  /** Symbol under / just before cursor, e.g. "lpf", "bd", "*", "note" */
  symbol: string
  kind: CursorDocsKind
  /** Optional one-line hint from autocomplete-data when known */
  info?: string
  /** Docs section id suggestion: mini | sounds | effects | patterns | tonal | signals */
  sectionId?: string
  /** Track / editor id if available (reserved) */
  source?: string
  updatedAt: number
}

type Listener = (ctx: CursorDocsContext) => void

const EMPTY: CursorDocsContext = {
  symbol: '',
  kind: 'none',
  updatedAt: 0,
}

let current: CursorDocsContext = EMPTY
const listeners = new Set<Listener>()

export function getCursorDocs(): CursorDocsContext {
  return current
}

export function subscribeCursorDocs(listener: Listener): () => void {
  listeners.add(listener)
  listener(current)
  return () => {
    listeners.delete(listener)
  }
}

function publish(ctx: CursorDocsContext) {
  // Avoid thrashing identical publishes
  if (
    ctx.symbol === current.symbol &&
    ctx.kind === current.kind &&
    ctx.info === current.info &&
    ctx.sectionId === current.sectionId
  ) {
    return
  }
  current = ctx
  for (const l of listeners) l(ctx)
}

/** Map method/global names to DocsPanel section ids */
export function sectionForSymbol(symbol: string, kind: CursorDocsKind): string | undefined {
  if (kind === 'mini') return 'mini'
  const s = symbol.toLowerCase()
  if (['s', 'note', 'sound', 'bank', 'n', 'stack', 'cat'].includes(s)) return 'sounds'
  if (
    [
      'lpf', 'hpf', 'bpf', 'lpq', 'hpq', 'bpq', 'gain', 'pan', 'room', 'delay',
      'delaytime', 'delayfeedback', 'shape', 'crush', 'distort', 'coarse',
      'attack', 'release', 'vowel', 'djf', 'phaser', 'tremolo',
    ].includes(s)
  ) {
    return 'effects'
  }
  if (
    [
      'fast', 'slow', 'hurry', 'rev', 'jux', 'every', 'sometimes', 'struct',
      'chop', 'off', 'early', 'late', 'palindrome', 'fastGap',
    ].includes(s)
  ) {
    return 'patterns'
  }
  if (['scale', 'chord', 'voicing'].includes(s)) return 'tonal'
  if (['sine', 'saw', 'square', 'tri', 'perlin', 'rand'].includes(s)) return 'signals'
  return undefined
}

const MINI_OPS = new Set(['~', '*', '/', '!', '@', '?', '[', ']', '<', '>', ',', '(', ')', ':'])

/**
 * Resolve a lightweight symbol from the line text before the cursor.
 * Mirrors autocomplete triggers (dot methods, globals, mini inside strings).
 */
export function resolveCursorSymbol(
  textBefore: string,
  infoLookup?: (label: string, kind: CursorDocsKind) => string | undefined,
): CursorDocsContext {
  const now = Date.now()

  // Inside a string — mini op or atom near cursor
  const inString = textBefore.match(/["']([^"']*)$/)
  if (inString) {
    const inner = inString[1]
    const lastChar = inner.slice(-1)
    if (MINI_OPS.has(lastChar)) {
      const kind: CursorDocsKind = 'mini'
      return {
        symbol: lastChar,
        kind,
        info: infoLookup?.(lastChar, kind),
        sectionId: 'mini',
        updatedAt: now,
      }
    }
    const lastWord = inner.match(/(?:^|[\s~\[\]<>,|*\/@!?():])([A-Za-z_][\w#]*)$/)
    if (lastWord?.[1]) {
      const kind: CursorDocsKind = 'mini'
      return {
        symbol: lastWord[1],
        kind,
        info: infoLookup?.(lastWord[1], kind),
        sectionId: 'mini',
        updatedAt: now,
      }
    }
    return { ...EMPTY, updatedAt: now }
  }

  // After a dot — method name
  const dotMatch = textBefore.match(/\.(\w*)$/)
  if (dotMatch && dotMatch[1].length > 0) {
    const kind: CursorDocsKind = 'method'
    const symbol = dotMatch[1]
    return {
      symbol,
      kind,
      info: infoLookup?.(symbol, kind),
      sectionId: sectionForSymbol(symbol, kind),
      updatedAt: now,
    }
  }

  // Word / global
  const wordMatch = textBefore.match(/(?:^|[\s(,=])(\w+)$/)
  if (wordMatch && wordMatch[1].length >= 2) {
    const kind: CursorDocsKind = 'global'
    const symbol = wordMatch[1]
    return {
      symbol,
      kind,
      info: infoLookup?.(symbol, kind),
      sectionId: sectionForSymbol(symbol, kind),
      updatedAt: now,
    }
  }

  return { ...EMPTY, updatedAt: now }
}

/** CodeMirror extension: publish cursor context on selection / doc changes. */
export function cursorDocsExtension(
  infoLookup?: (label: string, kind: CursorDocsKind) => string | undefined,
): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet && !update.docChanged && !update.focusChanged) return
    if (!update.view.hasFocus && update.focusChanged) {
      // Keep last context when blurring so DocsPanel doesn't flicker empty
      return
    }
    const pos = update.state.selection.main.head
    const line = update.state.doc.lineAt(pos)
    const textBefore = line.text.slice(0, pos - line.from)
    publish(resolveCursorSymbol(textBefore, infoLookup))
  })
}
