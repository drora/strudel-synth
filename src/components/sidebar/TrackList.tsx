import { useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { TrackItem } from './TrackItem'
import { AddTrackButton } from './AddTrackButton'
import { LearningPath } from '../learning/LearningPath'
import { SessionControls } from '../session/SessionManager'

type SidebarTab = 'tracks' | 'learn'

export function TrackList() {
  const tracks = useSessionStore((s) => s.tracks)
  const mode = useUIStore((s) => s.mode)
  const [activeTab, setActiveTab] = useState<SidebarTab>('tracks')

  return (
    <div className="flex flex-col h-full bg-bg-surface border-r border-border w-56 min-w-56">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('tracks')}
          className={`flex-1 px-2 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            activeTab === 'tracks' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text'
          }`}
        >
          Tracks
        </button>
        <button
          onClick={() => setActiveTab('learn')}
          className={`flex-1 px-2 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            activeTab === 'learn' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text'
          }`}
        >
          Learn
        </button>
      </div>

      {activeTab === 'tracks' ? (
        <>
          {/* Session controls */}
          <SessionControls />
          {/* Track list */}
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track, index) => (
              <TrackItem key={track.id} track={track} index={index} />
            ))}
          </div>
          <AddTrackButton />
          {/* Mode toggle */}
          <div className="px-3 py-2 border-t border-border flex items-center gap-2">
            <span className="text-[9px] text-text-muted">Mode:</span>
            <button
              onClick={() => useUIStore.getState().setMode(mode === 'beginner' ? 'producer' : 'beginner')}
              className={`px-2 py-0.5 text-[9px] rounded transition-colors ${
                mode === 'producer' ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-muted'
              }`}
            >
              {mode === 'beginner' ? 'Beginner' : 'Producer'}
            </button>
          </div>
        </>
      ) : (
        <LearningPath />
      )}
    </div>
  )
}
