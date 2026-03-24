import { useSessionStore } from '../../store/session-store'
import { TrackItem } from './TrackItem'
import { AddTrackButton } from './AddTrackButton'
import { SessionControls } from '../session/SessionManager'

interface TrackListProps {
  onTrackSelect?: () => void
}

export function TrackList({ onTrackSelect }: TrackListProps) {
  const tracks = useSessionStore((s) => s.tracks)

  return (
    <div className="flex flex-col h-full bg-bg-surface border-r border-border w-56 min-w-56">
      {/* Session controls */}
      <SessionControls />
      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {tracks.map((track, index) => (
          <TrackItem key={track.id} track={track} index={index} onSelect={onTrackSelect} />
        ))}
      </div>
      <AddTrackButton />
    </div>
  )
}
