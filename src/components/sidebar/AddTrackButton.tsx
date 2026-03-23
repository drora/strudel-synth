import { useState, useCallback } from 'react'
import { useSessionStore } from '../../store/session-store'
import { ROLE_PRESETS, type RolePreset } from '../../engine/presets'
import type { TrackRole } from '../../engine/types'

export function AddTrackButton() {
  const [showPicker, setShowPicker] = useState(false)
  const addTrack = useSessionStore((s) => s.addTrack)

  const handleAddTrack = useCallback(
    (preset: RolePreset) => {
      const tracks = useSessionStore.getState().tracks
      const roleCount = tracks.filter((t) => t.role === preset.role).length
      const name = roleCount > 0 ? `${preset.label} ${roleCount + 1}` : preset.label

      addTrack({
        name,
        role: preset.role,
        code: preset.defaultCode,
        color: preset.color,
        muted: false,
        soloed: false,
        locked: false,
        volume: 1,
        error: null,
      })
      setShowPicker(false)
    },
    [addTrack]
  )

  const roles: TrackRole[] = ['drums', 'hihats', 'bass', 'lead', 'pad', 'arp', 'fx', 'vox', 'custom']

  return (
    <div className="border-t border-border">
      {showPicker ? (
        <div className="p-2 grid grid-cols-3 gap-1">
          {roles.map((role) => {
            const preset = ROLE_PRESETS[role]
            return (
              <button
                key={role}
                onClick={() => handleAddTrack(preset)}
                className="flex flex-col items-center gap-0.5 p-1.5 rounded text-center hover:bg-bg-elevated transition-colors"
                title={preset.label}
              >
                <span className="text-sm">{preset.icon}</span>
                <span className="text-[9px] text-text-muted">{preset.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full px-3 py-2 text-sm text-text-muted hover:text-accent hover:bg-bg-elevated transition-colors"
        >
          + Add Track
        </button>
      )}
    </div>
  )
}
