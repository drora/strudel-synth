import type { TrackRole } from './types'

const DRUM_PATTERNS = [
  's("bd sd [~ bd] sd")',
  's("bd [~ bd] sd ~")',
  's("bd*4")',
  's("bd ~ bd ~ bd ~ bd ~")',
  's("bd [bd bd] sd bd")',
  's("[bd bd] sd [bd ~] sd")',
  's("bd sd:2 [~ bd] cp")',
]

const HIHAT_PATTERNS = [
  's("hh*8").gain("0.8 0.5 0.9 0.5 0.7 0.4 0.8 0.5")',
  's("hh*16").gain(0.3)',
  's("[hh oh] hh hh hh").gain(0.5)',
  's("hh hh oh hh hh hh oh hh").gain(0.4)',
  's("~ hh ~ hh").gain(0.6)',
  's("hh(5,8)").gain(0.5)',
]

const BASS_NOTES = ['c2', 'c#2', 'd2', 'eb2', 'e2', 'f2', 'f#2', 'g2', 'ab2', 'a2', 'bb2', 'b2']
const LEAD_NOTES = ['c4', 'c#4', 'd4', 'eb4', 'e4', 'f4', 'f#4', 'g4', 'ab4', 'a4', 'bb4', 'b4']
const PAD_CHORDS = [
  '[c3,eb3,g3]', '[f3,ab3,c4]', '[eb3,g3,bb3]', '[ab3,c4,eb4]',
  '[d3,f3,a3]', '[g3,bb3,d4]', '[c3,e3,g3]', '[a3,c4,e4]',
]

const SYNTHS = ['sawtooth', 'square', 'triangle', 'sine']
const EFFECTS_SNIPPETS = [
  '.lpf(800)', '.lpf(1200)', '.lpf(500).lpq(8)', '.hpf(200)',
  '.room(0.3)', '.room(0.5)', '.delay(0.25).delaytime(0.125)',
  '.shape(0.3)', '', '',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function generateBassLine(): string {
  const notes = pickN(BASS_NOTES, 4).join(' ~ ').replace(/ ~ $/, '')
  const pattern = `"${notes}"`
  const synth = pick(SYNTHS)
  const fx = pick(EFFECTS_SNIPPETS)
  return `note(${pattern}).sound("${synth}").lpf(${300 + Math.floor(Math.random() * 700)})${fx}`
}

function generateLeadLine(): string {
  const notes = pickN(LEAD_NOTES, 4).join(' ')
  const synth = pick(SYNTHS)
  const fx = pick(EFFECTS_SNIPPETS)
  return `note("<${notes}>*2").sound("${synth}")${fx}`
}

function generatePadChord(): string {
  const chords = pickN(PAD_CHORDS, 2).join(' ')
  const synth = pick(['sine', 'triangle'])
  return `note("<${chords}>").sound("${synth}").room(${(0.3 + Math.random() * 0.5).toFixed(1)}).gain(0.3)`
}

function generateArp(): string {
  const notes = pickN(LEAD_NOTES.map(n => n.replace('4', '3')), 4).join(' ')
  return `note("<${notes}>*${pick([4, 8])}").sound("${pick(SYNTHS)}").delay(0.5).delaytime(0.125)`
}

export function reshuffleTrack(role: TrackRole, currentCode: string): string {
  switch (role) {
    case 'drums':
      return pick(DRUM_PATTERNS)
    case 'hihats':
      return pick(HIHAT_PATTERNS)
    case 'bass':
      return generateBassLine()
    case 'lead':
      return generateLeadLine()
    case 'pad':
      return generatePadChord()
    case 'arp':
      return generateArp()
    case 'fx':
      return `s("${pick(['cp', 'rim', 'cb', 'perc'])} ${pick(['~', 'rim', 'cp'])}").room(${(0.3 + Math.random() * 0.4).toFixed(1)})`
    default:
      return currentCode
  }
}
