import { useState, useCallback, useEffect } from 'react'
import { CodePane } from '../editor/CodePane'
import { LEVELS } from './challenge-data'
import type { Challenge, Level } from './challenge-data'
import { evaluateCode, initEngine, stop } from '../../engine/strudel'
import { resumeAudioContext } from '../../engine/audio-context'
import { useUIStore } from '../../store/ui-store'

const LS_KEY = 'strudel-learn-progress'

function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveProgress(completed: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...completed]))
}

export function LearnShell() {
  const [activeLevelIdx, setActiveLevelIdx] = useState(0)
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0)
  const [completed, setCompleted] = useState<Set<string>>(loadProgress)
  const [code, setCode] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [feedback, setFeedback] = useState<'success' | 'fail' | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const level: Level = LEVELS[activeLevelIdx]
  const challenge: Challenge = level.challenges[activeChallengeIdx]

  // Load starter code when challenge changes
  useEffect(() => {
    setCode(challenge.starterCode)
    setShowHint(false)
    setFeedback(null)
  }, [challenge.id])

  // XP total
  const xpTotal = Array.from(completed).reduce((sum, id) => {
    for (const l of LEVELS) {
      const c = l.challenges.find((ch) => ch.id === id)
      if (c) return sum + c.xp
    }
    return sum
  }, 0)

  const handlePlay = useCallback(async () => {
    try {
      await resumeAudioContext()
      await initEngine()
      await evaluateCode(code)
      setIsPlaying(true)
    } catch (err) {
      console.error('Learn play error:', err)
    }
  }, [code])

  const handleStop = useCallback(async () => {
    await stop()
    setIsPlaying(false)
  }, [])

  const handleCheck = useCallback(() => {
    if (challenge.validate(code)) {
      setFeedback('success')
      setCompleted((prev) => {
        const next = new Set(prev).add(challenge.id)
        saveProgress(next)
        return next
      })
    } else {
      setFeedback('fail')
    }
  }, [code, challenge])

  const handleNext = useCallback(() => {
    if (activeChallengeIdx < level.challenges.length - 1) {
      setActiveChallengeIdx((i) => i + 1)
    } else if (activeLevelIdx < LEVELS.length - 1) {
      setActiveLevelIdx((i) => i + 1)
      setActiveChallengeIdx(0)
    }
    setFeedback(null)
  }, [activeChallengeIdx, activeLevelIdx, level.challenges.length])

  const selectChallenge = useCallback((levelIdx: number, challengeIdx: number) => {
    setActiveLevelIdx(levelIdx)
    setActiveChallengeIdx(challengeIdx)
    setFeedback(null)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        await handlePlay()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        await handleStop()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handlePlay, handleStop])

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Challenge list */}
        <div className="w-64 min-w-64 bg-bg-surface border-r border-border flex flex-col">
          {/* XP header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text">Learn Strudel</span>
              <span className="text-xs text-accent font-semibold">{xpTotal} XP</span>
            </div>
            <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (xpTotal / 250) * 100)}%` }}
              />
            </div>
          </div>

          {/* Level / challenge tree */}
          <div className="flex-1 overflow-y-auto py-2">
            {LEVELS.map((l, li) => {
              const levelCompleted = l.challenges.every((c) => completed.has(c.id))
              return (
                <div key={l.id} className="mb-1">
                  <div className="px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">
                      {levelCompleted ? '★' : `L${l.id}`}
                    </span>
                    <span className="text-xs font-medium text-text">{l.title}</span>
                  </div>
                  {l.challenges.map((c, ci) => {
                    const isActive = li === activeLevelIdx && ci === activeChallengeIdx
                    const isDone = completed.has(c.id)
                    return (
                      <button
                        key={c.id}
                        onClick={() => selectChallenge(li, ci)}
                        className={`w-full text-left px-4 py-2 pl-8 text-xs transition-colors ${
                          isActive
                            ? 'bg-accent/10 text-accent border-l-2 border-accent'
                            : isDone
                            ? 'text-success/70 hover:bg-bg-elevated'
                            : 'text-text-muted hover:bg-bg-elevated hover:text-text'
                        }`}
                      >
                        <span className="mr-2">{isDone ? '✓' : '○'}</span>
                        {c.title}
                        <span className="float-right text-[10px] opacity-60">{c.xp} XP</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Center: Code editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <CodePane
              learnMode
              learnCode={code}
              onLearnCodeChange={setCode}
            />
          </div>
        </div>

        {/* Right: Instructions */}
        <div className="w-72 min-w-72 bg-bg-surface border-l border-border flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Challenge</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <h2 className="text-lg font-semibold text-text mb-1">{challenge.title}</h2>
            <p className="text-xs text-accent mb-4">{level.title} — {challenge.xp} XP</p>
            <p className="text-sm text-text-muted leading-relaxed mb-4">{challenge.description}</p>

            {/* Hint toggle */}
            <button
              onClick={() => setShowHint((v) => !v)}
              className="text-xs text-text-muted hover:text-accent transition-colors mb-2"
            >
              {showHint ? '▼ Hide hint' : '▶ Show hint'}
            </button>
            {showHint && (
              <div className="bg-bg-elevated border border-border rounded p-3 mb-4">
                <code className="text-xs text-accent/80 font-mono whitespace-pre-wrap">{challenge.hint}</code>
              </div>
            )}

            {/* Feedback */}
            {feedback === 'success' && (
              <div className="bg-success/10 border border-success/30 rounded p-3 mb-4">
                <p className="text-sm text-success font-medium">Correct! +{challenge.xp} XP</p>
                <button
                  onClick={handleNext}
                  className="mt-2 px-3 py-1 text-xs bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
                >
                  Next challenge →
                </button>
              </div>
            )}
            {feedback === 'fail' && (
              <div className="bg-error/10 border border-error/30 rounded p-3 mb-4">
                <p className="text-sm text-error">Not quite right. Check the hint and try again.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simplified transport */}
      <div className="h-14 bg-bg-surface border-t border-border flex items-center px-4 gap-3">
        {/* Play/Stop */}
        <button
          onClick={isPlaying ? handleStop : handlePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isPlaying
              ? 'bg-error/20 text-error hover:bg-error/30'
              : 'bg-accent/20 text-accent hover:bg-accent/30'
          }`}
        >
          {isPlaying ? '■' : '▶'}
        </button>

        {/* Check solution */}
        <button
          onClick={handleCheck}
          className="px-4 py-2 text-xs font-medium bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
        >
          Check Solution
        </button>

        <div className="flex-1" />

        {/* XP display */}
        <span className="text-xs text-accent font-semibold">{xpTotal} XP</span>

        {/* Back to Studio */}
        <button
          onClick={() => useUIStore.getState().setAppMode('studio')}
          className="px-3 py-1.5 text-xs text-text-muted hover:text-text bg-bg-elevated rounded transition-colors"
        >
          Back to Studio
        </button>
      </div>
    </div>
  )
}
