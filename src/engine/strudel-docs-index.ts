/**
 * Small offline index of Strudel docs snippets for WebMCP search_strudel_docs.
 * Prefer get_reference for the full in-app API; this points at official docs URLs.
 */

export type DocsSnippet = {
  id: string
  title: string
  url: string
  tags: string[]
  snippet: string
}

export const STRUDEL_DOCS_INDEX: DocsSnippet[] = [
  {
    id: 'mini-notation',
    title: 'Mini-notation basics',
    url: 'https://strudel.cc/learn/mini-notation/',
    tags: ['mini', 'notation', 'pattern', 'sequence', 'rest', 'stack'],
    snippet: `Mini-notation lives inside double-quoted strings: s("bd sd hh cp").
Spaces separate events in a cycle. ~ is a rest. [] subdivide; {} / <> for Euclidean / alternating.
*n repeats; /n slows. , stacks voices: s("bd*4, hh*8"). Use get_reference for full mini-notation.`,
  },
  {
    id: 'samples-banks',
    title: 'Samples and banks',
    url: 'https://strudel.cc/learn/samples/',
    tags: ['samples', 'bank', 'drums', 'bd', 'sd', 'hh', 'n', 'tidal'],
    snippet: `Default drum abbreviations: bd sd hh oh cp rim cr rd ht mt lt.
Use .bank("RolandTR909") to prefix tidal drum-machine names.
.n(0) selects sample variant. Match Jam kit drumsBank when editing.
Also: samples('github:tidalcycles/dirt-samples'). Prefer get_samples for banks in this app.`,
  },
  {
    id: 'effects',
    title: 'Audio effects',
    url: 'https://strudel.cc/learn/effects/',
    tags: ['effects', 'lpf', 'hpf', 'room', 'delay', 'gain', 'shape', 'pan'],
    snippet: `Chain effects: s("bd*4").lpf(800).room(0.4).delay(0.25).
Common: lpf/hpf (+ lpq/hpq), room (+ roomsize/size), delay (+ delaytime/delayfeedback),
gain, shape, crush, pan, speed, attack/decay/sustain/release.
Jam set_fx writes scalar .key(value); patterned args need Code sheet.`,
  },
  {
    id: 'first-effects',
    title: 'First effects workshop',
    url: 'https://strudel.cc/workshop/first-effects/',
    tags: ['workshop', 'lpf', 'vowel', 'delay', 'room', 'signals', 'range'],
    snippet: `note("c2 c3").sound("sawtooth").lpf(800)
s("hh*16").gain("[.25 1]*4")
Modulation: s("hh*16").lpf(saw.range(500, 2000))
Signals: sine saw square tri rand perlin + .range(min,max) / .slow(n).`,
  },
  {
    id: 'synths',
    title: 'Synths and notes',
    url: 'https://strudel.cc/learn/synths/',
    tags: ['synth', 'note', 'sound', 'sawtooth', 'square', 'fm', 'scale'],
    snippet: `note("c3 eb3 g3").sound("sawtooth") or .s("triangle")
.scale("C:minor") with n("0 2 4 7") for scale degrees.
FM: .fm(4).fmh(1). Prefer get_scales_and_chords for scale/chord names.`,
  },
  {
    id: 'code-syntax',
    title: 'Coding syntax',
    url: 'https://strudel.cc/learn/code/',
    tags: ['javascript', 'chain', 'register', 'string', 'mini'],
    snippet: `Strudel chains methods: note("a3 c4").s("piano").room(0.5)
Double quotes = mini-notation patterns; single quotes = plain strings (e.g. 'C minor').
register('name', fn) creates reusable chained helpers.`,
  },
  {
    id: 'signals',
    title: 'Continuous signals',
    url: 'https://strudel.cc/learn/signals/',
    tags: ['signals', 'sine', 'saw', 'rand', 'perlin', 'lfo'],
    snippet: `Continuous signals modulate parameters: gain(sine), lpf(perlin.range(200,2000))
sine2/saw2 etc. range -1..1. irand / brand for discrete-ish randomness.`,
  },
  {
    id: 'time-span',
    title: 'Time and structure',
    url: 'https://strudel.cc/learn/time-spans/',
    tags: ['slow', 'fast', 'early', 'late', 'rev', 'jux', 'every'],
    snippet: `.slow(2) / .fast(2) change pattern tempo vs global cps.
.every(4, rev), .jux(rev), .early(0.1), .late(0.1)
In Jam prefer update_track with quantization "1" or "2" over hush/stop.`,
  },
  {
    id: 'cpm-cps',
    title: 'Tempo CPS / CPM',
    url: 'https://strudel.cc/learn/factories/',
    tags: ['bpm', 'cps', 'cpm', 'tempo', 'setcps'],
    snippet: `Strudel uses cycles-per-second: cps = bpm/60/4 for 4/4 with one cycle = 4 beats.
Jam set_bpm updates store and recomposes while playing — prefer that over bare setcps.`,
  },
  {
    id: 'pattern-effects',
    title: 'Pattern modifiers',
    url: 'https://strudel.cc/learn/effects/',
    tags: ['rev', 'palindrome', 'iter', 'chunk', 'off', 'euclid'],
    snippet: `Structural: .rev() .palindrome() .iter(n) .chunk(n,fn) .off(n,fn)
Euclidean: s("bd(3,8)") or .euclid(3,8). Keep one change per liveloop turn.`,
  },
]

/** Simple keyword search over the offline docs index. */
export function searchStrudelDocs(query: string, limit = 5): DocsSnippet[] {
  const q = query.trim().toLowerCase()
  if (!q) return STRUDEL_DOCS_INDEX.slice(0, limit)
  const terms = q.split(/\s+/).filter(Boolean)
  const scored = STRUDEL_DOCS_INDEX.map((doc) => {
    const hay = [doc.title, doc.snippet, ...doc.tags, doc.url].join(' ').toLowerCase()
    let score = 0
    for (const t of terms) {
      if (hay.includes(t)) score += 2
      if (doc.tags.some((tag) => tag.includes(t) || t.includes(tag))) score += 3
      if (doc.title.toLowerCase().includes(t)) score += 4
    }
    return { doc, score }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc)
}
