import type { Completion } from '@codemirror/autocomplete'

// ===============================================================
// Top-level Function Completions
// ===============================================================
export const strudelGlobalCompletions: Completion[] = [
  { label: 's', type: 'function', detail: '(pattern)', info: 'Play samples. s("bd sd hh cp")' },
  { label: 'note', type: 'function', detail: '(pattern)', info: 'Play notes. note("c3 e3 g3 b3")' },
  { label: 'sound', type: 'function', detail: '(pattern)', info: 'Synth oscillator. sound("sawtooth")' },
  { label: 'stack', type: 'function', detail: '(...pats)', info: 'Layer patterns. stack(s("bd"), s("hh"))' },
  { label: 'cat', type: 'function', detail: '(...pats)', info: 'Sequence over cycles. cat(s("bd"), s("sd"))' },
  { label: 'sequence', type: 'function', detail: '(...pats)', info: 'Sequence patterns.' },
  { label: 'fastcat', type: 'function', detail: '(...pats)', info: 'Fast sequence (1 cycle). fastcat(s("bd"), s("sd"))' },
  { label: 'slowcat', type: 'function', detail: '(...pats)', info: 'Slow alternating. slowcat(s("bd"), s("sd"))' },
  { label: 'polymeter', type: 'function', detail: '(...pats)', info: 'Polymetric overlay. polymeter(s("bd sd"), s("hh hh hh"))' },
  { label: 'polyrhythm', type: 'function', detail: '(...pats)', info: 'Polyrhythmic overlay.' },
  { label: 'silence', type: 'variable', info: 'Empty pattern (silence)' },
  { label: 'sine', type: 'variable', info: 'Sine wave signal (0-1)' },
  { label: 'cosine', type: 'variable', info: 'Cosine wave signal (0-1)' },
  { label: 'saw', type: 'variable', info: 'Sawtooth wave signal (0-1)' },
  { label: 'isaw', type: 'variable', info: 'Inverse sawtooth signal (1-0)' },
  { label: 'square', type: 'variable', info: 'Square wave signal (0 or 1)' },
  { label: 'tri', type: 'variable', info: 'Triangle wave signal (0-1)' },
  { label: 'perlin', type: 'variable', info: 'Perlin noise signal' },
  { label: 'rand', type: 'variable', info: 'Random value per cycle' },
  { label: 'irand', type: 'function', detail: '(max)', info: 'Random int 0-max. irand(8)' },
  { label: 'run', type: 'function', detail: '(n)', info: 'Sequence 0..n-1. run(8)' },
  { label: 'samples', type: 'function', detail: '(url)', info: 'Load sample bank. samples("github:...")' },
  { label: 'setcps', type: 'function', detail: '(cps)', info: 'Set cycles per second. setcps(0.5)' },
  { label: 'hush', type: 'function', detail: '()', info: 'Stop all sound immediately' },
  { label: 'slider', type: 'function', detail: '(val, min, max)', info: 'Inline slider control. slider(0.5, 0, 1)' },
]

// ===============================================================
// Scale Name Completions (inside .scale("..."))
// ===============================================================
export const scaleCompletions: Completion[] = [
  // Standard modes
  'major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian',
  'ionian',
  // Pentatonic & blues
  'pentatonic', 'minor pentatonic', 'blues', 'major blues',
  // Other common
  'chromatic', 'whole tone', 'diminished', 'augmented',
  // Harmonic & melodic
  'harmonic minor', 'harmonic major', 'melodic minor',
  // Jazz & extended
  'bebop', 'bebop major', 'bebop minor', 'bebop dominant',
  'lydian dominant', 'altered', 'super locrian',
  // World
  'hungarian minor', 'hungarian major', 'spanish', 'phrygian dominant',
  'double harmonic', 'enigmatic', 'neapolitan major', 'neapolitan minor',
  'persian', 'arabic', 'japanese', 'hirajoshi', 'kumoi', 'iwato',
  // Modes of melodic minor
  'dorian b2', 'lydian augmented', 'lydian dominant', 'mixolydian b6',
  'locrian natural 2', 'super locrian',
  // Symmetrical
  'whole-half', 'half-whole',
].map((name) => ({ label: name, type: 'text', info: `Scale: ${name}` }))

// ===============================================================
// Chord Name Completions (inside .chord("..."))
// ===============================================================
export const chordCompletions: Completion[] = [
  // Triads
  { label: 'major', info: 'Major triad (1 3 5)' },
  { label: 'minor', info: 'Minor triad (1 b3 5)' },
  { label: 'aug', info: 'Augmented (1 3 #5)' },
  { label: 'dim', info: 'Diminished (1 b3 b5)' },
  { label: 'sus4', info: 'Suspended 4th (1 4 5)' },
  { label: 'sus2', info: 'Suspended 2nd (1 2 5)' },
  // Sevenths
  { label: '7', info: 'Dominant 7th (1 3 5 b7)' },
  { label: 'M7', info: 'Major 7th (1 3 5 7)' },
  { label: 'm7', info: 'Minor 7th (1 b3 5 b7)' },
  { label: 'dim7', info: 'Diminished 7th (1 b3 b5 bb7)' },
  { label: 'm7b5', info: 'Half-dim / minor 7 flat 5 (1 b3 b5 b7)' },
  { label: 'aug7', info: 'Augmented 7th (1 3 #5 b7)' },
  { label: 'mM7', info: 'Minor-major 7th (1 b3 5 7)' },
  // Extended
  { label: '9', info: 'Dominant 9th (1 3 5 b7 9)' },
  { label: 'M9', info: 'Major 9th (1 3 5 7 9)' },
  { label: 'm9', info: 'Minor 9th (1 b3 5 b7 9)' },
  { label: '11', info: 'Dominant 11th' },
  { label: 'M11', info: 'Major 11th' },
  { label: 'm11', info: 'Minor 11th' },
  { label: '13', info: 'Dominant 13th' },
  { label: 'M13', info: 'Major 13th' },
  { label: 'm13', info: 'Minor 13th' },
  // Other
  { label: '6', info: 'Major 6th (1 3 5 6)' },
  { label: 'm6', info: 'Minor 6th (1 b3 5 6)' },
  { label: 'add9', info: 'Add 9 (1 3 5 9)' },
  { label: 'madd9', info: 'Minor add 9 (1 b3 5 9)' },
  { label: '7sus4', info: 'Dominant 7 sus4 (1 4 5 b7)' },
  { label: 'power', info: 'Power chord (1 5)' },
].map((c) => ({ ...c, type: 'text' as const }))

// ===============================================================
// Mini-notation Snippet Completions (inside quotes)
// ===============================================================
export const miniNotationCompletions: Completion[] = [
  { label: '~', type: 'keyword', info: 'Rest / silence' },
  { label: '*', type: 'keyword', detail: 'n', info: 'Repeat: "bd*4" plays bd 4 times per cycle' },
  { label: '/', type: 'keyword', detail: 'n', info: 'Slow down: "bd/2" plays every 2 cycles' },
  { label: '!', type: 'keyword', detail: 'n', info: 'Replicate: "bd!3" = "bd bd bd"' },
  { label: '@', type: 'keyword', detail: 'n', info: 'Elongate: "bd@3 sd" gives bd 3/4 time' },
  { label: '?', type: 'keyword', info: 'Degrade: "bd?" randomly drops event (50%)' },
  { label: '[ ]', type: 'keyword', info: 'Group: "[bd sd] hh" fits bd+sd in one slot' },
  { label: '< >', type: 'keyword', info: 'Alternate: "<bd sd cp>" cycles through each' },
  { label: ',', type: 'keyword', info: 'Stack: "[bd, hh]" plays both at same time' },
  { label: '( , )', type: 'keyword', detail: 'k,n', info: 'Euclidean: "bd(3,8)" distributes 3 in 8 slots' },
  { label: '( , , )', type: 'keyword', detail: 'k,n,r', info: 'Euclidean + rotation: "bd(3,8,1)"' },
  { label: ':', type: 'keyword', detail: 'n', info: 'Sample index: "bd:2" uses 3rd bass drum' },
]
