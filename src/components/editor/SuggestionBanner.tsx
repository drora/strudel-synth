import { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'

interface Suggestion {
  message: string
  condition: (tracks: ReturnType<typeof useSessionStore.getState>['tracks'], isPlaying: boolean) => boolean
}

const suggestions: Suggestion[] = [
  {
    message: 'Try .room(0.5) for reverb or .lpf(800) for warmth',
    condition: (tracks) =>
      tracks.some((t) => t.code.length > 10 && !t.code.includes('.room') && !t.code.includes('.lpf') && !t.code.includes('.delay')),
  },
  {
    message: 'Add another track to thicken your sound',
    condition: (tracks, isPlaying) => isPlaying && tracks.length === 1,
  },
  {
    message: 'Try .every(4, fast(2)) to add variation',
    condition: (tracks) =>
      tracks.some((t) => t.code.length > 20 && !t.code.includes('.every') && !t.code.includes('.sometimes')),
  },
  {
    message: 'Use .jux(rev) to create stereo width',
    condition: (tracks) =>
      tracks.length >= 2 && !tracks.some((t) => t.code.includes('.jux')),
  },
  {
    message: 'Try .delay(0.25).delaytime(0.125) for echo',
    condition: (tracks) =>
      tracks.some((t) => t.code.length > 10 && !t.code.includes('.delay')),
  },
  {
    message: 'Use slider(0.5, 0, 1) for inline parameter control',
    condition: (tracks) =>
      !tracks.some((t) => t.code.includes('slider(')),
  },
  {
    message: 'Try .chop(16) to slice a sample into granules',
    condition: (tracks) =>
      tracks.some((t) => t.code.includes('s(') && !t.code.includes('.chop')),
  },
  {
    message: 'Use .struct("x ~ x ~") to apply a rhythmic mask',
    condition: (tracks) =>
      !tracks.some((t) => t.code.includes('.struct')),
  },
]

export function SuggestionBanner() {
  const tracks = useSessionStore((s) => s.tracks)
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [minimized, setMinimized] = useState(false)
  const [visible, setVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Show after a delay
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  // Find next valid suggestion
  const findNextSuggestion = useCallback((startFrom: number): number => {
    for (let i = 0; i < suggestions.length; i++) {
      const idx = (startFrom + i) % suggestions.length
      if (!skipped.has(idx) && suggestions[idx].condition(tracks, isPlaying)) {
        return idx
      }
    }
    return -1
  }, [skipped, tracks, isPlaying])

  // Set initial suggestion
  useEffect(() => {
    const idx = findNextSuggestion(0)
    if (idx !== -1) setCurrentIndex(idx)
  }, [visible])

  const handleRefresh = useCallback(() => {
    const next = findNextSuggestion(currentIndex + 1)
    if (next !== -1) {
      setCurrentIndex(next)
    } else {
      // All exhausted — reset skipped and cycle
      setSkipped(new Set())
      setCurrentIndex((currentIndex + 1) % suggestions.length)
    }
  }, [currentIndex, findNextSuggestion])

  const handleMinimize = useCallback(() => {
    setMinimized((m) => !m)
  }, [])

  if (!visible || tracks.length === 0) return null

  const activeSuggestion = suggestions[currentIndex]
  if (!activeSuggestion) return null

  if (minimized) {
    return (
      <div className="mx-4 mb-1 flex justify-end">
        <button
          onClick={handleMinimize}
          className="px-2 py-0.5 text-[9px] text-accent/50 hover:text-accent rounded transition-colors"
          title="Show tips"
        >
          tips
        </button>
      </div>
    )
  }

  return (
    <div className="mx-4 mb-2 px-3 py-1.5 bg-accent/5 border border-accent/20 rounded text-xs text-text-muted flex items-center gap-2">
      <span className="text-accent font-medium">tip</span>
      <span className="flex-1">{activeSuggestion.message}</span>
      <button
        onClick={handleRefresh}
        className="text-text-muted hover:text-accent transition-colors"
        title="Next tip"
      >
        ↻
      </button>
      <button
        onClick={handleMinimize}
        className="text-text-muted hover:text-text transition-colors"
        title="Minimize tips"
      >
        ▾
      </button>
    </div>
  )
}
