import { PlayButton } from './PlayButton'
import { BpmControl } from './BpmControl'
import { TransportViz } from './TransportViz'
import { SampleLoadingIndicator } from './SampleLoadingIndicator'
import { useSessionStore } from '../../store/session-store'
import { useUIStore, QUANT_OPTIONS } from '../../store/ui-store'
import type { Quantization } from '../../engine/live-update'

interface TransportBarProps {
  onToggleDocs?: () => void
  onToggleCheatsheet?: () => void
  onTogglePiano?: () => void
  onToggleRecorder?: () => void
  isMobile?: boolean
}

export function TransportBar({ onToggleDocs, onToggleCheatsheet, onTogglePiano, onToggleRecorder, isMobile }: TransportBarProps) {
  const tracks = useSessionStore((s) => s.tracks)
  const anyLocked = tracks.some((t) => t.locked)
  const anyMuted = tracks.some((t) => t.muted)
  const defaultQuantization = useUIStore((s) => s.defaultQuantization)
  const crossfadeSwaps = useUIStore((s) => s.crossfadeSwaps)

  const handleLockAll = () => useSessionStore.getState().lockAll()

  const handleMuteAll = () => {
    const state = useSessionStore.getState()
    // If any muted, unmute all. Otherwise mute all.
    state.tracks.forEach((t) => {
      if (anyMuted && t.muted) state.toggleMute(t.id)
      if (!anyMuted && !t.muted) state.toggleMute(t.id)
    })
  }

  return (
    <div className={`flex items-center gap-3 px-3 bg-bg-surface border-t border-border ${
      isMobile ? 'flex-wrap py-2 gap-2' : 'h-14 gap-4 px-4'
    }`}>
      {/* Play / Stop */}
      <PlayButton />

      {/* BPM */}
      <BpmControl />

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Global track controls */}
      <button
        onClick={handleLockAll}
        className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
          anyLocked
            ? 'bg-accent/20 text-accent'
            : 'bg-bg-elevated text-text-muted hover:text-text'
        }`}
        title="Lock/unlock all tracks (Ctrl+Shift+L)"
      >
        {anyLocked ? 'Unlock All' : 'Lock All'}
      </button>

      <button
        onClick={handleMuteAll}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          anyMuted
            ? 'bg-error/20 text-error'
            : 'bg-bg-elevated text-text-muted hover:text-text'
        }`}
        title="Mute/unmute all tracks"
      >
        {anyMuted ? 'Unmute All' : 'Mute All'}
      </button>

      {/* Global default quantization (persisted via ui-store) */}
      <label
        className="flex items-center gap-1 text-[10px] text-text-muted"
        title="Default quantization for Update / Lock / hotkeys"
      >
        <span className="hidden sm:inline">Quant</span>
        <select
          value={defaultQuantization}
          onChange={(e) =>
            useUIStore.getState().setDefaultQuantization(e.target.value as Quantization)
          }
          className="bg-bg-elevated text-text text-[10px] rounded px-1.5 py-1 border border-border focus:outline-none focus:border-accent"
        >
          {QUANT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.short === '∞' ? 'now' : o.short}
            </option>
          ))}
        </select>
      </label>

      {/*
        Crossfade swaps — STUBBED disabled.
        Strudel's xfade(left, amount, right) blends two concurrent patterns; it is not
        a compose/evaluate swap transition API. Enabling would invent broken audio wiring.
      */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Crossfade swaps unavailable — Strudel xfade() is concurrent blend, not a pattern-swap API"
        className="px-2 py-1 text-[10px] rounded bg-bg-elevated text-text-muted/50 cursor-not-allowed line-through decoration-text-muted/40"
      >
        Crossfade{crossfadeSwaps ? ' on' : ''}
      </button>

      {/* Sample loading progress */}
      <SampleLoadingIndicator />

      {/* Beat visualizer + track dots */}
      <div className="flex-1 flex items-center justify-center">
        <TransportViz />
      </div>

      {/* Panel toggles */}
      <button
        onClick={onTogglePiano}
        className="px-2 py-1 text-[10px] text-text-muted hover:text-accent rounded transition-colors"
        title="Toggle piano keyboard"
      >
        Keys
      </button>
      <button
        onClick={onToggleRecorder}
        className="px-2 py-1 text-[10px] text-text-muted hover:text-accent rounded transition-colors"
        title="Voice recorder"
      >
        Rec
      </button>
      <button
        onClick={onToggleDocs}
        className="px-2 py-1 text-[10px] text-text-muted hover:text-accent rounded transition-colors"
        title="Toggle right panel"
      >
        Panel
      </button>
      <button
        onClick={onToggleCheatsheet}
        className="px-2 py-1 text-[10px] text-text-muted hover:text-accent rounded transition-colors"
        title="Cheatsheet (Cmd+/)"
      >
        ?
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Learn mode switch */}
      <button
        onClick={() => useUIStore.getState().setAppMode('learn')}
        className="px-3 py-1 text-[10px] font-medium text-text-muted hover:text-accent bg-bg-elevated hover:bg-accent/10 rounded transition-colors"
        title="Switch to Learn Mode"
      >
        Learn
      </button>
    </div>
  )
}
