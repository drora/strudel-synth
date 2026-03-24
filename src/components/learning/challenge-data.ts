export interface Challenge {
  id: string
  title: string
  description: string
  starterCode: string
  hint: string
  validate: (code: string) => boolean
  xp: number
}

export interface Level {
  id: number
  title: string
  description: string
  challenges: Challenge[]
}

const LEVEL_1: Challenge[] = [
  {
    id: '1-1',
    title: 'Make Some Noise',
    description: 'Press Ctrl+Enter (or Cmd+Enter) to play this pattern. Then change "bd" to "sd" and press again.',
    starterCode: 's("bd")',
    hint: 'Replace bd with sd to hear a snare drum',
    validate: (code) => code.includes('sd'),
    xp: 10,
  },
  {
    id: '1-2',
    title: 'Build a Beat',
    description: 'Create a pattern with at least 4 sounds separated by spaces.',
    starterCode: 's("bd sd")',
    hint: 'Try s("bd sd hh cp") for a basic beat',
    validate: (code) => {
      const match = code.match(/s\("([^"]+)"\)/)
      return match ? match[1].split(/\s+/).length >= 4 : false
    },
    xp: 15,
  },
  {
    id: '1-3',
    title: 'Speed It Up',
    description: 'Use * to repeat a sound. Make the hi-hat play 8 times per cycle.',
    starterCode: 's("bd sd hh cp")',
    hint: 'Change hh to hh*8',
    validate: (code) => /\*\d/.test(code),
    xp: 20,
  },
  {
    id: '1-4',
    title: 'Add Silence',
    description: 'Use ~ for rests. Create a pattern with at least one rest.',
    starterCode: 's("bd sd bd sd")',
    hint: 'Try s("bd ~ sd ~") for a more interesting rhythm',
    validate: (code) => code.includes('~'),
    xp: 15,
  },
]

const LEVEL_2: Challenge[] = [
  {
    id: '2-1',
    title: 'Play Notes',
    description: 'Use note() to play pitched sounds. Play a C major arpeggio.',
    starterCode: 'note("c3 e3 g3 c4").sound("triangle")',
    hint: 'Just press play to hear it, then try changing the notes',
    validate: (code) => code.includes('note('),
    xp: 20,
  },
  {
    id: '2-2',
    title: 'Add an Effect',
    description: 'Add .lpf() (low-pass filter) to your pattern. Try values between 200-2000.',
    starterCode: 'note("c3 e3 g3 c4").sound("sawtooth")',
    hint: 'Add .lpf(800) after .sound("sawtooth")',
    validate: (code) => code.includes('.lpf('),
    xp: 20,
  },
  {
    id: '2-3',
    title: 'Add Reverb',
    description: 'Add .room() for reverb. Try values from 0 to 1.',
    starterCode: 'note("c3 e3 g3 c4").sound("triangle")',
    hint: '.room(0.5) adds medium reverb',
    validate: (code) => code.includes('.room('),
    xp: 15,
  },
  {
    id: '2-4',
    title: 'Alternate Patterns',
    description: 'Use <angle brackets> to alternate between values each cycle.',
    starterCode: 's("bd sd hh cp")',
    hint: 'Try note("<c3 e3 g3 b3>") to play one note per cycle',
    validate: (code) => code.includes('<') && code.includes('>'),
    xp: 25,
  },
]

const LEVEL_3: Challenge[] = [
  {
    id: '3-1',
    title: 'Stack Patterns',
    description: 'Use stack() to layer multiple patterns together.',
    starterCode: 's("bd sd bd sd")',
    hint: 'stack(s("bd sd"), s("hh*8").gain(0.3))',
    validate: (code) => code.includes('stack('),
    xp: 25,
  },
  {
    id: '3-2',
    title: 'Pattern Modifiers',
    description: 'Use .every(n, fn) to apply a transformation every n cycles.',
    starterCode: 's("bd sd [~ bd] sd").bank("RolandTR808")',
    hint: 'Add .every(4, fast(2)) at the end',
    validate: (code) => code.includes('.every('),
    xp: 30,
  },
  {
    id: '3-3',
    title: 'Create a Full Track',
    description: 'Build a complete piece using stack() with at least 3 layers: drums, bass, and melody.',
    starterCode: '// Build your track here!\nsilence',
    hint: 'stack(\n  s("bd sd [~ bd] sd"),\n  note("c2 ~ c2 eb2").sound("sawtooth").lpf(500),\n  note("<c4 eb4 g4 bb4>").sound("triangle").room(0.5)\n)',
    validate: (code) => code.includes('stack(') && code.includes('note(') && code.includes('s('),
    xp: 50,
  },
]

export const LEVELS: Level[] = [
  { id: 1, title: 'First Sounds', description: 'Learn the basics of patterns and samples', challenges: LEVEL_1 },
  { id: 2, title: 'Notes & Effects', description: 'Pitched sounds, filters, and reverb', challenges: LEVEL_2 },
  { id: 3, title: 'Composition', description: 'Stack patterns and create full tracks', challenges: LEVEL_3 },
]
