import type { Completion } from '@codemirror/autocomplete'

// ═══════════════════════════════════════════════════════════════
// Strudel Method Completions (triggered after `.`)
// ═══════════════════════════════════════════════════════════════
export const strudelMethodCompletions: Completion[] = [
  // ──── Effects: Filter ────
  { label: 'lpf', type: 'method', detail: '(freq)', info: 'Low-pass filter. lpf(800)' },
  { label: 'hpf', type: 'method', detail: '(freq)', info: 'High-pass filter. hpf(200)' },
  { label: 'bpf', type: 'method', detail: '(freq)', info: 'Band-pass filter. bpf(1000)' },
  { label: 'lpq', type: 'method', detail: '(q)', info: 'Filter resonance. lpq(8)' },
  { label: 'hpq', type: 'method', detail: '(q)', info: 'High-pass resonance. hpq(4)' },
  { label: 'bpq', type: 'method', detail: '(q)', info: 'Band-pass resonance. bpq(4)' },
  { label: 'vowel', type: 'method', detail: '(v)', info: 'Vowel filter. vowel("a e i o u")' },
  { label: 'djf', type: 'method', detail: '(amt)', info: 'DJ filter 0–1 (0.5=off). djf(0.3)' },
  { label: 'lpenv', type: 'method', detail: '(depth)', info: 'Filter envelope depth. lpenv(4)' },
  { label: 'lpa', type: 'method', detail: '(t)', info: 'Filter envelope attack. lpa(0.01)' },
  { label: 'lpd', type: 'method', detail: '(t)', info: 'Filter envelope decay. lpd(0.2)' },
  { label: 'lps', type: 'method', detail: '(l)', info: 'Filter envelope sustain. lps(0.3)' },
  { label: 'lpr', type: 'method', detail: '(t)', info: 'Filter envelope release. lpr(0.5)' },

  // ──── Effects: Amplitude ────
  { label: 'gain', type: 'method', detail: '(amp)', info: 'Volume 0–1.5. gain(0.8)' },
  { label: 'pan', type: 'method', detail: '(pos)', info: 'Stereo pan 0–1. pan(sine)' },
  { label: 'velocity', type: 'method', detail: '(v)', info: 'Note velocity 0–1. velocity(0.7)' },
  { label: 'orbit', type: 'method', detail: '(n)', info: 'Effects bus. orbit(1)' },

  // ──── Effects: Space ────
  { label: 'room', type: 'method', detail: '(size)', info: 'Reverb wet. room(0.5)' },
  { label: 'roomsize', type: 'method', detail: '(s)', info: 'Reverb room size. roomsize(2)' },
  { label: 'roomfade', type: 'method', detail: '(t)', info: 'Reverb fade time. roomfade(0.5)' },
  { label: 'roomlp', type: 'method', detail: '(freq)', info: 'Reverb low-pass. roomlp(8000)' },
  { label: 'roomdim', type: 'method', detail: '(amt)', info: 'Reverb dampening. roomdim(0.5)' },
  { label: 'delay', type: 'method', detail: '(wet)', info: 'Delay amount. delay(0.3)' },
  { label: 'delaytime', type: 'method', detail: '(t)', info: 'Delay time. delaytime(0.125)' },
  { label: 'delayfeedback', type: 'method', detail: '(fb)', info: 'Delay feedback. delayfeedback(0.5)' },

  // ──── Effects: Distortion ────
  { label: 'shape', type: 'method', detail: '(amt)', info: 'Waveshaping 0–1. shape(0.5)' },
  { label: 'distort', type: 'method', detail: '(amt)', info: 'Distortion. distort(0.3)' },
  { label: 'crush', type: 'method', detail: '(bits)', info: 'Bitcrusher. crush(4)' },
  { label: 'coarse', type: 'method', detail: '(rate)', info: 'Downsample. coarse(8)' },

  // ──── Effects: Modulation ────
  { label: 'phaser', type: 'method', detail: '(depth)', info: 'Phaser depth. phaser(0.5)' },
  { label: 'phaserdepth', type: 'method', detail: '(d)', info: 'Phaser depth. phaserdepth(0.5)' },
  { label: 'phaserrate', type: 'method', detail: '(r)', info: 'Phaser rate. phaserrate(0.3)' },
  { label: 'phasersweep', type: 'method', detail: '(s)', info: 'Phaser sweep. phasersweep(0.5)' },
  { label: 'phasercenter', type: 'method', detail: '(f)', info: 'Phaser center freq. phasercenter(1000)' },
  { label: 'tremolo', type: 'method', detail: '(depth)', info: 'Tremolo depth. tremolo(0.5)' },

  // ──── FM Synthesis ────
  { label: 'fm', type: 'method', detail: '(index)', info: 'FM modulation index 0–20. fm(4)' },
  { label: 'fmh', type: 'method', detail: '(ratio)', info: 'FM harmonicity 0.01–16. fmh(2)' },
  { label: 'fmattack', type: 'method', detail: '(t)', info: 'FM envelope attack. fmattack(0.01)' },
  { label: 'fmdecay', type: 'method', detail: '(t)', info: 'FM envelope decay. fmdecay(0.2)' },
  { label: 'fmsustain', type: 'method', detail: '(l)', info: 'FM envelope sustain. fmsustain(0.5)' },
  { label: 'fmenv', type: 'method', detail: '(type)', info: 'FM envelope type. fmenv("adsr")' },

  // ──── Sample Playback ────
  { label: 'begin', type: 'method', detail: '(pos)', info: 'Sample start 0–1. begin(0.25)' },
  { label: 'end', type: 'method', detail: '(pos)', info: 'Sample end 0–1. end(0.75)' },
  { label: 'speed', type: 'method', detail: '(rate)', info: 'Playback speed. speed(2), speed(-1)' },
  { label: 'unit', type: 'method', detail: '(u)', info: 'Speed unit: "r"=rate "c"=cycle "s"=seconds. unit("c")' },
  { label: 'cut', type: 'method', detail: '(group)', info: 'Cut group (choke). cut(1)' },
  { label: 'loop', type: 'method', detail: '(n)', info: 'Loop sample. loop(1)' },
  { label: 'loopAt', type: 'method', detail: '(n)', info: 'Fit sample to n cycles. loopAt(2)' },
  { label: 'clip', type: 'method', detail: '(n)', info: 'Clip event duration. clip(0.5)' },
  { label: 'legato', type: 'method', detail: '(n)', info: 'Legato factor. legato(0.5)' },

  // ──── Pattern Modifiers: Speed ────
  { label: 'fast', type: 'method', detail: '(factor)', info: 'Speed up. fast(2)' },
  { label: 'slow', type: 'method', detail: '(factor)', info: 'Slow down. slow(2)' },
  { label: 'hurry', type: 'method', detail: '(factor)', info: 'Speed + pitch. hurry(2)' },
  { label: 'fastGap', type: 'method', detail: '(factor)', info: 'Speed up with gap. fastGap(2)' },

  // ──── Pattern Modifiers: Transform ────
  { label: 'rev', type: 'method', detail: '()', info: 'Reverse. rev()' },
  { label: 'palindrome', type: 'method', detail: '()', info: 'Play forward then back. palindrome()' },
  { label: 'jux', type: 'method', detail: '(fn)', info: 'Apply fn to right ear. jux(rev)' },
  { label: 'chunk', type: 'method', detail: '(n, fn)', info: 'Apply fn to one chunk. chunk(4, rev)' },
  { label: 'superimpose', type: 'method', detail: '(fn)', info: 'Layer original + modified. superimpose(fast(2))' },
  { label: 'layer', type: 'method', detail: '(...fns)', info: 'Apply multiple fns. layer(fast(2), rev)' },

  // ──── Pattern Modifiers: Conditional ────
  { label: 'every', type: 'method', detail: '(n, fn)', info: 'Apply fn every n cycles. every(4, fast(2))' },
  { label: 'sometimes', type: 'method', detail: '(fn)', info: '50% chance. sometimes(rev)' },
  { label: 'rarely', type: 'method', detail: '(fn)', info: '10% chance. rarely(fast(2))' },
  { label: 'often', type: 'method', detail: '(fn)', info: '75% chance. often(rev)' },
  { label: 'almostNever', type: 'method', detail: '(fn)', info: '2.5% chance. almostNever(rev)' },
  { label: 'almostAlways', type: 'method', detail: '(fn)', info: '97.5% chance. almostAlways(rev)' },
  { label: 'someCycles', type: 'method', detail: '(fn)', info: 'Whole cycle 50%. someCycles(rev)' },
  { label: 'when', type: 'method', detail: '(cond, fn)', info: 'Conditional apply. when(sine.gt(0.5), rev)' },
  { label: 'while', type: 'method', detail: '(pat)', info: 'Apply while pattern is true. while("1 0 1 0")' },

  // ──── Pattern Modifiers: Structure ────
  { label: 'struct', type: 'method', detail: '(pat)', info: 'Apply rhythmic structure. struct("x ~ x ~")' },
  { label: 'mask', type: 'method', detail: '(pat)', info: 'Boolean mask. mask("1 0 1 1")' },
  { label: 'euclid', type: 'method', detail: '(k, n)', info: 'Euclidean rhythm. euclid(3, 8)' },
  { label: 'ply', type: 'method', detail: '(n)', info: 'Repeat each event. ply(2)' },
  { label: 'striate', type: 'method', detail: '(n)', info: 'Granular slice. striate(8)' },
  { label: 'chop', type: 'method', detail: '(n)', info: 'Chop into slices. chop(16)' },
  { label: 'slice', type: 'method', detail: '(n, pat)', info: 'Slice playback. slice(8, "0 1 3 2 7")' },
  { label: 'splice', type: 'method', detail: '(n, pat)', info: 'Splice (pitched). splice(8, "0 3 1 2")' },
  { label: 'range', type: 'method', detail: '(lo, hi)', info: 'Scale 0-1 to range. range(200, 2000)' },
  { label: 'segment', type: 'method', detail: '(n)', info: 'Discretize. segment(16)' },
  { label: 'degrade', type: 'method', detail: '()', info: 'Randomly drop events. degrade()' },
  { label: 'degradeBy', type: 'method', detail: '(prob)', info: 'Drop by probability. degradeBy(0.5)' },
  { label: 'undegrade', type: 'method', detail: '()', info: 'Undegraded. undegrade()' },

  // ──── Time ────
  { label: 'early', type: 'method', detail: '(t)', info: 'Shift earlier. early(0.25)' },
  { label: 'late', type: 'method', detail: '(t)', info: 'Shift later. late(0.25)' },
  { label: 'off', type: 'method', detail: '(t, fn)', info: 'Offset copy. off(0.125, add(note(7)))' },
  { label: 'press', type: 'method', detail: '()', info: 'Syncopate (shift by half). press()' },
  { label: 'swing', type: 'method', detail: '(amt)', info: 'Swing feel. swing(0.5)' },

  // ──── Tonal ────
  { label: 'note', type: 'method', detail: '(pat)', info: 'Set pitch. note("c3 e3 g3")' },
  { label: 'scale', type: 'method', detail: '(name)', info: 'Set scale. scale("C:minor")' },
  { label: 'chord', type: 'method', detail: '(name)', info: 'Play chord. chord("minor")' },
  { label: 'voicing', type: 'method', detail: '()', info: 'Auto voice chords. voicing()' },
  { label: 'add', type: 'method', detail: '(pat)', info: 'Add to values. add(note(7))' },
  { label: 'sub', type: 'method', detail: '(pat)', info: 'Subtract from values. sub(note(2))' },
  { label: 'transpose', type: 'method', detail: '(n)', info: 'Transpose semitones. transpose(7)' },

  // ──── Sound Source ────
  { label: 's', type: 'method', detail: '(name)', info: 'Sample name. s("bd"), s("pluck")' },
  { label: 'sound', type: 'method', detail: '(name)', info: 'Synth. sound("sawtooth"), sound("sine")' },
  { label: 'bank', type: 'method', detail: '(name)', info: 'Sample bank. bank("RolandTR808")' },
  { label: 'n', type: 'method', detail: '(num)', info: 'Sample number. n("0 1 2 3")' },

  // ──── Envelope ────
  { label: 'attack', type: 'method', detail: '(t)', info: 'Attack time. attack(0.01)' },
  { label: 'decay', type: 'method', detail: '(t)', info: 'Decay time. decay(0.1)' },
  { label: 'sustain', type: 'method', detail: '(l)', info: 'Sustain level. sustain(0.8)' },
  { label: 'release', type: 'method', detail: '(t)', info: 'Release time. release(0.5)' },

  // ──── Visualization ────
  { label: 'color', type: 'method', detail: '(c)', info: 'Set pianoroll color. color("red")' },
  { label: 'pianoroll', type: 'method', detail: '(opts?)', info: 'Show pianoroll. pianoroll()' },
  { label: 'scope', type: 'method', detail: '(opts?)', info: 'Show oscilloscope. scope()' },
  { label: 'spectrum', type: 'method', detail: '(opts?)', info: 'Show spectrum. spectrum()' },

  // ──── Inline Control ────
  { label: 'slider', type: 'function', detail: '(val, min, max)', info: 'Inline slider. slider(0.5, 0, 1)' },
]

// ═══════════════════════════════════════════════════════════════
// Top-level Function Completions
// ═══════════════════════════════════════════════════════════════
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
  { label: 'sine', type: 'variable', info: 'Sine wave signal (0–1)' },
  { label: 'cosine', type: 'variable', info: 'Cosine wave signal (0–1)' },
  { label: 'saw', type: 'variable', info: 'Sawtooth wave signal (0–1)' },
  { label: 'isaw', type: 'variable', info: 'Inverse sawtooth signal (1–0)' },
  { label: 'square', type: 'variable', info: 'Square wave signal (0 or 1)' },
  { label: 'tri', type: 'variable', info: 'Triangle wave signal (0–1)' },
  { label: 'perlin', type: 'variable', info: 'Perlin noise signal' },
  { label: 'rand', type: 'variable', info: 'Random value per cycle' },
  { label: 'irand', type: 'function', detail: '(max)', info: 'Random int 0–max. irand(8)' },
  { label: 'run', type: 'function', detail: '(n)', info: 'Sequence 0..n-1. run(8)' },
  { label: 'samples', type: 'function', detail: '(url)', info: 'Load sample bank. samples("github:...")' },
  { label: 'setcps', type: 'function', detail: '(cps)', info: 'Set cycles per second. setcps(0.5)' },
  { label: 'hush', type: 'function', detail: '()', info: 'Stop all sound immediately' },
  { label: 'slider', type: 'function', detail: '(val, min, max)', info: 'Inline slider control. slider(0.5, 0, 1)' },
]

// ═══════════════════════════════════════════════════════════════
// Scale Name Completions (inside .scale("..."))
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// Chord Name Completions (inside .chord("..."))
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// Mini-notation Snippet Completions (inside quotes)
// ═══════════════════════════════════════════════════════════════
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
  { label: 'sawtooth', type: 'keyword', info: '⚡ Saw wave oscillator' },
  { label: 'square', type: 'keyword', info: '⚡ Square wave oscillator' },
  { label: 'triangle', type: 'keyword', info: '⚡ Triangle wave oscillator' },
  { label: 'sine', type: 'keyword', info: '⚡ Sine wave oscillator' },
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
    .map((name) => ({ label: name, type: 'text' as const, info: `🌐 ${name}` }))

  dynamicSampleCompletions = [...CORE_DIRT_SAMPLES, ...newSamples, ...synthOscillators]
  console.log(`[Autocomplete] Registered ${newSamples.length} community samples (${dynamicSampleCompletions.length} total)`)
}

/** Get sample completions — dynamic if available, static fallback otherwise */
export function getSampleCompletions(): Completion[] {
  return dynamicSampleCompletions ?? [...CORE_DIRT_SAMPLES, ...synthOscillators]
}

// Sample banks
export const bankCompletions: Completion[] = [
  'RolandTR808', 'RolandTR909', 'RolandCR78', 'AkaiLinn',
].map((name) => ({ label: name, type: 'text', info: `Bank: ${name}` }))
