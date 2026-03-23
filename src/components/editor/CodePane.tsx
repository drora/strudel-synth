import { useSessionStore } from '../../store/session-store'
import { TrackCodePane } from './TrackCodePane'

export function CodePane() {
  const tracks = useSessionStore((s) => s.tracks)
  const activeTrackId = useSessionStore((s) => s.activeTrackId)

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        Pick a template or add a track to get started
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {tracks.map((track) => (
        <TrackCodePane
          key={track.id}
          track={track}
          isActive={track.id === activeTrackId}
        />
      ))}
    </div>
  )
}
