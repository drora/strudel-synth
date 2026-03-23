import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import {
  strudelMethodCompletions,
  strudelGlobalCompletions,
  scaleCompletions,
  chordCompletions,
  miniNotationCompletions,
  bankCompletions,
  getSampleCompletions,
} from './autocomplete-data'

function strudelCompletion(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const textBefore = line.text.slice(0, context.pos - line.from)

  // ── Inside .scale("...") — complete scale names ──
  const scaleMatch = textBefore.match(/\.scale\(["']([^"']*)$/)
  if (scaleMatch) {
    return {
      from: context.pos - scaleMatch[1].length,
      options: scaleCompletions,
      validFor: /^[\w\s]*$/,
    }
  }

  // ── Inside .chord("...") — complete chord names ──
  const chordMatch = textBefore.match(/\.chord\(["']([^"']*)$/)
  if (chordMatch) {
    return {
      from: context.pos - chordMatch[1].length,
      options: chordCompletions,
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside .bank("...") — complete bank names ──
  const bankMatch = textBefore.match(/\.bank\(["']([^"']*)$/)
  if (bankMatch) {
    return {
      from: context.pos - bankMatch[1].length,
      options: bankCompletions,
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside s("...") or sound("...") — complete sample names (dynamic!) ──
  const sampleMatch = textBefore.match(/(?:^|\b)s\(["']([^"']*)$/) || textBefore.match(/sound\(["']([^"']*)$/)
  if (sampleMatch) {
    // Get the last word after space (inside mini-notation, user may type "bd sd h|")
    const inner = sampleMatch[1]
    const lastWord = inner.match(/(?:^|[\s~\[\]<>,])(\w*)$/)
    if (lastWord) {
      return {
        from: context.pos - lastWord[1].length,
        options: getSampleCompletions(),
        validFor: /^[\w]*$/,
      }
    }
    return {
      from: context.pos - inner.length,
      options: getSampleCompletions(),
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
    const noteCompletions = notes.flatMap((n) =>
      octaves.map((o) => ({
        label: `${n}${o}`,
        type: 'text' as const,
        info: `Note ${n.toUpperCase()}${o}`,
        boost: o === '3' || o === '4' ? 2 : 0, // Boost common octaves
      }))
    )
    if (lastWord) {
      return {
        from: context.pos - lastWord[1].length,
        options: noteCompletions,
        validFor: /^[\w]*$/,
      }
    }
    return {
      from: context.pos - inner.length,
      options: noteCompletions,
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside any string with mini-notation context ──
  // Detect if cursor is inside quotes and user typed a special char
  const inString = textBefore.match(/["']([^"']*)$/)
  if (inString) {
    const inner = inString[1]
    // Only show mini-notation help if the last char could be a mini-notation trigger
    const lastChar = inner.slice(-1)
    if (['*', '/', '!', '@', '?', '~', '(', '[', '<', ',', ':'].includes(lastChar)) {
      return {
        from: context.pos,
        options: miniNotationCompletions,
        validFor: /^$/,
      }
    }
  }

  // ── After a dot — complete methods ──
  const dotMatch = textBefore.match(/\.(\w*)$/)
  if (dotMatch) {
    return {
      from: context.pos - dotMatch[1].length,
      options: strudelMethodCompletions,
      validFor: /^\w*$/,
    }
  }

  // ── At word start — complete globals (need 2+ chars to trigger) ──
  const wordMatch = textBefore.match(/(?:^|[\s(,])(\w+)$/)
  if (wordMatch && wordMatch[1].length >= 2) {
    return {
      from: context.pos - wordMatch[1].length,
      options: strudelGlobalCompletions,
      validFor: /^\w*$/,
    }
  }

  return null
}

export const strudelAutocomplete = autocompletion({
  override: [strudelCompletion],
  activateOnTyping: true,
  maxRenderedOptions: 25,
})
