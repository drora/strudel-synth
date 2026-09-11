/**
 * Read-only suggestion helpers for CodeMirror autocomplete.
 * Same shuffle profile + drumsBank as kit apply / reshuffle; note/scale use song
 * root/scale when callers pass harmony — ranked neighbor ideas, never whole-track regen.
 */
export type { KitSuggestContext, KitSuggestion } from './kit-suggest-core'
export { notePitchKey } from './kit-suggest-core'
export { suggestFromKitProfile, type KitSuggestHarmony } from './kit-suggest-pools'
export {
  type Suggestable,
  extractUsedNotePitchKeys,
  dedupeNotesByPitch,
  mergeKitSuggestions,
} from './kit-suggest-dedupe'
