import { useState } from 'react'

const DOCS_SECTIONS = [
  {
    id: 'mini',
    title: 'Mini-Notation',
    content: [
      { name: '"a b c"', desc: 'Sequence events equally within one cycle' },
      { name: '"a*n"', desc: 'Repeat event n times within its time slot' },
      { name: '"[a b]"', desc: 'Group — subdivide the time slot equally' },
      { name: '"<a b c>"', desc: 'Alternate — play one per cycle' },
      { name: '"~"', desc: 'Rest — silence for that time slot' },
      { name: '"a,b"', desc: 'Stack — play both simultaneously' },
      { name: '"a/n"', desc: 'Slow — stretch over n cycles' },
      { name: '"a@n"', desc: 'Elongate — take n units of time' },
      { name: '"a!n"', desc: 'Replicate — repeat without subdivision' },
      { name: '"a?"', desc: 'Degrade — randomly play or skip' },
      { name: '"a(k,n)"', desc: 'Euclidean — distribute k hits over n steps' },
    ],
  },
  {
    id: 'sounds',
    title: 'Sounds',
    content: [
      { name: 's("bd sd")', desc: 'Play samples by name' },
      { name: 'note("c3 e3")', desc: 'Play pitched notes' },
      { name: 'sound("sawtooth")', desc: 'Synth oscillator (sawtooth, square, triangle, sine)' },
      { name: '.bank("RolandTR808")', desc: 'Select sample bank' },
      { name: '.n("0 1 2")', desc: 'Select sample number within a set' },
      { name: 'stack(a, b)', desc: 'Layer multiple patterns simultaneously' },
      { name: 'cat(a, b)', desc: 'Sequence patterns one after another' },
    ],
  },
  {
    id: 'effects',
    title: 'Effects',
    content: [
      { name: '.lpf(freq)', desc: 'Low-pass filter (20-20000). Try 800 for warmth.' },
      { name: '.hpf(freq)', desc: 'High-pass filter. Try 200 to remove mud.' },
      { name: '.lpq(q)', desc: 'Filter resonance (0-50). Try 8 for acid.' },
      { name: '.gain(n)', desc: 'Volume (0-1.5). Default 1.' },
      { name: '.pan(n)', desc: 'Stereo position (0=left, 0.5=center, 1=right)' },
      { name: '.room(n)', desc: 'Reverb wet (0-1). Try 0.3 for subtle.' },
      { name: '.delay(n)', desc: 'Delay wet (0-1). Try 0.25.' },
      { name: '.delaytime(n)', desc: 'Delay time in cycles. 0.125 = 1/8 note.' },
      { name: '.shape(n)', desc: 'Waveshaper distortion (0-1). Try 0.3.' },
      { name: '.crush(n)', desc: 'Bitcrusher (1-16 bits). Try 4 for lo-fi.' },
      { name: '.attack(n)', desc: 'Attack time in seconds. 0.01 for sharp.' },
      { name: '.release(n)', desc: 'Release time in seconds. 0.1 for short.' },
    ],
  },
  {
    id: 'patterns',
    title: 'Pattern Modifiers',
    content: [
      { name: '.fast(n)', desc: 'Speed up by factor n' },
      { name: '.slow(n)', desc: 'Slow down by factor n' },
      { name: '.rev()', desc: 'Reverse the pattern' },
      { name: '.jux(fn)', desc: 'Apply fn to right stereo channel only' },
      { name: '.every(n, fn)', desc: 'Apply fn every n cycles' },
      { name: '.sometimes(fn)', desc: 'Apply fn 50% of the time' },
      { name: '.struct("x ~ x ~")', desc: 'Apply rhythmic boolean mask' },
      { name: '.chop(n)', desc: 'Slice sample into n granules' },
      { name: '.off(t, fn)', desc: 'Add offset copy with transformation' },
      { name: '.early(t) / .late(t)', desc: 'Shift pattern in time' },
    ],
  },
  {
    id: 'tonal',
    title: 'Scales & Chords',
    content: [
      { name: '.scale("C:minor")', desc: 'Map pattern to scale' },
      { name: '.chord("minor")', desc: 'Play chord' },
      { name: '.voicing()', desc: 'Automatic chord voicing' },
      { name: 'Scales', desc: 'major, minor, dorian, phrygian, lydian, mixolydian, pentatonic, blues, chromatic' },
      { name: 'Chords', desc: 'major, minor, dim, aug, 7, maj7, min7, sus2, sus4' },
    ],
  },
  {
    id: 'signals',
    title: 'Signals',
    content: [
      { name: 'sine', desc: 'Smooth oscillation 0→1→0 per cycle' },
      { name: 'saw', desc: 'Linear ramp 0→1 per cycle' },
      { name: 'square', desc: 'Alternates 0 and 1' },
      { name: 'tri', desc: 'Triangle wave 0→1→0 per cycle' },
      { name: 'perlin', desc: 'Smooth random (Perlin noise)' },
      { name: 'rand', desc: 'Random value each event' },
      { name: 'Usage', desc: '.lpf(sine.range(200, 2000)) — animate filter' },
    ],
  },
]

export function DocsPanel() {
  const [activeSection, setActiveSection] = useState('mini')
  const [searchQuery, setSearchQuery] = useState('')

  const section = DOCS_SECTIONS.find((s) => s.id === activeSection)

  const filteredContent = section?.content.filter(
    (item) =>
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
        {DOCS_SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => { setActiveSection(s.id); setSearchQuery('') }}
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
        {filteredContent?.map((item) => (
          <div key={item.name} className="mb-2 pb-2 border-b border-border/30">
            <code className="text-xs text-accent font-mono">{item.name}</code>
            <p className="text-[11px] text-text-muted mt-0.5">{item.desc}</p>
          </div>
        ))}
        {filteredContent?.length === 0 && (
          <p className="text-xs text-text-muted">No results found.</p>
        )}
      </div>
    </div>
  )
}
