/**
 * Read-only suggestion helpers for CodeMirror autocomplete.
 * Same shuffle profile + drumsBank as kit apply / reshuffle — ranked neighbor ideas,
 * never whole-track regeneration.
 */
export type { KitSuggestContext, KitSuggestion } from './kit-suggest-core'
export { notePitchKey } from './kit-suggest-core'
export { suggestFromKitProfile } from './kit-suggest-pools'
export {
  type Suggestable,
  extractUsedNotePitchKeys,
  dedupeNotesByPitch,
  mergeKitSuggestions,
} from './kit-suggest-dedupe'
