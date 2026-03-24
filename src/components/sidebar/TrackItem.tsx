import { useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import type { Track } from '../../engine/types'
import { ROLE_PRESETS } from '../../engine/presets'

interface TrackItemProps {
  track: Track
  index: number
  onSelect?: () => void
}

export function TrackItem({ track, onSelect }: TrackItemProps) {
  const activeTrackId = useSessionStore((s) => s.activeTrackId)
  const setActiveTrack = useSessionStore((s) => s.setActiveTrack)
  const toggleMute = useSessionStore((s) => s.toggleMute)
  const toggleSolo = useSessionStore((s) => s.toggleSolo)
  const removeTrack = useSessionStore((s) => s.removeTrack)
  const setVolume = useSessionStore((s) => s.setVolume)

  const isActive = track.id === activeTrackId
  const preset = ROLE_PRESETS[track.role]

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(track.id, parseFloat(e.target.value))
    },
    [track.id, setVolume]
  )

  return (
    <div
      className={`
        border-b border-border cursor-pointer transition-colors
        ${isActive ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/50'}
      `}
      onClick={() => { setActiveTrack(track.id); onSelect?.() }}
    >
      {/* Track header with M/S always visible */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: track.color }}
        />
        <span className="text-xs shrink-0">{preset.icon}</span>
        <span className="text-xs text-text truncate flex-1">{track.name}</span>

        {/* Mute / Solo — always visible */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(track.id) }}
          className={`
            w-5 h-5 text-[9px] font-bold rounded flex items-center justify-center transition-colors shrink-0
            ${track.muted
              ? 'bg-error/25 text-error'
              : 'text-text-muted/40 hover:text-text-muted hover:bg-bg'}
          `}
          title="Mute (Ctrl+Shift+M)"
        >
          M
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleSolo(track.id) }}
          className={`
            w-5 h-5 text-[9px] font-bold rounded flex items-center justify-center transition-colors shrink-0
            ${track.soloed
              ? 'bg-accent/25 text-accent'
              : 'text-text-muted/40 hover:text-text-muted hover:bg-bg'}
          `}
          title="Solo (Ctrl+Shift+S)"
        >
          S
        </button>

        {track.error && (
          <span className="w-2 h-2 rounded-full bg-error shrink-0" title="Error" />
        )}
      </div>

      {/* Expanded controls — only for active track */}
      {isActive && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {/* Volume slider + delete */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted w-5">Vol</span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.01}
              value={track.volume}
              onChange={handleVolumeChange}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 h-1 accent-accent cursor-pointer"
            />
            <span className="text-[10px] text-text-muted w-7 text-right">
              {Math.round(track.volume * 100)}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); removeTrack(track.id) }}
              className="text-[10px] text-text-muted hover:text-error transition-colors"
              title="Remove track"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
