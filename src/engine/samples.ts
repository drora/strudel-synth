/**
 * Canonical sample / bank registry for autocomplete + Jam sound sheet.
 * Keep lists here — UI layers map to Completions or SoundChoice as needed.
 */

export interface SampleInfo {
  name: string
  info: string
}

export { FEATURED_BANKS } from './samples-featured'
import { EXTRA_AUTOCOMPLETE_SAMPLES } from './samples-curated'

/** Dirt-samples core names used before dynamic registry fills. */
export const CORE_DIRT_SAMPLES: SampleInfo[] = [
  { name: 'bd', info: 'Bass drum / kick' },
  { name: 'sd', info: 'Snare drum' },
  { name: 'hh', info: 'Hi-hat (closed)' },
  { name: 'hh27', info: 'Hi-hat (27 variations)' },
  { name: 'oh', info: 'Open hi-hat' },
  { name: 'cp', info: 'Clap' },
  { name: 'rim', info: 'Rimshot' },
  { name: 'cb', info: 'Cowbell' },
  { name: 'lt', info: 'Low tom' },
  { name: 'mt', info: 'Mid tom' },
  { name: 'ht', info: 'High tom' },
  { name: 'cr', info: 'Crash cymbal' },
  { name: 'ride', info: 'Ride cymbal' },
  { name: 'rs', info: 'Rimshot (alt)' },
  { name: 'sn', info: 'Snare (alt)' },
  { name: 'clubkick', info: 'Club kick' },
  { name: 'hardkick', info: 'Hard kick' },
  { name: 'kicklinn', info: 'LinnDrum kick' },
  { name: 'popkick', info: 'Pop kick' },
  { name: 'reverbkick', info: 'Reverbed kick' },
  { name: 'realclaps', info: 'Real clap samples' },
  { name: 'hand', info: 'Handclap' },
  { name: 'linnhats', info: 'LinnDrum hi-hats' },
  { name: '808', info: 'TR-808 kit' },
  { name: 'dr', info: 'Drum machine' },
  { name: 'dr2', info: 'Drum machine 2' },
  { name: 'dr55', info: 'DR-55' },
  { name: 'dr_few', info: 'Minimal drum machine' },
  { name: 'drum', info: 'Acoustic drum' },
  { name: 'drumtraks', info: 'Sequential DrumTraks' },
  { name: 'electro1', info: 'Electro kit' },
  { name: 'casio', info: 'Casio keyboard drums' },
  { name: 'gretsch', info: 'Gretsch drum kit' },
  { name: 'breaks125', info: 'Breakbeat 125bpm' },
  { name: 'breaks152', info: 'Breakbeat 152bpm' },
  { name: 'breaks157', info: 'Breakbeat 157bpm' },
  { name: 'breaks165', info: 'Breakbeat 165bpm' },
  { name: 'amencutup', info: 'Amen break chops' },
  { name: 'bass', info: 'Bass' },
  { name: 'bass0', info: 'Bass variant 0' },
  { name: 'bass1', info: 'Bass variant 1' },
  { name: 'bass2', info: 'Bass variant 2' },
  { name: 'bass3', info: 'Bass variant 3' },
  { name: 'bassdm', info: 'Bass drum-machine style' },
  { name: 'bassfoo', info: 'Bass (foo)' },
  { name: 'jvbass', info: 'JV bass synth' },
  { name: 'jungbass', info: 'Jungle bass' },
  { name: 'wobble', info: 'Wobble bass' },
  { name: 'pluck', info: 'Plucked string' },
  { name: 'arpy', info: 'Arp synth' },
  { name: 'juno', info: 'Juno synth' },
  { name: 'sax', info: 'Saxophone' },
  { name: 'gtr', info: 'Guitar' },
  { name: 'pad', info: 'Synth pad' },
  { name: 'padlong', info: 'Long synth pad' },
  { name: 'sitar', info: 'Sitar' },
  { name: 'fm', info: 'FM synth samples' },
  { name: 'arp', info: 'Arpeggio' },
  { name: 'newnotes', info: 'New melodic notes' },
  { name: 'notes', info: 'Musical notes' },
  { name: 'sid', info: 'SID chip (C64)' },
  { name: 'perc', info: 'Percussion' },
  { name: 'peri', info: 'Peri sounds' },
  { name: 'tabla', info: 'Tabla' },
  { name: 'tabla2', info: 'Tabla (alt)' },
  { name: 'tablex', info: 'Tabla (extended)' },
  { name: 'metal', info: 'Metal hit' },
  { name: 'click', info: 'Click' },
  { name: 'tink', info: 'Tink' },
  { name: 'tok', info: 'Tok percussion' },
  { name: 'glasstap', info: 'Glass tap' },
  { name: 'pebbles', info: 'Pebble sounds' },
  { name: 'noise', info: 'Noise' },
  { name: 'noise2', info: 'Noise variant' },
  { name: 'glitch', info: 'Glitch FX' },
  { name: 'glitch2', info: 'Glitch FX (alt)' },
  { name: 'fire', info: 'Fire sounds' },
  { name: 'insect', info: 'Insect sounds' },
  { name: 'bubble', info: 'Bubble sounds' },
  { name: 'stab', info: 'Stab synth' },
  { name: 'rave', info: 'Rave stab' },
  { name: 'rave2', info: 'Rave stab (alt)' },
  { name: 'ravemono', info: 'Rave stab (mono)' },
  { name: 'hoover', info: 'Hoover synth' },
  { name: 'hit', info: 'Hit sound' },
  { name: 'blip', info: 'Blip sound' },
  { name: 'flick', info: 'Flick sound' },
  { name: 'house', info: 'House kit' },
  { name: 'techno', info: 'Techno sounds' },
  { name: 'jazz', info: 'Jazz kit' },
  { name: 'hardcore', info: 'Hardcore kit' },
  { name: 'gabba', info: 'Gabba kit' },
  { name: 'gabbaloud', info: 'Gabba (loud)' },
  { name: 'gabbalouder', info: 'Gabba (louder!)' },
  { name: 'jungle', info: 'Jungle kit' },
  { name: 'industrial', info: 'Industrial sounds' },
  { name: 'mouth', info: 'Mouth sounds' },
  { name: 'yeah', info: 'Yeah vocal' },
  { name: 'auto', info: 'Drum break kit' },
  { name: 'hmm', info: 'Hmm vocal' },
  { name: 'speechless', info: 'Speechless vocal' },
  { name: 'diphone', info: 'Diphone speech' },
  { name: 'diphone2', info: 'Diphone speech (alt)' },
  { name: 'numbers', info: 'Spoken numbers' },
  { name: 'alphabet', info: 'Spoken alphabet' },
  { name: 'space', info: 'Space sounds' },
  { name: 'wind', info: 'Wind sounds' },
  { name: 'birds', info: 'Bird sounds' },
  { name: 'birds3', info: 'Bird sounds (alt)' },
  { name: 'breath', info: 'Breath sounds' },
  { name: 'outdoor', info: 'Outdoor ambience' },
  { name: 'crow', info: 'Crow sounds' },
  { name: 'future', info: 'Future sounds' },
  { name: 'invaders', info: 'Space Invaders' },
  { name: 'circus', info: 'Circus sounds' },
  { name: 'toys', info: 'Toy sounds' },
  { name: 'kurt', info: 'Kurt vocal samples' },
  { name: 'xmas', info: 'Christmas sounds' },
  { name: 'bottle', info: 'Bottle sounds' },
  { name: 'can', info: 'Can sounds' },
  { name: 'lighter', info: 'Lighter click' },
  { name: 'print', info: 'Printer sounds' },
]

/** Always-available synth oscillators (not sample banks). */
export const SYNTH_OSCILLATORS: SampleInfo[] = [
  { name: 'sawtooth', info: '⚡ Saw wave oscillator' },
  { name: 'square', info: '⚡ Square wave oscillator' },
  { name: 'triangle', info: '⚡ Triangle wave oscillator' },
  { name: 'sine', info: '⚡ Sine wave oscillator' },
]

/** Deferred community banks loaded after first sound (desktop) or post-gesture (mobile). */
export const COMMUNITY_SAMPLE_BANKS: string[] = [
  'github:yaxu/clean-breaks',
  'github:Bubobubobubobubo/Dough-Amen',
  'github:Bubobubobubobubo/Dough-Juj',
  'github:eddyflux/crate',
  'github:TodePond/samples',
  'github:algorave-dave/samples',
  'github:AuditeMarlow/samples',
  'github:terrorhank/samples',
  'github:tesspilot/samples',
  'github:TristanCacqueray/mirus',
  'github:k09/samples',
  'github:EloMorelo/samples',
  'github:Nikeryms/Samples',
  'github:RikyBac15/samples',
  'github:fstiffo/polifonia-samples',
  'github:kaiye10/strudelSamples',
  'github:fjpolo/fjpolo-Strudel',
  'github:mysinglelise/msl-strudel-samples',
  'github:salsicha/capoeira_strudel',
  'github:sonidosingapura/rochormatic',
  'github:hvillase/cavlp-25p',
  'github:bruveping/RepositorioDesonidosParaExperimentar02',
  'github:QuantumVillage/quantum-music',
  'github:Veikkosuhonen/graffathon25-demo',
  'github:AustinOliverHaskell/ms-teams-sounds-strudel',
]

/** Melodic + kit sample names for Code autocomplete (prebaked packs + dirt core). */
export const CURATED_AUTOCOMPLETE_SAMPLES: string[] = [
  ...CORE_DIRT_SAMPLES.map((s) => s.name),
  ...EXTRA_AUTOCOMPLETE_SAMPLES,
]

// ── Dynamic registry (runtime) ──────────────────────────────
let dynamicSampleNames: string[] | null = null

/** Register sample names discovered after banks load. */
export function registerSampleNames(names: string[]): void {
  const existing = new Set(CORE_DIRT_SAMPLES.map((s) => s.name))
  const synth = new Set(SYNTH_OSCILLATORS.map((s) => s.name))
  dynamicSampleNames = names
    .filter((n) => n && !existing.has(n) && !synth.has(n))
    .sort()
}

export function getRegisteredSampleNames(): string[] {
  return dynamicSampleNames ?? []
}

/** All known sample names: core + dynamic (+ optional synths). */
export function listSampleNames(opts?: { includeSynths?: boolean }): string[] {
  const core = CORE_DIRT_SAMPLES.map((s) => s.name)
  const dyn = getRegisteredSampleNames()
  const synths = opts?.includeSynths === false ? [] : SYNTH_OSCILLATORS.map((s) => s.name)
  return [...core, ...dyn, ...synths]
}
