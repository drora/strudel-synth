import type { Completion } from '@codemirror/autocomplete'

// ═══════════════════════════════════════════════════════════════
// Static fallback sample list (dirt-samples core)
// Used before dynamic registry is populated
// ═══════════════════════════════════════════════════════════════
export const CORE_DIRT_SAMPLES: Completion[] = [
  // Drums & Kicks
  { label: 'bd', info: 'Bass drum / kick' },
  { label: 'sd', info: 'Snare drum' },
  { label: 'hh', info: 'Hi-hat (closed)' },
  { label: 'hh27', info: 'Hi-hat (27 variations)' },
  { label: 'oh', info: 'Open hi-hat' },
  { label: 'cp', info: 'Clap' },
  { label: 'rim', info: 'Rimshot' },
  { label: 'cb', info: 'Cowbell' },
  { label: 'lt', info: 'Low tom' },
  { label: 'mt', info: 'Mid tom' },
  { label: 'ht', info: 'High tom' },
  { label: 'cr', info: 'Crash cymbal' },
  { label: 'ride', info: 'Ride cymbal' },
  { label: 'rs', info: 'Rimshot (alt)' },
  { label: 'sn', info: 'Snare (alt)' },
  { label: 'clubkick', info: 'Club kick' },
  { label: 'hardkick', info: 'Hard kick' },
  { label: 'kicklinn', info: 'LinnDrum kick' },
  { label: 'popkick', info: 'Pop kick' },
  { label: 'reverbkick', info: 'Reverbed kick' },
  { label: 'realclaps', info: 'Real clap samples' },
  { label: 'hand', info: 'Handclap' },
  { label: 'linnhats', info: 'LinnDrum hi-hats' },
  // Drum machines
  { label: '808', info: 'TR-808 kit' },
  { label: 'dr', info: 'Drum machine' },
  { label: 'dr2', info: 'Drum machine 2' },
  { label: 'dr55', info: 'DR-55' },
  { label: 'dr_few', info: 'Minimal drum machine' },
  { label: 'drum', info: 'Acoustic drum' },
  { label: 'drumtraks', info: 'Sequential DrumTraks' },
  { label: 'electro1', info: 'Electro kit' },
  { label: 'casio', info: 'Casio keyboard drums' },
  { label: 'gretsch', info: 'Gretsch drum kit' },
  // Breaks
  { label: 'breaks125', info: 'Breakbeat 125bpm' },
  { label: 'breaks152', info: 'Breakbeat 152bpm' },
  { label: 'breaks157', info: 'Breakbeat 157bpm' },
  { label: 'breaks165', info: 'Breakbeat 165bpm' },
  { label: 'amencutup', info: 'Amen break chops' },
  // Bass
  { label: 'bass', info: 'Bass' },
  { label: 'bass0', info: 'Bass variant 0' },
  { label: 'bass1', info: 'Bass variant 1' },
  { label: 'bass2', info: 'Bass variant 2' },
  { label: 'bass3', info: 'Bass variant 3' },
  { label: 'bassdm', info: 'Bass drum-machine style' },
  { label: 'bassfoo', info: 'Bass (foo)' },
  { label: 'jvbass', info: 'JV bass synth' },
  { label: 'jungbass', info: 'Jungle bass' },
  { label: 'wobble', info: 'Wobble bass' },
  // Melodic
  { label: 'pluck', info: 'Plucked string' },
  { label: 'arpy', info: 'Arp synth' },
  { label: 'juno', info: 'Juno synth' },
  { label: 'sax', info: 'Saxophone' },
  { label: 'gtr', info: 'Guitar' },
  { label: 'pad', info: 'Synth pad' },
  { label: 'padlong', info: 'Long synth pad' },
  { label: 'sitar', info: 'Sitar' },
  { label: 'fm', info: 'FM synth samples' },
  { label: 'arp', info: 'Arpeggio' },
  { label: 'newnotes', info: 'New melodic notes' },
  { label: 'notes', info: 'Musical notes' },
  { label: 'sid', info: 'SID chip (C64)' },
  // Percussion & World
  { label: 'perc', info: 'Percussion' },
  { label: 'peri', info: 'Peri sounds' },
  { label: 'tabla', info: 'Tabla' },
  { label: 'tabla2', info: 'Tabla (alt)' },
  { label: 'tablex', info: 'Tabla (extended)' },
  { label: 'metal', info: 'Metal hit' },
  { label: 'click', info: 'Click' },
  { label: 'tink', info: 'Tink' },
  { label: 'tok', info: 'Tok percussion' },
  { label: 'glasstap', info: 'Glass tap' },
  { label: 'pebbles', info: 'Pebble sounds' },
  // Noise & FX
  { label: 'noise', info: 'Noise' },
  { label: 'noise2', info: 'Noise variant' },
  { label: 'glitch', info: 'Glitch FX' },
  { label: 'glitch2', info: 'Glitch FX (alt)' },
  { label: 'fire', info: 'Fire sounds' },
  { label: 'insect', info: 'Insect sounds' },
  { label: 'bubble', info: 'Bubble sounds' },
  // Stabs & Hits
  { label: 'stab', info: 'Stab synth' },
  { label: 'rave', info: 'Rave stab' },
  { label: 'rave2', info: 'Rave stab (alt)' },
  { label: 'ravemono', info: 'Rave stab (mono)' },
  { label: 'hoover', info: 'Hoover synth' },
  { label: 'hit', info: 'Hit sound' },
  { label: 'blip', info: 'Blip sound' },
  { label: 'flick', info: 'Flick sound' },
  // Genres
  { label: 'house', info: 'House kit' },
  { label: 'techno', info: 'Techno sounds' },
  { label: 'jazz', info: 'Jazz kit' },
  { label: 'hardcore', info: 'Hardcore kit' },
  { label: 'gabba', info: 'Gabba kit' },
  { label: 'gabbaloud', info: 'Gabba (loud)' },
  { label: 'gabbalouder', info: 'Gabba (louder!)' },
  { label: 'jungle', info: 'Jungle kit' },
  { label: 'industrial', info: 'Industrial sounds' },
  // Voice & Vocal
  { label: 'mouth', info: 'Mouth sounds' },
  { label: 'yeah', info: 'Yeah vocal' },
  { label: 'auto', info: 'Auto-tune vocal' },
  { label: 'moan', info: 'Vocal moan' },
  { label: 'hmm', info: 'Hmm vocal' },
  { label: 'speechless', info: 'Speechless vocal' },
  { label: 'diphone', info: 'Diphone speech' },
  { label: 'diphone2', info: 'Diphone speech (alt)' },
  { label: 'numbers', info: 'Spoken numbers' },
  { label: 'alphabet', info: 'Spoken alphabet' },
  // Nature & Ambient
  { label: 'space', info: 'Space sounds' },
  { label: 'wind', info: 'Wind sounds' },
  { label: 'birds', info: 'Bird sounds' },
  { label: 'birds3', info: 'Bird sounds (alt)' },
  { label: 'breath', info: 'Breath sounds' },
  { label: 'outdoor', info: 'Outdoor ambience' },
  { label: 'crow', info: 'Crow sounds' },
  // Other
  { label: 'future', info: 'Future sounds' },
  { label: 'invaders', info: 'Space Invaders' },
  { label: 'circus', info: 'Circus sounds' },
  { label: 'toys', info: 'Toy sounds' },
  { label: 'kurt', info: 'Kurt vocal samples' },
  { label: 'xmas', info: 'Christmas sounds' },
  { label: 'bottle', info: 'Bottle sounds' },
  { label: 'can', info: 'Can sounds' },
  { label: 'lighter', info: 'Lighter click' },
  { label: 'print', info: 'Printer sounds' },
].map((s) => ({ ...s, type: 'text' as const }))

// Synth oscillators (always available, not samples)
export const synthOscillators: Completion[] = [
  { label: 'sawtooth', type: 'keyword', info: '\u26a1 Saw wave oscillator' },
  { label: 'square', type: 'keyword', info: '\u26a1 Square wave oscillator' },
  { label: 'triangle', type: 'keyword', info: '\u26a1 Triangle wave oscillator' },
  { label: 'sine', type: 'keyword', info: '\u26a1 Sine wave oscillator' },
]

// ═══════════════════════════════════════════════════════════════
// Dynamic Sample Registry — populated at runtime from loaded banks
// ═══════════════════════════════════════════════════════════════
let dynamicSampleCompletions: Completion[] | null = null

/** Called by the engine after sample banks are loaded to register all available sample names */
export function registerDynamicSamples(names: string[]): void {
  const existing = new Set(CORE_DIRT_SAMPLES.map((c) => c.label))
  const synthNames = new Set(synthOscillators.map((c) => c.label))
  const newSamples: Completion[] = names
    .filter((n) => !existing.has(n) && !synthNames.has(n) && n.length > 0)
    .sort()
    .map((name) => ({ label: name, type: 'text' as const, info: `\ud83c\udf10 ${name}` }))

  dynamicSampleCompletions = [...CORE_DIRT_SAMPLES, ...newSamples, ...synthOscillators]
  console.log(`[Autocomplete] Registered ${newSamples.length} community samples (${dynamicSampleCompletions.length} total)`)
}

/** Get sample completions \u2014 dynamic if available, static fallback otherwise */
export function getSampleCompletions(): Completion[] {
  return dynamicSampleCompletions ?? [...CORE_DIRT_SAMPLES, ...synthOscillators]
}

// Sample banks
export const bankCompletions: Completion[] = [
  'RolandTR808', 'RolandTR909', 'RolandTR707', 'RolandTR606', 'RolandTR505',
  'RolandTR727', 'RolandCompurhythm78', 'LinnDrum', 'LinnLM1', 'AkaiMPC60',
  'EmuSP12', 'BossDR110', 'OberheimDMX',
].map((name) => ({ label: name, type: 'text', detail: 'bank' }))
