import type { Completion } from '@codemirror/autocomplete'
import {
  CORE_DIRT_SAMPLES as CORE_DIRT_SAMPLE_INFOS,
  SYNTH_OSCILLATORS,
  FEATURED_BANKS,
  registerSampleNames,
  getRegisteredSampleNames,
} from '../../engine/samples'

export const CORE_DIRT_SAMPLES: Completion[] = CORE_DIRT_SAMPLE_INFOS.map((s) => ({
  label: s.name,
  info: s.info,
  type: 'text' as const,
}))

export const synthOscillators: Completion[] = SYNTH_OSCILLATORS.map((s) => ({
  label: s.name,
  type: 'keyword' as const,
  info: s.info,
}))

let dynamicSampleCompletions: Completion[] | null = null

/** Called by the engine after sample banks are loaded to register all available sample names */
export function registerDynamicSamples(names: string[]): void {
  registerSampleNames(names)
  const existing = new Set(CORE_DIRT_SAMPLES.map((c) => c.label))
  const synthNames = new Set(synthOscillators.map((c) => c.label))
  const newSamples: Completion[] = getRegisteredSampleNames()
    .filter((n) => !existing.has(n) && !synthNames.has(n))
    .map((name) => ({ label: name, type: 'text' as const, info: `🌐 ${name}` }))

  dynamicSampleCompletions = [...CORE_DIRT_SAMPLES, ...newSamples, ...synthOscillators]
  console.log(
    `[Autocomplete] Registered ${newSamples.length} community samples (${dynamicSampleCompletions.length} total)`,
  )
}

/** Get sample completions — dynamic if available, static fallback otherwise */
export function getSampleCompletions(): Completion[] {
  return dynamicSampleCompletions ?? [...CORE_DIRT_SAMPLES, ...synthOscillators]
}

export const bankCompletions: Completion[] = FEATURED_BANKS.map((name) => ({
  label: name,
  type: 'text',
  detail: 'bank',
}))
