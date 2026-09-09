import { useEffect, useMemo, useState } from 'react'
import {
  subscribeCursorDocs,
  type CursorDocsContext,
} from '../editor/cursor-docs'

const DOCS_SECTIONS = [
  {
    id: 'mini',
    title: 'Mini-Notation',
    content: [
      { name: '"a b c"', desc: 'Sequence events equally within one cycle', keys: [' '] },
      { name: '"a*n"', desc: 'Repeat event n times within its time slot', keys: ['*'] },
      { name: '"[a b]"', desc: 'Group — subdivide the time slot equally', keys: ['[', ']'] },
      { name: '"<a b c>"', desc: 'Alternate — play one per cycle', keys: ['<', '>'] },
      { name: '"~"', desc: 'Rest — silence for that time slot', keys: ['~'] },
      { name: '"a,b"', desc: 'Stack — play both simultaneously', keys: [','] },
      { name: '"a/n"', desc: 'Slow — stretch over n cycles', keys: ['/'] },
      { name: '"a@n"', desc: 'Elongate — take n units of time', keys: ['@'] },
      { name: '"a!n"', desc: 'Replicate — repeat without subdivision', keys: ['!'] },
      { name: '"a?"', desc: 'Degrade — randomly play or skip', keys: ['?'] },
      { name: '"a(k,n)"', desc: 'Euclidean — distribute k hits over n steps', keys: ['(', ')'] },
    ],
  },
  {
    id: 'sounds',
    title: 'Sounds',
    content: [
      { name: 's("bd sd")', desc: 'Play samples by name', keys: ['s'] },
      { name: 'note("c3 e3")', desc: 'Play pitched notes', keys: ['note'] },
      { name: 'sound("sawtooth")', desc: 'Synth oscillator (sawtooth, square, triangle, sine)', keys: ['sound'] },
      { name: '.bank("RolandTR808")', desc: 'Select sample bank', keys: ['bank'] },
      { name: '.n("0 1 2")', desc: 'Select sample number within a set', keys: ['n'] },
      { name: 'stack(a, b)', desc: 'Layer multiple patterns simultaneously', keys: ['stack'] },
      { name: 'cat(a, b)', desc: 'Sequence patterns one after another', keys: ['cat'] },
    ],
  },
  {
    id: 'effects',
    title: 'Effects',
    content: [
      { name: '.lpf(freq)', desc: 'Low-pass filter (20-20000). Try 800 for warmth.', keys: ['lpf'] },
      { name: '.hpf(freq)', desc: 'High-pass filter. Try 200 to remove mud.', keys: ['hpf'] },
      { name: '.lpq(q)', desc: 'Filter resonance (0-50). Try 8 for acid.', keys: ['lpq'] },
      { name: '.gain(n)', desc: 'Volume (0-1.5). Default 1.', keys: ['gain'] },
      { name: '.pan(n)', desc: 'Stereo position (0=left, 0.5=center, 1=right)', keys: ['pan'] },
      { name: '.room(n)', desc: 'Reverb wet (0-1). Try 0.3 for subtle.', keys: ['room'] },
      { name: '.delay(n)', desc: 'Delay wet (0-1). Try 0.25.', keys: ['delay'] },
      { name: '.delaytime(n)', desc: 'Delay time in cycles. 0.125 = 1/8 note.', keys: ['delaytime'] },
      { name: '.shape(n)', desc: 'Waveshaper distortion (0-1). Try 0.3.', keys: ['shape'] },
      { name: '.crush(n)', desc: 'Bitcrusher (1-16 bits). Try 4 for lo-fi.', keys: ['crush'] },
      { name: '.attack(n)', desc: 'Attack time in seconds. 0.01 for sharp.', keys: ['attack'] },
      { name: '.release(n)', desc: 'Release time in seconds. 0.1 for short.', keys: ['release'] },
    ],
  },
  {
    id: 'patterns',
    title: 'Pattern Modifiers',
    content: [
      { name: '.fast(n)', desc: 'Speed up by factor n', keys: ['fast'] },
      { name: '.slow(n)', desc: 'Slow down by factor n', keys: ['slow'] },
      { name: '.rev()', desc: 'Reverse the pattern', keys: ['rev'] },
      { name: '.jux(fn)', desc: 'Apply fn to right stereo channel only', keys: ['jux'] },
      { name: '.every(n, fn)', desc: 'Apply fn every n cycles', keys: ['every'] },
      { name: '.sometimes(fn)', desc: 'Apply fn 50% of the time', keys: ['sometimes'] },
      { name: '.struct("x ~ x ~")', desc: 'Apply rhythmic boolean mask', keys: ['struct'] },
      { name: '.chop(n)', desc: 'Slice sample into n granules', keys: ['chop'] },
      { name: '.off(t, fn)', desc: 'Add offset copy with transformation', keys: ['off'] },
      { name: '.early(t) / .late(t)', desc: 'Shift pattern in time', keys: ['early', 'late'] },
    ],
  },
  {
    id: 'tonal',
    title: 'Scales & Chords',
    content: [
      { name: '.scale("C:minor")', desc: 'Map pattern to scale', keys: ['scale'] },
      { name: '.chord("minor")', desc: 'Play chord', keys: ['chord'] },
      { name: '.voicing()', desc: 'Automatic chord voicing', keys: ['voicing'] },
      { name: 'Scales', desc: 'major, minor, dorian, phrygian, lydian, mixolydian, pentatonic, blues, chromatic', keys: [] },
      { name: 'Chords', desc: 'major, minor, dim, aug, 7, maj7, min7, sus2, sus4', keys: [] },
    ],
  },
  {
    id: 'signals',
    title: 'Signals',
    content: [
      { name: 'sine', desc: 'Smooth oscillation 0→1→0 per cycle', keys: ['sine'] },
      { name: 'saw', desc: 'Linear ramp 0→1 per cycle', keys: ['saw'] },
      { name: 'square', desc: 'Alternates 0 and 1', keys: ['square'] },
      { name: 'tri', desc: 'Triangle wave 0→1→0 per cycle', keys: ['tri'] },
      { name: 'perlin', desc: 'Smooth random (Perlin noise)', keys: ['perlin'] },
      { name: 'rand', desc: 'Random value each event', keys: ['rand'] },
      { name: 'Usage', desc: '.lpf(sine.range(200, 2000)) — animate filter', keys: [] },
    ],
  },
] as const

function itemMatchesCursor(
  item: { name: string; keys: readonly string[] },
  ctx: CursorDocsContext,
): boolean {
  if (!ctx.symbol) return false
  const sym = ctx.symbol.toLowerCase()
  if (item.keys.some((k) => k.toLowerCase() === sym)) return true
  // Method docs are listed as ".lpf(freq)" — match bare symbol
  const bare = item.name.replace(/^\./, '').split('(')[0].toLowerCase()
  return bare === sym
}

export function DocsPanel() {
  const [activeSection, setActiveSection] = useState('mini')
  const [searchQuery, setSearchQuery] = useState('')
  const [cursor, setCursor] = useState<CursorDocsContext | null>(null)

  // Cursor → docs hook (see cursor-docs.ts). Optional: RightPanel can also
  // subscribe and switch the active tab to "docs" when symbol becomes non-empty.
  useEffect(() => subscribeCursorDocs(setCursor), [])

  useEffect(() => {
    if (!cursor?.sectionId) return
    if (searchQuery) return // don't yank section while user is searching
    setActiveSection(cursor.sectionId)
  }, [cursor?.sectionId, cursor?.symbol, searchQuery])

  const section = DOCS_SECTIONS.find((s) => s.id === activeSection)

  const filteredContent = useMemo(() => {
    return section?.content.filter(
      (item) =>
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [section, searchQuery])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Docs</h2>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 bg-bg-elevated border border-border rounded text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        {cursor?.symbol ? (
          <p className="mt-1.5 text-[10px] text-accent/80 truncate" title={cursor.info}>
            cursor: <code className="font-mono">{cursor.symbol}</code>
            {cursor.info ? ` — ${cursor.info}` : ''}
          </p>
        ) : null}
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
        {DOCS_SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setActiveSection(s.id)
              setSearchQuery('')
            }}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              activeSection === s.id
                ? 'bg-accent/20 text-accent'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredContent?.map((item) => {
          const active = cursor ? itemMatchesCursor(item, cursor) : false
          return (
            <div
              key={item.name}
              className={`mb-2 pb-2 border-b border-border/30 rounded px-1 -mx-1 ${
                active ? 'bg-accent/10 border-accent/30' : ''
              }`}
            >
              <code className="text-xs text-accent font-mono">{item.name}</code>
              <p className="text-[11px] text-text-muted mt-0.5">{item.desc}</p>
            </div>
          )
        })}
        {filteredContent?.length === 0 && (
          <p className="text-xs text-text-muted">No results found.</p>
        )}
      </div>
    </div>
  )
}
