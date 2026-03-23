import { PlayButton } from './PlayButton'
import { BpmControl } from './BpmControl'
import { TransportViz } from './TransportViz'
import { SampleLoadingIndicator } from './SampleLoadingIndicator'
import { useSessionStore } from '../../store/session-store'

interface TransportBarProps {
  onToggleDocs?: () => void
  onToggleCheatsheet?: () => void
  onTogglePiano?: () => void
  onToggleRecorder?: () => void
}

export function TransportBar({ onToggleDocs, onToggleCheatsheet, onTogglePiano, onToggleRecorder }: TransportBarProps) {
  const tracks = useSessionStore((s) => s.tracks)
  const anyLocked = tracks.some((t) => t.locked)
  const anyMuted = tracks.some((t) => t.muted)

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
    <div className="flex items-center gap-4 px-4 h-14 bg-bg-surface border-t border-border">
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
    </div>
  )
}
