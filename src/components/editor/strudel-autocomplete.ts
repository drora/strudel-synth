import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import {
  strudelMethodCompletions,
  strudelGlobalCompletions,
  scaleCompletions,
  chordCompletions,
  miniNotationCompletions,
  bankCompletions,
  getSampleCompletions,
} from './autocomplete-data'
import type { CursorDocsKind } from './cursor-docs'

/**
 * Keep useful docs `info` when present, but never invent a duplicate panel
 * from the label alone — on mobile the CM info overlay covers the list.
 */
function withInfo(options: readonly Completion[]): Completion[] {
  return options.map((opt) => {
    if (typeof opt.info === 'function') return opt
    if (typeof opt.info === 'string' && opt.info.length > 0) {
      // Drop redundant info that only restates the label (e.g. banks).
      const normalized = opt.info.replace(/^Bank:\s*/i, '').trim()
      if (normalized === opt.label || opt.info === opt.label) {
        const { info: _drop, ...rest } = opt
        return rest
      }
      return opt
    }
    return opt
  })
}

/** Lookup used by cursor→docs / SuggestionBanner. */
export function lookupCompletionInfo(
  label: string,
  kind: CursorDocsKind,
): string | undefined {
  const pools: Completion[][] = []
  if (kind === 'method') pools.push(strudelMethodCompletions)
  else if (kind === 'global') pools.push(strudelGlobalCompletions)
  else if (kind === 'mini') {
    pools.push(miniNotationCompletions)
    pools.push(getSampleCompletions())
  } else {
    pools.push(strudelMethodCompletions, strudelGlobalCompletions, miniNotationCompletions)
  }
  for (const pool of pools) {
    const hit = pool.find((c) => c.label === label)
    if (!hit) continue
    if (typeof hit.info === 'string') return hit.info
    if (hit.detail) return `${hit.label} ${hit.detail}`
    return hit.label
  }
  return undefined
}

function strudelCompletion(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const textBefore = line.text.slice(0, context.pos - line.from)

  // ── Inside .scale("...") — complete scale names ──
  const scaleMatch = textBefore.match(/\.scale\(["']([^"']*)$/)
  if (scaleMatch) {
    return {
      from: context.pos - scaleMatch[1].length,
      options: withInfo(scaleCompletions),
      validFor: /^[\w\s]*$/,
    }
  }

  // ── Inside .chord("...") — complete chord names ──
  const chordMatch = textBefore.match(/\.chord\(["']([^"']*)$/)
  if (chordMatch) {
    return {
      from: context.pos - chordMatch[1].length,
      options: withInfo(chordCompletions),
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside .bank("...") — complete bank names ──
  const bankMatch = textBefore.match(/\.bank\(["']([^"']*)$/)
  if (bankMatch) {
    return {
      from: context.pos - bankMatch[1].length,
      options: withInfo(bankCompletions),
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside s("...") or sound("...") — complete sample names (dynamic!) ──
  const sampleMatch =
    textBefore.match(/(?:^|\b)s\(["']([^"']*)$/) ||
    textBefore.match(/sound\(["']([^"']*)$/)
  if (sampleMatch) {
    const inner = sampleMatch[1]
    const lastWord = inner.match(/(?:^|[\s~\[\]<>,])(\w*)$/)
    if (lastWord) {
      return {
        from: context.pos - lastWord[1].length,
        options: withInfo(getSampleCompletions()),
        validFor: /^[\w]*$/,
      }
    }
    return {
      from: context.pos - inner.length,
      options: withInfo(getSampleCompletions()),
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside note("...") — complete note names + mini-notation ──
  const noteMatch = textBefore.match(/note\(["']([^"']*)$/)
  if (noteMatch) {
    const inner = noteMatch[1]
    const lastWord = inner.match(/(?:^|[\s~\[\]<>,])(\w*)$/)
    const notes = [
      'c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b',
      'db', 'eb', 'gb', 'ab', 'bb',
    ]
    const octaves = ['0', '1', '2', '3', '4', '5', '6', '7']
    const noteCompletions: Completion[] = notes.flatMap((n) =>
      octaves.map((o) => ({
        label: `${n}${o}`,
        type: 'text' as const,
        info: `Note ${n.toUpperCase()}${o}`,
        boost: o === '3' || o === '4' ? 2 : 0,
      })),
    )
    if (lastWord) {
      return {
        from: context.pos - lastWord[1].length,
        options: withInfo(noteCompletions),
        validFor: /^[\w]*$/,
      }
    }
    return {
      from: context.pos - inner.length,
      options: withInfo(noteCompletions),
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside any string with mini-notation context ──
  const inString = textBefore.match(/["']([^"']*)$/)
  if (inString) {
    const inner = inString[1]
    const lastChar = inner.slice(-1)
    if (['*', '/', '!', '@', '?', '~', '(', '[', '<', ',', ':'].includes(lastChar)) {
      return {
        from: context.pos,
        options: withInfo(miniNotationCompletions),
        validFor: /^$/,
      }
    }
  }

  // ── After a dot — complete methods (info already in autocomplete-data) ──
  const dotMatch = textBefore.match(/\.(\w*)$/)
  if (dotMatch) {
    return {
      from: context.pos - dotMatch[1].length,
      options: withInfo(strudelMethodCompletions),
      validFor: /^\w*$/,
    }
  }

  // ── At word start — complete globals (need 2+ chars to trigger) ──
  const wordMatch = textBefore.match(/(?:^|[\s(,])(\w+)$/)
  if (wordMatch && wordMatch[1].length >= 2) {
    return {
      from: context.pos - wordMatch[1].length,
      options: withInfo(strudelGlobalCompletions),
      validFor: /^\w*$/,
    }
  }

  return null
}

/**
 * Ghost-text deferred: CM inline completions need extra UX surface and
 * fight mobile keyboards. Phase 1 instead couples SuggestionBanner +
 * DocsPanel to cursor context via cursor-docs.ts.
 */
export const strudelAutocomplete = autocompletion({
  override: [strudelCompletion],
  activateOnTyping: true,
  maxRenderedOptions: 25,
  // Docs `info` panel is useful on desktop; CSS hides it on narrow/coarse viewports.
  defaultKeymap: true,
  icons: true,
  closeOnBlur: true,
})
