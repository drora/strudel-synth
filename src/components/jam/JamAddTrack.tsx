import { useState } from 'react'
import { ROLE_PRESETS } from '../../engine/presets'
import type { TrackRole } from '../../engine/types'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import { queueJam } from './jam-shell-utils'

const ROLE_ORDER: TrackRole[] = [
  'drums',
  'hihats',
  'bass',
  'lead',
  'pad',
  'arp',
  'fx',
  'vox',
  'custom',
]

/**
 * + Track — pick a role, add via sessionStore + ROLE_PRESETS, open Sound|FX sheet.
 * Does not switch kits.
 */
export function JamAddTrack() {
  const [open, setOpen] = useState(false)

  const addRole = (role: TrackRole) => {
    const preset = ROLE_PRESETS[role]
    const id = useSessionStore.getState().addTrack({
      name: preset.label,
      role: preset.role,
      code: preset.defaultCode,
      color: preset.color,
      muted: false,
      soloed: false,
      locked: false,
      volume: 1,
      error: null,
    })
    const jam = useJamStore.getState()
    jam.setLastPeek(`+ Track · ${preset.label}`)
    jam.setCodeTrackId(null)
    jam.setSoundTrackId(id)
    setOpen(false)
    queueJam('jam')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 min-w-10 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-dashed border-accent/50 bg-accent/10 text-accent hover:border-accent"
        title="Add track"
        aria-label="Add track"
      >
        + Track
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3"
          role="dialog"
          aria-label="Add track"
        >
          <div className="w-full max-w-md rounded-2xl bg-bg-elevated border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-accent">Add track</div>
                <div className="text-sm font-semibold">Pick a role</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 px-3 rounded-xl text-xs text-text-muted border border-border"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_ORDER.map((role) => {
                const p = ROLE_PRESETS[role]
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => addRole(role)}
                    className="min-h-14 px-2 rounded-xl border border-border text-left hover:border-accent transition-colors"
                    style={{ borderColor: p.color + '66' }}
                  >
                    <div className="text-base leading-none mb-1">{p.icon}</div>
                    <div className="text-[11px] font-medium truncate" style={{ color: p.color }}>
                      {p.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
