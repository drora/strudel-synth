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
