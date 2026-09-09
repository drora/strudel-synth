/**
 * Learn curriculum + smarter validators (Phase 4).
 *
 * Validators prefer call-site / method regex and optional @strudel/mini parse
 * of mini-notation string bodies — not bare `includes()` that comments can fake.
 * No audio target-diff engine.
 */

export interface Challenge {
  id: string
  title: string
  description: string
  starterCode: string
  hint: string
  validate: (code: string) => boolean
  xp: number
  /** Soft hint for Apply → Studio track role */
  studioRole?: 'drums' | 'hihats' | 'bass' | 'lead' | 'pad' | 'arp' | 'fx' | 'vox' | 'custom'
}

export interface Level {
  id: number
  title: string
  description: string
  challenges: Challenge[]
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Drop line and block comments so `// sd` cannot satisfy a check. */
export function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
}

/** True if `name(` appears as a call (not `foo.name(` property without paren edge). */
export function hasFn(code: string, name: string): boolean {
  const c = stripComments(code)
  return new RegExp(`(?:^|[^\\w$.])${name}\\s*\\(`).test(c)
}

/** True if `.name(` method call is present. */
export function hasMethod(code: string, name: string): boolean {
  const c = stripComments(code)
  return new RegExp(`\\.${name}\\s*\\(`).test(c)
}

/** Extract string literal bodies after known mini call sites. */
export function extractMiniBodies(
  code: string,
  calls: string[] = ['s', 'note', 'sound', 'n', 'struct'],
): string[] {
  const c = stripComments(code)
  const callAlt = calls.map(escapeRegExp).join('|')
  const re = new RegExp(
    `(?:^|[^\\w$.])(?:${callAlt})\\s*\\(\\s*(["'\`])([\\s\\S]*?)\\1`,
    'g',
  )
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(c)) !== null) {
    out.push(m[2])
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Bracket balance for mini bodies (always-on fallback). */
export function miniBracketsOk(body: string): boolean {
  const pairs: [string, string][] = [
    ['[', ']'],
    ['<', '>'],
    ['(', ')'],
  ]
  for (const [open, close] of pairs) {
    let depth = 0
    for (const ch of body) {
      if (ch === open) depth++
      else if (ch === close) depth--
      if (depth < 0) return false
    }
    if (depth !== 0) return false
  }
  return true
}

type MiniParse = (code: string) => unknown
let mini2astFn: MiniParse | null | undefined

/** Lazy @strudel/mini — same pattern as Phase 1 linter. */
async function ensureMini(): Promise<MiniParse | null> {
  if (mini2astFn !== undefined) return mini2astFn
  try {
    const mod = await import('@strudel/mini')
    mini2astFn = (mod.mini2ast ?? mod.parse) as MiniParse
  } catch {
    mini2astFn = null
  }
  return mini2astFn
}

void ensureMini()

/**
 * Mini body is structurally ok: bracket balance always; mini2ast when loaded.
 * If mini not ready yet, brackets alone pass (same soft stance as linter first paint).
 */
export function miniBodyOk(body: string): boolean {
  if (!miniBracketsOk(body)) return false
  const parse = mini2astFn
  if (!parse) return true
  try {
    parse(body)
    return true
  } catch {
    return false
  }
}

/** All extracted mini bodies for given calls must parse/balance. */
export function allMiniOk(
  code: string,
  calls: string[] = ['s', 'note', 'n', 'struct'],
): boolean {
  const bodies = extractMiniBodies(code, calls)
  if (bodies.length === 0) return false
  return bodies.every(miniBodyOk)
}

/** Token appears as a mini atom (word boundary), not only in a comment. */
export function miniHasToken(code: string, token: string, calls?: string[]): boolean {
  const bodies = extractMiniBodies(code, calls)
  const re = new RegExp(`(?:^|[^\\w])${escapeRegExp(token)}(?:$|[^\\w])`)
  return bodies.some((b) => re.test(b) && miniBodyOk(b))
}

/** Count whitespace-separated atoms in first matching call's mini string. */
export function miniAtomCount(code: string, call = 's'): number {
  const bodies = extractMiniBodies(code, [call])
  if (!bodies[0]) return 0
  return bodies[0]
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0).length
}

/** Angle-bracket alternate `<...>` inside a mini string. */
export function miniHasAngles(code: string): boolean {
  return extractMiniBodies(code).some(
    (b) => /<[^>]+>/.test(b) && miniBodyOk(b),
  )
}

/** Multiply op `*digits` inside a mini string. */
export function miniHasRepeat(code: string): boolean {
  return extractMiniBodies(code).some((b) => /\*\d+/.test(b) && miniBodyOk(b))
}

/** Rest `~` as a mini atom. */
export function miniHasRest(code: string): boolean {
  return extractMiniBodies(code).some(
    (b) => /(?:^|[\s\[(<,|])~(?:$|[\s\])>,|])/.test(b) && miniBodyOk(b),
  )
}

// ---------------------------------------------------------------------------
// Levels (tightened copy; Level 4 = Lock / Update bridge → Studio)
// ---------------------------------------------------------------------------

const LEVEL_1: Challenge[] = [
  {
    id: '1-1',
    title: 'Snare Swap',
    description:
      'Play the starter, then put a snare (`sd`) inside `s("…")`. Comments alone do not count.',
    starterCode: 's("bd")',
    hint: 's("sd")',
    validate: (code) => hasFn(code, 's') && miniHasToken(code, 'sd', ['s']) && allMiniOk(code, ['s']),
    xp: 10,
    studioRole: 'drums',
  },
  {
    id: '1-2',
    title: 'Four-Hit Beat',
    description: 'Write an `s("…")` pattern with at least four space-separated hits.',
    starterCode: 's("bd sd")',
    hint: 's("bd sd hh cp")',
    validate: (code) =>
      hasFn(code, 's') && miniAtomCount(code, 's') >= 4 && allMiniOk(code, ['s']),
    xp: 15,
    studioRole: 'drums',
  },
  {
    id: '1-3',
    title: 'Hats ×8',
    description: 'Speed a sound with `*` inside mini-notation (e.g. `hh*8`).',
    starterCode: 's("bd sd hh cp")',
    hint: 's("bd sd hh*8 cp")',
    validate: (code) => hasFn(code, 's') && miniHasRepeat(code) && allMiniOk(code, ['s']),
    xp: 20,
    studioRole: 'hihats',
  },
  {
    id: '1-4',
    title: 'Rest on the Two',
    description: 'Insert a rest `~` as a real mini atom (not only in a comment).',
    starterCode: 's("bd sd bd sd")',
    hint: 's("bd ~ sd ~")',
    validate: (code) => hasFn(code, 's') && miniHasRest(code) && allMiniOk(code, ['s']),
    xp: 15,
    studioRole: 'drums',
  },
]

const LEVEL_2: Challenge[] = [
  {
    id: '2-1',
    title: 'Note Arpeggio',
    description: 'Call `note("…")` with a pitched mini string. Optional: chain `.sound(...)`.',
    starterCode: 'note("c3 e3 g3 c4").sound("triangle")',
    hint: 'Keep note("…"); try different pitches',
    validate: (code) =>
      hasFn(code, 'note') &&
      extractMiniBodies(code, ['note']).some((b) => /[a-g]/i.test(b) && miniBodyOk(b)),
    xp: 20,
    studioRole: 'lead',
  },
  {
    id: '2-2',
    title: 'Low-Pass Filter',
    description: 'Chain a real `.lpf(` call (method form), not a comment mentioning lpf.',
    starterCode: 'note("c3 e3 g3 c4").sound("sawtooth")',
    hint: '….sound("sawtooth").lpf(800)',
    validate: (code) => hasFn(code, 'note') && hasMethod(code, 'lpf'),
    xp: 20,
    studioRole: 'bass',
  },
  {
    id: '2-3',
    title: 'Room Reverb',
    description: 'Chain `.room(` for space.',
    starterCode: 'note("c3 e3 g3 c4").sound("triangle")',
    hint: '….room(0.5)',
    validate: (code) => hasFn(code, 'note') && hasMethod(code, 'room'),
    xp: 15,
    studioRole: 'pad',
  },
  {
    id: '2-4',
    title: 'One-Per-Cycle',
    description: 'Use `<…>` angle brackets inside a mini string to alternate each cycle.',
    starterCode: 's("bd sd hh cp")',
    hint: 'note("<c3 e3 g3 b3>")',
    validate: (code) => miniHasAngles(code),
    xp: 25,
    studioRole: 'lead',
  },
]

const LEVEL_3: Challenge[] = [
  {
    id: '3-1',
    title: 'Stack Layers',
    description: 'Call `stack(` with at least two patterned arguments (two `s`/`note` calls).',
    starterCode: 's("bd sd bd sd")',
    hint: 'stack(s("bd sd"), s("hh*8").gain(0.3))',
    validate: (code) => {
      if (!hasFn(code, 'stack')) return false
      // Need stack + ≥2 mini sites OR stack with s+note
      const miniSites = extractMiniBodies(code, ['s', 'note', 'n']).length
      return miniSites >= 2 || (hasFn(code, 's') && hasFn(code, 'note'))
    },
    xp: 25,
    studioRole: 'custom',
  },
  {
    id: '3-2',
    title: 'Every-N Transform',
    description: 'Apply `.every(` so a transform fires every n cycles.',
    starterCode: 's("bd sd [~ bd] sd").bank("RolandTR808")',
    hint: '….every(4, fast(2))',
    validate: (code) => hasFn(code, 's') && hasMethod(code, 'every') && allMiniOk(code, ['s']),
    xp: 30,
    studioRole: 'drums',
  },
  {
    id: '3-3',
    title: 'Mini Arrangement',
    description:
      'Build `stack(` with drums (`s`) and pitched (`note`) layers — a tiny Studio-ready scene.',
    starterCode: '// Build your track here!\nsilence',
    hint:
      'stack(\n  s("bd sd [~ bd] sd"),\n  note("c2 ~ c2 eb2").sound("sawtooth").lpf(500),\n  note("<c4 eb4 g4 bb4>").sound("triangle").room(0.5)\n)',
    validate: (code) =>
      hasFn(code, 'stack') &&
      hasFn(code, 's') &&
      hasFn(code, 'note') &&
      extractMiniBodies(code, ['s', 'note']).length >= 2 &&
      allMiniOk(code, ['s', 'note']),
    xp: 50,
    studioRole: 'custom',
  },
]

/** Level 4 bridges Learn → Studio Lock / Update (code checks + Apply CTA). */
const LEVEL_4: Challenge[] = [
  {
    id: '4-1',
    title: 'Ready for Update',
    description:
      'Write a solid drum line you’ll hot-swap in Studio. Then Check, and use Apply to Studio — press Update (or Ctrl+Enter) on the one.',
    starterCode: 's("bd sd bd sd")',
    hint: 's("bd [~ bd] sd [bd ~]").bank("RolandTR808")',
    validate: (code) =>
      hasFn(code, 's') &&
      miniAtomCount(code, 's') >= 3 &&
      allMiniOk(code, ['s']) &&
      // encourage a real edit vs untouched starter
      stripComments(code).replace(/\s+/g, ' ').trim() !== 's("bd sd bd sd")',
    xp: 25,
    studioRole: 'drums',
  },
  {
    id: '4-2',
    title: 'Lock-Friendly Knob',
    description:
      'Add a numeric `.lpf(` you can tweak under Lock. Apply to Studio, enable Lock, drag/edit — changes land on the cycle.',
    starterCode: 'note("c2 ~ eb2 ~ g2 ~").sound("sawtooth")',
    hint: '….sound("sawtooth").lpf(600)',
    validate: (code) => {
      if (!hasFn(code, 'note') || !hasMethod(code, 'lpf')) return false
      const c = stripComments(code)
      // Require a numeric (or slider) arg — not an empty .lpf()
      return /\.lpf\s*\(\s*[\d.]/.test(c)
    },
    xp: 30,
    studioRole: 'bass',
  },
  {
    id: '4-3',
    title: 'Signal Sweep',
    description:
      'Automate with a signal, e.g. `.lpf(sine.range(200,4000).slow(8))`. Apply to Studio and jam under Lock.',
    starterCode: 'note("<c3 eb3 g3 bb3>*2").sound("square").room(0.2)',
    hint: '….lpf(sine.range(200, 4000).slow(8))',
    validate: (code) => {
      const c = stripComments(code)
      const hasSignal =
        /(?:^|[^\w$.])(?:sine|saw|tri|square|perlin|rand)\b/.test(c) ||
        /\.range\s*\(/.test(c)
      return hasFn(code, 'note') && hasMethod(code, 'lpf') && hasSignal
    },
    xp: 35,
    studioRole: 'lead',
  },
]

export const LEVELS: Level[] = [
  {
    id: 1,
    title: 'First Sounds',
    description: 'Samples, rests, and `*` — the mini alphabet',
    challenges: LEVEL_1,
  },
  {
    id: 2,
    title: 'Notes & Effects',
    description: '`note`, filters, reverb, and `<…>`',
    challenges: LEVEL_2,
  },
  {
    id: 3,
    title: 'Composition',
    description: '`stack`, `.every`, and a mini arrangement',
    challenges: LEVEL_3,
  },
  {
    id: 4,
    title: 'Live Edit',
    description: 'Graduate to Studio: Update, Lock, and signals',
    challenges: LEVEL_4,
  },
]

/** Sum of all challenge XP — use for progress bar max. */
export const XP_MAX = LEVELS.reduce(
  (sum, level) => sum + level.challenges.reduce((s, c) => s + c.xp, 0),
  0,
)
