/**
 * STRUDEL_REFERENCE — compiled Strudel API docs for AI agents.
 * Provided to agents via the get_reference() WebMCP tool.
 * ~15KB markdown covering all major Strudel functions.
 */
export const STRUDEL_REFERENCE = `
# Strudel API Reference

## Mini-Notation (inside double-quoted strings)
- \`"a b c d"\` — sequence events in one cycle
- \`"a*3"\` — repeat 3 times
- \`"[a b]"\` — group / subdivide
- \`"<a b c>"\` — alternate per cycle
- \`"~"\` — rest (silence)
- \`"a,b"\` — stack (play simultaneously)
- \`"a/2"\` — slow over 2 cycles
- \`"a@2 b"\` — elongate (a takes 2 time units)
- \`"a!3"\` — replicate without subdividing
- \`"a?"\` — randomly include/exclude
- \`"a(3,8)"\` — euclidean rhythm (3 hits in 8 steps)

## Sound Functions
- \`s("bd sd hh cp")\` — play samples by name
- \`note("c3 e3 g3")\` — play pitched notes
- \`sound("sawtooth")\` — oscillator (sawtooth, square, triangle, sine)
- \`.bank("RolandTR808")\` — select sample bank
- \`.n("0 1 2")\` — sample number within set

## Combining Patterns
- \`stack(pat1, pat2, ...)\` — layer simultaneously
- \`cat(pat1, pat2)\` — sequence patterns
- \`fastcat(pat1, pat2)\` — fast sequence
- \`sequence(pat1, pat2)\` — alias for cat

## Effects — Filter
- \`.lpf(freq)\` — low-pass filter (20-20000 Hz). Use 800 for warmth, 200 for deep bass.
- \`.hpf(freq)\` — high-pass filter. Use 200 to cut mud.
- \`.lpq(q)\` — filter resonance (0-50). Use 8 for acid.
- \`.vowel("a e i o u")\` — vowel filter

## Effects — Amplitude
- \`.gain(n)\` — volume (0-1.5, default 1)
- \`.velocity(n)\` — note velocity
- \`.attack(t)\` — attack time in seconds
- \`.decay(t)\` — decay time in seconds
- \`.sustain(l)\` — sustain level (0-1)
- \`.release(t)\` — release time in seconds

## Effects — Space
- \`.room(n)\` — reverb amount (0-2)
- \`.roomsize(n)\` — reverb size (0-10)
- \`.delay(n)\` — delay wet (0-1)
- \`.delaytime(t)\` — delay time in cycles (0.125 = 1/8 note)
- \`.delayfeedback(n)\` — delay feedback (0-1)

## Effects — Distortion
- \`.shape(n)\` — waveshaper (0-1)
- \`.distort(n)\` — distortion (0-10)
- \`.crush(bits)\` — bitcrusher (1-16)
- \`.coarse(n)\` — sample rate reduction

## Effects — Modulation
- \`.phaser(n)\` — phaser depth
- \`.pan(n)\` — stereo pan (0=L, 0.5=C, 1=R)
- \`.tremolo(n)\` — tremolo depth

## Pattern Modifiers
- \`.fast(n)\` — speed up by factor n
- \`.slow(n)\` — slow down by factor n
- \`.rev()\` — reverse pattern
- \`.jux(fn)\` — apply fn to right channel. Example: \`.jux(rev)\`
- \`.every(n, fn)\` — apply fn every n cycles. Example: \`.every(4, fast(2))\`
- \`.sometimes(fn)\` — apply 50% of time
- \`.rarely(fn)\` — apply 10% of time
- \`.often(fn)\` — apply 75% of time
- \`.struct("x ~ x ~")\` — apply rhythmic structure
- \`.mask("1 0 1 1")\` — boolean mask
- \`.ply(n)\` — repeat each event
- \`.chop(n)\` — slice sample into n granules
- \`.striate(n)\` — granular slice

## Time Modifiers
- \`.early(t)\` — shift earlier
- \`.late(t)\` — shift later
- \`.off(t, fn)\` — add delayed copy with transform

## Tonal
- \`.scale("C:minor")\` — map to scale
- \`.chord("minor")\` — play chord
- \`.voicing()\` — auto voice chords
- Available scales: major, minor, dorian, phrygian, lydian, mixolydian, pentatonic, blues, chromatic, harmonic minor, melodic minor

## Signals (continuous patterns)
- \`sine\` — smooth 0→1→0
- \`saw\` — ramp 0→1
- \`square\` — alternates 0/1
- \`tri\` — triangle wave
- \`perlin\` — smooth random
- \`rand\` — random per event
- Usage: \`.lpf(sine.range(200, 2000))\` to animate filter

## Samples (from dirt-samples)
- Drums: bd, sd, hh, oh, cp, rim, cb, lt, mt, ht, cr, ride, rs, hand
- Kits: house, techno, jazz, hardcore, gabba, jungle, rave
- Melodic: pluck, arpy, jvbass, juno, sax, gtr, sitar, pad
- FX: perc, tabla, metal, mouth, click, noise, space, wind, wobble, hoover, stab
- NOTE: "piano" and "guitar" are NOT valid sample names. Use gtr for guitar, pluck for plucked sounds, or use note("c3").sound("sine") for pitched synths
- Banks: RolandTR808, RolandTR909, RolandCR78
- Synth oscillators (use with sound()): sawtooth, square, triangle, sine

## FM Synthesis
- \`.fm(index)\` — modulation index (0-20)
- \`.fmh(ratio)\` — harmonicity (0.01-16)

## Sample Manipulation
- \`.loopAt(n)\` — fit sample to n cycles
- \`.clip(n)\` — clip duration
- \`.begin(n)\` / \`.end(n)\` — sample start/end (0-1)
- \`.speed(n)\` — playback speed

## Common Recipes
- Basic beat: \`s("bd sd [~ bd] sd")\`
- Hi-hat pattern: \`s("hh*8").gain("0.8 0.5 0.9 0.5")\`
- Bass line: \`note("c2 ~ c2 eb2").sound("sawtooth").lpf(500)\`
- Pad: \`note("[c3,eb3,g3]").sound("sine").room(0.8).gain(0.3)\`
- Arp: \`note("<c3 eb3 g3 bb3>*4").sound("triangle").delay(0.5)\`
- Acid: \`note("c2 c2 eb2 c2").sound("sawtooth").lpf(sine.range(200,3000)).lpq(15)\`

## Common Mistakes
- Forgetting quotes around mini-notation: \`s(bd)\` should be \`s("bd")\`
- Using single quotes: Strudel requires double quotes for mini-notation
- Unmatched brackets: \`"[a b"\` — always close \`[]\`, \`<>\`, \`()\`
- Wrong note format: Use \`c3\` not \`C3\` (lowercase)

## Role-Specific Patterns
- **Drums**: \`s("bd sd [~ bd] sd").bank("RolandTR808")\`
- **Hi-Hats**: \`s("hh*8").gain(0.3).bank("RolandTR808")\`
- **Bass**: \`note("c2 ~ c2 ~ eb2 ~ g1 ~").sound("sawtooth").lpf(500).lpq(3)\`
- **Lead**: \`note("<c4 eb4 g4 bb4>*2").sound("square").room(0.3).delay(0.2)\`
- **Pad**: \`note("[c3,eb3,g3]").sound("sine").room(0.8).gain(0.3)\`
- **Arp**: \`note("<c3 eb3 g3 bb3>*8").sound("triangle").delay(0.5).delaytime(0.125)\`
`
