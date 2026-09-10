import type { TrackRole } from './types'
import { splitEffectSuffix, getBankFromCode, setBankInCode } from './code-effects'

const DRUM_PATTERNS = [
  's("bd sd [~ bd] sd")',
  's("bd [~ bd] sd ~")',
  's("bd*4")',
  's("bd ~ bd ~ bd ~ bd ~")',
  's("bd [bd bd] sd bd")',
  's("[bd bd] sd [bd ~] sd")',
  's("bd sd:2 [~ bd] cp")',
  's("bd ~ sd bd sd ~ bd sd")',
  's("[bd ~] [bd bd] sd ~")',
  's("bd sd bd sd:2")',
  's("bd*2 sd [~ bd] [sd cp]")',
  's("bd ~ ~ sd bd bd sd ~")',
  's("[bd sd] [~ bd] [sd ~] [bd sd]")',
  's("bd sd ~ cp bd ~ sd ~")',
  's("bd*2 [~ sd] bd sd")',
  's("bd [~ ~ bd] sd [sd cp]")',
  's("<bd bd sd> <~ bd> sd cp")',
]

const HIHAT_PATTERNS = [
  's("hh*8").gain("0.8 0.5 0.9 0.5 0.7 0.4 0.8 0.5")',
  's("hh*16").gain(0.3)',
  's("[hh oh] hh hh hh").gain(0.5)',
  's("hh hh oh hh hh hh oh hh").gain(0.4)',
  's("~ hh ~ hh").gain(0.6)',
  's("hh(5,8)").gain(0.5)',
  's("hh*4 oh hh*2").gain(0.45)',
  's("[hh hh] [~ oh] hh hh").gain(0.5)',
  's("hh(3,8)").gain(0.55)',
  's("hh*8 oh*2").gain(0.4)',
  's("[~ hh] hh [hh oh] hh").gain(0.5)',
  's("hh(7,16)").gain(0.45)',
  's("oh hh*3 oh hh*3").gain(0.4)',
  's("hh*12").gain(0.28)',
]

const BASS_NOTES = [
  'c2', 'c#2', 'd2', 'eb2', 'e2', 'f2', 'f#2', 'g2', 'ab2', 'a2', 'bb2', 'b2',
  'c3', 'g1', 'f1', 'd1', 'a1', 'eb1', 'bb1',
]
const LEAD_NOTES = [
  'c4', 'c#4', 'd4', 'eb4', 'e4', 'f4', 'f#4', 'g4', 'ab4', 'a4', 'bb4', 'b4',
  'c5', 'g3', 'e5', 'd5', 'f5', 'a3', 'bb3',
]
const PAD_CHORDS = [
  '[c3,eb3,g3]', '[f3,ab3,c4]', '[eb3,g3,bb3]', '[ab3,c4,eb4]',
  '[d3,f3,a3]', '[g3,bb3,d4]', '[c3,e3,g3]', '[a3,c4,e4]',
  '[bb2,d3,f3]', '[f3,a3,c4]', '[e3,g3,b3]', '[d3,f#3,a3]',
  '[c3,f3,ab3]', '[g2,bb2,d3]', '[eb3,ab3,c4]', '[a2,c3,e3]',
]
const ARP_NOTES = [
  'c3', 'd3', 'eb3', 'f3', 'g3', 'ab3', 'a3', 'bb3', 'c4', 'd4', 'eb4', 'f4', 'g4',
]

const SYNTHS = ['sawtooth', 'square', 'triangle', 'sine', 'sawtooth', 'square']
const EFFECTS_SNIPPETS = [
  '.lpf(800)', '.lpf(1200)', '.lpf(500).lpq(8)', '.hpf(200)',
  '.lpf(2000)', '.hpf(120)', '.room(0.3)', '.room(0.5)', '.room(0.7)',
  '.delay(0.25).delaytime(0.125)', '.delay(0.4).delaytime(0.25)',
  '.shape(0.3)', '.shape(0.5)', '', '',
]

const DRUM_ROLES: TrackRole[] = ['drums', 'hihats', 'fx']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

function generateBassLine(): string {
  const count = pick([3, 4, 5])
  const notes = pickN(BASS_NOTES, count)
  const spaced = Math.random() < 0.5
    ? notes.join(' ~ ')
    : notes.join(' ')
  const synth = pick(SYNTHS)
  const fx = pick(EFFECTS_SNIPPETS)
  const gain = (0.55 + Math.random() * 0.35).toFixed(2)
  return `note("${spaced}").sound("${synth}").lpf(${250 + Math.floor(Math.random() * 900)}).gain(${gain})${fx}`
}

function generateLeadLine(): string {
  const notes = pickN(LEAD_NOTES, pick([3, 4, 5])).join(' ')
  const synth = pick(SYNTHS)
  const fx = pick(EFFECTS_SNIPPETS)
  const mul = pick(['*2', '*4', ''])
  return `note("<${notes}>${mul}").sound("${synth}")${fx}`
}

function generatePadChord(): string {
  const chords = pickN(PAD_CHORDS, pick([2, 3])).join(' ')
  const synth = pick(['sine', 'triangle', 'sawtooth'])
  const room = (0.3 + Math.random() * 0.5).toFixed(1)
  const gain = (0.22 + Math.random() * 0.2).toFixed(2)
  return `note("<${chords}>").sound("${synth}").room(${room}).gain(${gain})`
}

function generateArp(): string {
  const notes = pickN(ARP_NOTES, pick([4, 5, 6])).join(' ')
  const rate = pick([4, 6, 8])
  const synth = pick(SYNTHS)
  const fx = pick(['.delay(0.5).delaytime(0.125)', '.delay(0.35).delaytime(0.0625)', '.room(0.4)', ''])
  return `note("<${notes}>*${rate}").sound("${synth}")${fx}`
}

function generateRaw(role: TrackRole, currentCode: string, bank?: string | null): string {
  let next: string
  switch (role) {
    case 'drums':
      next = pick(DRUM_PATTERNS)
      break
    case 'hihats':
      next = pick(HIHAT_PATTERNS)
      break
    case 'bass':
      return generateBassLine()
    case 'lead':
      return generateLeadLine()
    case 'pad':
      return generatePadChord()
    case 'arp':
      return generateArp()
    case 'fx':
      next = `s("${pick(['cp', 'rim', 'cb', 'perc', 'rd'])} ${pick(['~', 'rim', 'cp', 'hh'])}").room(${(0.3 + Math.random() * 0.4).toFixed(1)})`
      break
    default:
      return currentCode
  }
  const b = bank || getBankFromCode(currentCode) || 'RolandTR909'
  if (DRUM_ROLES.includes(role)) next = setBankInCode(next, b)
  return next
}

export function reshuffleTrack(
  role: TrackRole,
  currentCode: string,
  opts?: { pinEffects?: boolean; lockKit?: boolean; bank?: string | null },
): string {
  const bank = opts?.bank ?? (opts?.lockKit ? getBankFromCode(currentCode) : getBankFromCode(currentCode))
  let next = generateRaw(role, currentCode, opts?.lockKit || opts?.bank ? bank : getBankFromCode(currentCode) ?? 'RolandTR909')
  if (opts?.pinEffects) {
    const { fx } = splitEffectSuffix(currentCode)
    if (fx) {
      const { head } = splitEffectSuffix(next)
      next = head + fx
    }
  } else if (opts?.lockKit && DRUM_ROLES.includes(role)) {
    const prevBank = getBankFromCode(currentCode)
    if (prevBank) next = setBankInCode(next, prevBank)
  }
  return next
}
