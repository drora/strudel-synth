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
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import { getKit } from '../../engine/kits'
import type { Kit } from '../../engine/kits-types'
import type { TrackRole } from '../../engine/types'
import {
  dedupeNotesByPitch,
  mergeKitSuggestions,
  suggestFromKitProfile,
} from '../../engine/kit-suggest'

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

/** Active jam kit + track role for soft-ranked completions (same profile as reshuffle). */
function resolveKitSuggestCtx(): { kit: Kit | undefined; role: TrackRole | null } {
  const jam = useJamStore.getState()
  const session = useSessionStore.getState()
  const kit = jam.kitId ? getKit(jam.kitId) : undefined
  const trackId = jam.codeTrackId ?? session.activeTrackId
  const track = trackId ? session.tracks.find((t) => t.id === trackId) : undefined
  return { kit, role: track?.role ?? null }
}

function kitBiased(
  base: Completion[],
  context: import('../../engine/kit-suggest').KitSuggestContext,
): Completion[] {
  const { kit, role } = resolveKitSuggestCtx()
  const kitOnes = suggestFromKitProfile(kit, role, context)
  if (kitOnes.length === 0) return base
  return mergeKitSuggestions(base, kitOnes) as Completion[]
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

function chromaticNoteCompletions(): Completion[] {
  // One spelling per pitch class — match kit-suggest NOTE_NAMES (no cs/db/c# triples).
  const notes = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']
  const octaves = ['0', '1', '2', '3', '4', '5', '6', '7']
  return notes.flatMap((n) =>
    octaves.map((o) => ({
      label: `${n}${o}`,
      type: 'text' as const,
      info: `Note ${n.toUpperCase()}${o}`,
      boost: o === '3' || o === '4' ? 2 : 0,
    })),
  )
}

function strudelCompletion(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const textBefore = line.text.slice(0, context.pos - line.from)

  // ── Inside .scale("..." ) — complete scale names (kit scale boosted) ──
  const scaleMatch = textBefore.match(/\.scale\(["']([^"']*)$/)
  if (scaleMatch) {
    return {
      from: context.pos - scaleMatch[1].length,
      options: withInfo(kitBiased(scaleCompletions, 'scale')),
      validFor: /^[\w\s]*$/,
    }
  }

  // ── Inside .chord("..." ) — complete chord names ──
  const chordMatch = textBefore.match(/\.chord\(["']([^"']*)$/)
  if (chordMatch) {
    return {
      from: context.pos - chordMatch[1].length,
      options: withInfo(chordCompletions),
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside .bank("..." ) — complete bank names (kit drumsBank first) ──
  const bankMatch = textBefore.match(/\.bank\(["']([^"']*)$/)
  if (bankMatch) {
    return {
      from: context.pos - bankMatch[1].length,
      options: withInfo(kitBiased(bankCompletions, 'bank')),
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside s("..." ) or sound("..." ) / .sound("..." ) ──
  // Drum roles → hits + groove fragments; melodic → melodicSounds / SOUND_CHOICES.
  const sampleMatch =
    textBefore.match(/(?:^|\b)s\(["']([^"']*)$/) ||
    textBefore.match(/sound\(["']([^"']*)$/)
  if (sampleMatch) {
    const inner = sampleMatch[1]
    const lastWord = inner.match(/(?:^|[\s~\[\]<>,])(\w*)$/)
    // When prefix is empty / after separator, also offer pattern fragments (may include spaces).
    const suggestCtx = textBefore.match(/\.sound\(["']([^"']*)$/) ? 'sound' : 'sample'
    const options = withInfo(kitBiased(getSampleCompletions(), suggestCtx))
    if (lastWord) {
      return {
        from: context.pos - lastWord[1].length,
        options,
        validFor: /^[\w]*$/,
      }
    }
    return {
      from: context.pos - inner.length,
      options,
      validFor: /^[\w]*$/,
    }
  }

  // ── Inside note("..." ) — scale-coherent notes ranked above chromatic ──
  // Dedupe enharmonics (c#/cs/db) to one label per pitch+octave; prefer kit spelling.
  const noteMatch = textBefore.match(/note\(["']([^"']*)$/)
  if (noteMatch) {
    const inner = noteMatch[1]
    const lastWord = inner.match(/(?:^|[\s~\[\]<>,])([\w#]*)$/)
    const prefix = lastWord?.[1] ?? ''
    const { kit, role } = resolveKitSuggestCtx()
    const kitOnes = suggestFromKitProfile(kit, role, 'note')
    const noteCompletions = dedupeNotesByPitch(
      mergeKitSuggestions(chromaticNoteCompletions(), kitOnes),
      { prefix },
    ) as Completion[]
    if (lastWord) {
      return {
        from: context.pos - lastWord[1].length,
        options: withInfo(noteCompletions),
        validFor: /^[\w#]*$/,
      }
    }
    return {
      from: context.pos - inner.length,
      options: withInfo(noteCompletions),
      validFor: /^[\w#]*$/,
    }
  }

  // ── Inside any string with mini-notation context ──
  const inString = textBefore.match(/["']([^"']*)$/)
  if (inString) {
    const inner = inString[1]
    const lastChar = inner.slice(-1)
    if (['*', '/', '!', '@', '?', '~', '(', '[', '<', ',', ':'].includes(lastChar)) {
      const { kit, role } = resolveKitSuggestCtx()
      const patternOnes = suggestFromKitProfile(kit, role, 'pattern')
      const merged = patternOnes.length
        ? (mergeKitSuggestions(miniNotationCompletions, patternOnes) as Completion[])
        : miniNotationCompletions
      return {
        from: context.pos,
        options: withInfo(merged),
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
 *
 * Kit-aware: completions soft-rank using the active jam kit shuffle profile
 * (same pools as apply/shuffle) — neighbor ideas only, not full-line regen.
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
