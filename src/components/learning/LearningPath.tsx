import { useState, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'

interface Challenge {
  id: string
  title: string
  description: string
  starterCode: string
  hint: string
  validate: (code: string) => boolean
  xp: number
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

const LEVELS = [
  { id: 1, title: 'Level 1: First Sounds', description: 'Learn the basics of patterns and samples', challenges: LEVEL_1 },
  { id: 2, title: 'Level 2: Notes & Effects', description: 'Pitched sounds, filters, and reverb', challenges: LEVEL_2 },
  { id: 3, title: 'Level 3: Composition', description: 'Stack patterns and create full tracks', challenges: LEVEL_3 },
]

export function LearningPath() {
  const [activeLevel, setActiveLevel] = useState(0)
  const [activeChallenge, setActiveChallenge] = useState(0)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [showHint, setShowHint] = useState(false)
  const addTrack = useSessionStore((s) => s.addTrack)

  const level = LEVELS[activeLevel]
  const challenge = level.challenges[activeChallenge]
  const xpTotal = Array.from(completed).reduce((sum, id) => {
    for (const l of LEVELS) {
      const c = l.challenges.find((ch) => ch.id === id)
      if (c) return sum + c.xp
    }
    return sum
  }, 0)

  const startChallenge = useCallback(() => {
    addTrack({
      name: `Challenge ${challenge.id}`,
      role: 'custom',
      code: challenge.starterCode,
      color: '#a78bfa',
      muted: false,
      soloed: false,
      locked: false,
      volume: 1,
      error: null,
    })
  }, [challenge, addTrack])

  const checkSolution = useCallback(() => {
    const state = useSessionStore.getState()
    const activeTrack = state.tracks.find((t) => t.id === state.activeTrackId)
    if (!activeTrack) return

    if (challenge.validate(activeTrack.code)) {
      setCompleted((prev) => new Set(prev).add(challenge.id))
      // Auto-advance
      if (activeChallenge < level.challenges.length - 1) {
        setActiveChallenge((i) => i + 1)
      } else if (activeLevel < LEVELS.length - 1) {
        setActiveLevel((i) => i + 1)
        setActiveChallenge(0)
      }
      setShowHint(false)
    }
  }, [challenge, activeChallenge, activeLevel, level.challenges.length])

  return (
    <div className="flex flex-col h-full">
      {/* XP bar */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-accent font-medium">{xpTotal} XP</span>
          <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${Math.min(100, (xpTotal / 250) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Level tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border">
        {LEVELS.map((l, i) => (
          <button
            key={l.id}
            onClick={() => { setActiveLevel(i); setActiveChallenge(0); setShowHint(false) }}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              i === activeLevel ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            Level {l.id}
          </button>
        ))}
      </div>

      {/* Challenge list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <h3 className="text-xs font-medium text-text mb-1">{level.title}</h3>
        <p className="text-[10px] text-text-muted mb-3">{level.description}</p>

        {level.challenges.map((c, i) => (
          <div
            key={c.id}
            className={`mb-2 p-2 rounded border transition-colors cursor-pointer ${
              i === activeChallenge
                ? 'border-accent bg-accent/5'
                : completed.has(c.id)
                ? 'border-success/30 bg-success/5'
                : 'border-border hover:border-border'
            }`}
            onClick={() => { setActiveChallenge(i); setShowHint(false) }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px]">
                {completed.has(c.id) ? '✅' : i === activeChallenge ? '▶' : '○'}
              </span>
              <span className="text-xs text-text">{c.title}</span>
              <span className="text-[9px] text-accent ml-auto">{c.xp} XP</span>
            </div>
          </div>
        ))}
      </div>

      {/* Active challenge details */}
      <div className="px-3 py-3 border-t border-border bg-bg-elevated/50">
        <p className="text-xs text-text mb-2">{challenge.description}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={startChallenge}
            className="px-2 py-1 text-[10px] bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
          >
            Start
          </button>
          <button
            onClick={checkSolution}
            className="px-2 py-1 text-[10px] bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
          >
            Check
          </button>
          <button
            onClick={() => setShowHint((v) => !v)}
            className="px-2 py-1 text-[10px] text-text-muted hover:text-text transition-colors"
          >
            Hint
          </button>
        </div>
        {showHint && (
          <p className="text-[10px] text-accent/80 mt-2 font-mono bg-bg-elevated p-2 rounded">
            {challenge.hint}
          </p>
        )}
      </div>
    </div>
  )
}
