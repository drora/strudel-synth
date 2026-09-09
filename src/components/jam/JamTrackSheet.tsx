import { useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { useJamStore } from '../../store/jam-store'
import {
  SOUND_CHOICES,
  applySoundChoiceToCode,
  type SoundChoice,
} from '../../engine/kits'
import {
  parseEffectValue,
  setEffectInCode,
  isPatternedEffect,
} from '../../engine/code-effects'
import { liveUpdateEngine } from '../../engine/live-update'
import type { Track } from '../../engine/types'

/** Lean Jam FX — stepped chips; mirrors EffectsPanel keys via code-effects. */
const JAM_FX_CONTROLS: Array<{
  key: string
  label: string
  steps: number[]
  unit?: string
}> = [
  { key: 'lpf', label: 'LPF', steps: [200, 400, 800, 1200, 2000, 4000, 8000, 12000] },
  { key: 'hpf', label: 'HPF', steps: [20, 100, 200, 400, 800, 1600, 3200] },
  { key: 'room', label: 'Room', steps: [0, 0.15, 0.3, 0.45, 0.6, 0.9, 1.2] },
  { key: 'delay', label: 'Delay', steps: [0, 0.1, 0.2, 0.35, 0.5, 0.7] },
  { key: 'gain', label: 'Gain', steps: [0.3, 0.5, 0.7, 0.85, 1, 1.15, 1.3] },
]

function queueJam(reason: 'kit' | 'jam' | 'reshuffle' = 'jam') {
  if (!useSessionStore.getState().isPlaying) return
  const q = useUIStore.getState().getEffectiveQuantization(
    useSessionStore.getState().activeTrackId,
  )
  liveUpdateEngine.queueUpdate(q, reason)
}

interface JamTrackSheetProps {
  track: Track
}

export function JamTrackSheet({ track }: JamTrackSheetProps) {
  const [sheetTab, setSheetTab] = useState<'sound' | 'fx'>('sound')
  // Subscribe so FX chips update after apply
  const live = useSessionStore((s) => s.tracks.find((t) => t.id === track.id)) ?? track

  const applySound = (choice: SoundChoice) => {
    const jam = useJamStore.getState()
    jam.pushUndo({
      trackId: live.id,
      code: live.code,
      label: `Sound · ${choice.label}`,
    })
    const next = applySoundChoiceToCode(live.code, choice)
    useSessionStore.getState().setCode(live.id, next)
    jam.setLastPeek(`Sound · ${choice.label}`)
    jam.setSoundTrackId(null)
    queueJam('kit')
  }

  const applyFx = (key: string, value: number) => {
    if (isPatternedEffect(live.code, key)) {
      useJamStore.getState().setLastPeek(`FX · ${key} is patterned — Edit in Code`)
      return
    }
    const jam = useJamStore.getState()
    jam.pushUndo({
      trackId: live.id,
      code: live.code,
      label: `FX · ${key}(${value})`,
    })
    const next = setEffectInCode(live.code, key, value)
    useSessionStore.getState().setCode(live.id, next)
    jam.setLastPeek(`FX · ${live.name} · ${key} ${value}`)
    liveUpdateEngine.markDirty()
    queueJam('jam')
  }

  const editSoundInCode = () => {
    useSessionStore.getState().setActiveTrack(live.id)
    useJamStore.getState().setSoundTrackId(null)
    useUIStore.getState().setAppMode('studio')
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-md rounded-2xl bg-bg-elevated border border-border p-4 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold truncate" style={{ color: live.color }}>
            {live.name}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden text-[11px] shrink-0">
            {(['sound', 'fx'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSheetTab(tab)}
                className={`min-h-9 px-3 capitalize ${
                  sheetTab === tab ? 'bg-accent text-bg' : 'text-text-muted'
                }`}
              >
                {tab === 'fx' ? 'FX' : 'Sound'}
              </button>
            ))}
          </div>
        </div>

        {sheetTab === 'sound' && (
          <div className="grid grid-cols-2 gap-2">
            {(SOUND_CHOICES[live.role] ?? SOUND_CHOICES.custom).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => applySound(c)}
                className="min-h-12 px-3 rounded-xl border border-border text-xs text-left hover:border-accent"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {sheetTab === 'fx' && (
          <div className="space-y-3">
            {JAM_FX_CONTROLS.map((fx) => {
              const current = parseEffectValue(live.code, fx.key)
              const patterned = isPatternedEffect(live.code, fx.key)
              return (
                <div key={fx.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-text-muted">{fx.label}</span>
                    <span className="text-[10px] text-text-muted">
                      {patterned ? 'patterned' : current ?? '—'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fx.steps.map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={patterned}
                        onClick={() => applyFx(fx.key, v)}
                        className={`min-h-9 px-2.5 rounded-lg text-[11px] border ${
                          !patterned && current === v
                            ? 'border-accent bg-accent/20 text-accent'
                            : 'border-border text-text-muted'
                        } disabled:opacity-40`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="flex-1 min-h-11 text-xs text-accent border border-accent/30 rounded-xl"
            onClick={editSoundInCode}
          >
            Edit in Code
          </button>
          <button
            type="button"
            className="flex-1 min-h-11 text-xs text-text-muted border border-border rounded-xl"
            onClick={() => useJamStore.getState().setSoundTrackId(null)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
