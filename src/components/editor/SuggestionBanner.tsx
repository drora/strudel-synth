import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSessionStore } from '../../store/session-store'
import { subscribeCursorDocs, type CursorDocsContext } from './cursor-docs'

interface Suggestion {
  message: string
  /** Optional: prefer this tip when cursor symbol matches */
  cursorSymbols?: string[]
  condition: (
    tracks: ReturnType<typeof useSessionStore.getState>['tracks'],
    isPlaying: boolean,
    cursor: CursorDocsContext | null,
  ) => boolean
}

const suggestions: Suggestion[] = [
  {
    message: 'Try .room(0.5) for reverb or .lpf(800) for warmth',
    cursorSymbols: ['s', 'note', 'sound', 'gain'],
    condition: (tracks, _p, cursor) =>
      (cursor?.kind === 'method' && ['gain', 's'].includes(cursor.symbol)) ||
      tracks.some(
        (t) =>
          t.code.length > 10 &&
          !t.code.includes('.room') &&
          !t.code.includes('.lpf') &&
          !t.code.includes('.delay'),
      ),
  },
  {
    message: 'Mini-notation: ~ is a rest, * repeats, [] groups, <> alternates',
    cursorSymbols: ['~', '*', '[', '<', '!', '@', '?', '/'],
    condition: (_t, _p, cursor) => cursor?.kind === 'mini',
  },
  {
    message: 'Add another track to thicken your sound',
    condition: (tracks, isPlaying) => isPlaying && tracks.length === 1,
  },
  {
    message: 'Try .every(4, fast(2)) to add variation',
    cursorSymbols: ['fast', 'slow', 'every'],
    condition: (tracks, _p, cursor) =>
      cursor?.symbol === 'fast' ||
      tracks.some(
        (t) =>
          t.code.length > 20 &&
          !t.code.includes('.every') &&
          !t.code.includes('.sometimes'),
      ),
  },
  {
    message: 'Use .jux(rev) to create stereo width',
    cursorSymbols: ['jux', 'rev', 'pan'],
    condition: (tracks, _p, cursor) =>
      cursor?.symbol === 'jux' ||
      (tracks.length >= 2 && !tracks.some((t) => t.code.includes('.jux'))),
  },
  {
    message: 'Try .delay(0.25).delaytime(0.125) for echo',
    cursorSymbols: ['delay', 'delaytime', 'room'],
    condition: (tracks, _p, cursor) =>
      cursor?.symbol === 'delay' ||
      tracks.some((t) => t.code.length > 10 && !t.code.includes('.delay')),
  },
  {
    message: 'Use slider(0.5, 0, 1) for inline parameter control',
    condition: (tracks) => !tracks.some((t) => t.code.includes('slider(')),
  },
  {
    message: 'Try .chop(16) to slice a sample into granules',
    cursorSymbols: ['chop', 'begin', 'end', 'loopAt'],
    condition: (tracks, _p, cursor) =>
      cursor?.symbol === 'chop' ||
      tracks.some((t) => t.code.includes('s(') && !t.code.includes('.chop')),
  },
  {
    message: 'Use .struct("x ~ x ~") to apply a rhythmic mask',
    cursorSymbols: ['struct'],
    condition: (tracks, _p, cursor) =>
      cursor?.symbol === 'struct' ||
      !tracks.some((t) => t.code.includes('.struct')),
  },
  {
    // Cursor-info passthrough when autocomplete-data has a signature
    message: '',
    condition: (_t, _p, cursor) => Boolean(cursor?.info && cursor.kind === 'method'),
  },
]

export function SuggestionBanner() {
  const tracks = useSessionStore((s) => s.tracks)
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [minimized, setMinimized] = useState(false)
  const [visible, setVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cursor, setCursor] = useState<CursorDocsContext | null>(null)

  useEffect(() => subscribeCursorDocs(setCursor), [])

  // Show after a delay
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  // Prefer tip matching cursor symbol (ghost-text alternative)
  const cursorDrivenMessage = useMemo(() => {
    if (!cursor?.symbol) return null
    if (cursor.kind === 'method' && cursor.info) {
      return `${cursor.symbol}: ${cursor.info}`
    }
    if (cursor.kind === 'mini') {
      return cursor.info
        ? `mini ${cursor.symbol}: ${cursor.info}`
        : `Mini-notation operator ${cursor.symbol}`
    }
    const idx = suggestions.findIndex(
      (s) =>
        s.cursorSymbols?.includes(cursor.symbol) &&
        s.condition(tracks, isPlaying, cursor),
    )
    if (idx >= 0 && suggestions[idx].message) return suggestions[idx].message
    return null
  }, [cursor, tracks, isPlaying])

  const findNextSuggestion = useCallback(
    (startFrom: number): number => {
      for (let i = 0; i < suggestions.length; i++) {
        const idx = (startFrom + i) % suggestions.length
        if (!skipped.has(idx) && suggestions[idx].condition(tracks, isPlaying, cursor)) {
          // Skip empty placeholder (cursor-info row)
          if (!suggestions[idx].message && !cursorDrivenMessage) continue
          return idx
        }
      }
      return -1
    },
    [skipped, tracks, isPlaying, cursor, cursorDrivenMessage],
  )

  useEffect(() => {
    const idx = findNextSuggestion(0)
    if (idx !== -1) setCurrentIndex(idx)
  }, [visible, cursor?.symbol])

  const handleRefresh = useCallback(() => {
    const next = findNextSuggestion(currentIndex + 1)
    if (next !== -1) {
      setCurrentIndex(next)
    } else {
      setSkipped(new Set())
      setCurrentIndex((currentIndex + 1) % suggestions.length)
    }
  }, [currentIndex, findNextSuggestion])

  const handleMinimize = useCallback(() => {
    setMinimized((m) => !m)
  }, [])

  if (!visible || tracks.length === 0) return null

  const activeSuggestion = suggestions[currentIndex]
  const message =
    cursorDrivenMessage ||
    activeSuggestion?.message ||
    'Explore methods with `.` — info appears in the autocomplete panel'

  if (!message) return null

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
      <span className="text-accent font-medium">{cursorDrivenMessage ? 'ctx' : 'tip'}</span>
      <span className="flex-1 truncate">{message}</span>
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
