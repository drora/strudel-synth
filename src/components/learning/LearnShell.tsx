import { useState, useCallback, useEffect } from 'react'
import { CodePane } from '../editor/CodePane'
import { LEVELS, XP_MAX } from './challenge-data'
import type { Challenge, Level } from './challenge-data'
import { evaluateCode, initEngine, stop, maybeLoadCommunityBanks } from '../../engine/strudel'
import { ensureAudioUnlocked } from '../../engine/audio-context'
import { useUIStore } from '../../store/ui-store'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import { useIsMobile } from '../../hooks/useIsMobile'

const LS_KEY = 'strudel-learn-progress'

type MobileTab = 'list' | 'code' | 'goal'

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
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<MobileTab>('goal')
  const [activeLevelIdx, setActiveLevelIdx] = useState(0)
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0)
  const [completed, setCompleted] = useState<Set<string>>(loadProgress)
  const [code, setCode] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [feedback, setFeedback] = useState<'success' | 'fail' | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [appliedFlash, setAppliedFlash] = useState(false)

  const level: Level = LEVELS[activeLevelIdx]
  const challenge: Challenge = level.challenges[activeChallengeIdx]

  useEffect(() => {
    setCode(challenge.starterCode)
    setShowHint(false)
    setFeedback(null)
    setAppliedFlash(false)
  }, [challenge.id])

  const xpTotal = Array.from(completed).reduce((sum, id) => {
    for (const l of LEVELS) {
      const c = l.challenges.find((ch) => ch.id === id)
      if (c) return sum + c.xp
    }
    return sum
  }, 0)

  const handlePlay = useCallback(async () => {
    try {
      const unlock = await ensureAudioUnlocked()
      if (!unlock.ok) {
        useUIStore.getState().setAudioError('Tap Play again — iOS blocked audio')
        return
      }
      useUIStore.getState().setAudioError(null)
      await initEngine()
      await ensureAudioUnlocked()
      await evaluateCode(code)
      setIsPlaying(true)
      maybeLoadCommunityBanks()
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
    if (isMobile) setMobileTab('goal')
  }, [activeChallengeIdx, activeLevelIdx, level.challenges.length, isMobile])

  const selectChallenge = useCallback(
    (levelIdx: number, challengeIdx: number) => {
      setActiveLevelIdx(levelIdx)
      setActiveChallengeIdx(challengeIdx)
      setFeedback(null)
      if (isMobile) setMobileTab('goal')
    },
    [isMobile],
  )

  const handleApplyToJam = useCallback(async () => {
    await handleStop()
    const trackId = useSessionStore.getState().applyLearnCode({
      code,
      name: challenge.title,
      role: challenge.studioRole ?? 'custom',
    })
    setAppliedFlash(true)
    useJamStore.getState().setCodeTrackId(trackId)
    useUIStore.getState().setAppMode('jam')
  }, [code, challenge, handleStop])

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

  const challengeList = (
    <div className="flex flex-col h-full bg-bg-surface border-r border-border min-w-0">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text">Learn Strudel</span>
          <span className="text-xs text-accent font-semibold">{xpTotal} XP</span>
        </div>
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (xpTotal / XP_MAX) * 100)}%` }}
          />
        </div>
      </div>

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
                    type="button"
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
  )

  const editorPane = (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0">
        <CodePane learnMode learnCode={code} onLearnCodeChange={setCode} />
      </div>
    </div>
  )

  const goalPane = (
    <div className="flex flex-col h-full bg-bg-surface border-l border-border min-w-0">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Challenge</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-lg font-semibold text-text mb-1">{challenge.title}</h2>
        <p className="text-xs text-accent mb-4">
          {level.title} — {challenge.xp} XP
        </p>
        <p className="text-sm text-text-muted leading-relaxed mb-4">{challenge.description}</p>

        <button
          type="button"
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

        {feedback === 'success' && (
          <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4 space-y-3">
            <p className="text-sm text-success font-medium">Correct! +{challenge.xp} XP</p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApplyToJam}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-accent text-bg rounded-lg hover:bg-accent/90 shadow-[0_0_14px_rgba(167,139,250,0.35)] transition-all active:scale-95"
                title="Add this code as a new Jam track and open its Code sheet"
              >
                Apply to Jam →
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto px-3 py-2 text-xs bg-success/20 text-success rounded-lg hover:bg-success/30 transition-colors"
              >
                Next challenge →
              </button>
            </div>
            {level.id === 4 && (
              <p className="text-[11px] text-text-muted leading-relaxed">
                In Jam: open Code on the new track — Update / Lock lands edits on the cycle.
              </p>
            )}
          </div>
        )}
        {feedback === 'fail' && (
          <div className="bg-error/10 border border-error/30 rounded p-3 mb-4">
            <p className="text-sm text-error">Not quite right. Check the hint and try again.</p>
          </div>
        )}
        {appliedFlash && (
          <p className="text-[11px] text-accent">Opening Jam with your track…</p>
        )}
      </div>
    </div>
  )

  const transport = (
    <div className="h-14 shrink-0 bg-bg-surface/95 backdrop-blur-md border-t border-border flex items-center px-3 sm:px-4 gap-2 sm:gap-3 pb-[max(0px,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={isPlaying ? handleStop : handlePlay}
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-95 ${
          isPlaying
            ? 'bg-error/35 text-error hover:bg-error/45'
            : 'bg-accent text-bg hover:bg-accent/90 shadow-[0_0_14px_rgba(167,139,250,0.4)]'
        }`}
        aria-label={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '■' : '▶'}
      </button>

      <button
        type="button"
        onClick={handleCheck}
        className="px-3 sm:px-4 py-2 text-xs font-medium bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
      >
        Check
      </button>

      {feedback === 'success' && (
        <button
          type="button"
          onClick={handleApplyToJam}
          className="px-4 py-2 text-xs font-semibold bg-accent text-bg rounded-lg hover:bg-accent/90 shadow-[0_0_14px_rgba(167,139,250,0.35)] transition-all active:scale-95 hidden sm:inline-flex"
        >
          Apply to Jam →
        </button>
      )}

      <div className="flex-1" />

      <span className="text-xs text-accent font-semibold tabular-nums">
        {xpTotal}/{XP_MAX} XP
      </span>

      <button
        type="button"
        onClick={() => useUIStore.getState().setAppMode('jam')}
        className="min-h-11 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 rounded transition-colors"
      >
        ← Jam
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <div className="shrink-0 flex border-b border-border bg-bg-surface">
          {(
            [
              ['list', 'Levels'],
              ['code', 'Code'],
              ['goal', 'Goal'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                mobileTab === id
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {mobileTab === 'list' && challengeList}
          {mobileTab === 'code' && editorPane}
          {mobileTab === 'goal' && goalPane}
        </div>
        {transport}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex flex-1 min-h-0">
        <div className="w-64 min-w-56 max-w-72 shrink-0">{challengeList}</div>
        {editorPane}
        <div className="w-72 min-w-64 max-w-80 shrink-0">{goalPane}</div>
      </div>
      {transport}
    </div>
  )
}
