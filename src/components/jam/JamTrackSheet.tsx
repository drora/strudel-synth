import { useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import {
  SOUND_CHOICES,
  applySoundChoiceToCode,
  matchSoundChoice,
  type SoundChoice,
} from '../../engine/kits'
import {
  parseEffectValue,
  setEffectInCode,
  removeEffectFromCode,
  isPatternedEffect,
} from '../../engine/code-effects'
import { liveUpdateEngine } from '../../engine/live-update'
import type { Track } from '../../engine/types'
import { queueJam } from './jam-shell-utils'

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

const VOL_STEPS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]

interface JamTrackSheetProps {
  track: Track
}

type SheetTab = 'sound' | 'fx' | 'mix'

export function JamTrackSheet({ track }: JamTrackSheetProps) {
  const [sheetTab, setSheetTab] = useState<SheetTab>('sound')
  // Never fall back to a deleted track prop — mute/remove must match store.
  const live = useSessionStore((s) => s.tracks.find((t) => t.id === track.id))
  const trackCount = useSessionStore((s) => s.tracks.length)
  const canRemove = trackCount > 1

  if (!live) return null

  const close = () => useJamStore.getState().setSoundTrackId(null)

  const removeTrack = () => {
    if (!canRemove) return
    const id = live.id
    const name = live.name
    // removeTrack clears soundTrackId/codeTrackId + retargets activeTrackId in the store.
    useSessionStore.getState().removeTrack(id)
    useJamStore.getState().setLastPeek(`Removed · ${name}`)
    queueJam('jam')
  }

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
    // Keep sheet open so user can keep browsing sounds / FX / Mix.
    queueJam('kit')
  }

  const applyFx = (key: string, value: number) => {
    if (isPatternedEffect(live.code, key)) {
      useJamStore.getState().setLastPeek(`FX · ${key} is patterned — Edit in Code`)
      return
    }
    const jam = useJamStore.getState()
    const current = parseEffectValue(live.code, key)
    // Second click on the active chip removes the effect; otherwise apply/replace.
    const removing = current !== null && current === value
    jam.pushUndo({
      trackId: live.id,
      code: live.code,
      label: removing ? `FX · clear ${key}` : `FX · ${key}(${value})`,
    })
    const next = removing
      ? removeEffectFromCode(live.code, key)
      : setEffectInCode(live.code, key, value)
    useSessionStore.getState().setCode(live.id, next)
    jam.setLastPeek(
      removing
        ? `FX · ${live.name} · ${key} off`
        : `FX · ${live.name} · ${key} ${value}`,
    )
    liveUpdateEngine.markDirty()
    queueJam('jam')
  }

  const toggleMute = () => {
    const session = useSessionStore.getState()
    const current = session.tracks.find((t) => t.id === live.id)
    if (!current) return
    session.toggleMute(current.id)
    const muted = useSessionStore.getState().tracks.find((t) => t.id === current.id)?.muted
    useJamStore.getState().setLastPeek(`${current.name} · ${muted ? 'muted' : 'on'}`)
    liveUpdateEngine.markDirty()
    queueJam('mute-solo')
  }

  const setVolume = (v: number) => {
    useSessionStore.getState().setVolume(live.id, v)
    useJamStore.getState().setLastPeek(`${live.name} · vol ${v}`)
    liveUpdateEngine.markDirty()
    queueJam('mute-solo')
  }

  const editSoundInCode = () => {
    useSessionStore.getState().setActiveTrack(live.id)
    const jam = useJamStore.getState()
    jam.setSoundTrackId(null)
    jam.setCodeTrackId(live.id)
  }

  const tabs: Array<{ id: SheetTab; label: string }> = [
    { id: 'sound', label: 'Sound' },
    { id: 'fx', label: 'FX' },
    { id: 'mix', label: 'Mix' },
  ]

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-bg-elevated border border-border p-4 space-y-3 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${live.name} sound FX mix`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: live.color }}>
              {live.name}
              {live.muted ? ' · M' : ''}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex rounded-lg border border-border overflow-hidden text-[11px]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSheetTab(tab.id)}
                  className={`min-h-9 px-3 capitalize ${
                    sheetTab === tab.id ? 'bg-accent text-bg' : 'text-text-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={close}
              className="min-h-9 min-w-9 rounded-lg text-xs text-text-muted border border-border hover:text-text"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {sheetTab === 'sound' && (
          <div className="grid grid-cols-2 gap-2">
            {(SOUND_CHOICES[live.role] ?? SOUND_CHOICES.custom).map((c) => {
              const active = matchSoundChoice(live.code, c)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applySound(c)}
                  aria-pressed={active}
                  className={`min-h-12 px-3 rounded-xl border text-xs text-left ${
                    active
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
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
                        title={
                          !patterned && current === v
                            ? `Remove ${fx.label}`
                            : `Set ${fx.label} ${v}`
                        }
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

        {sheetTab === 'mix' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                On / Off
              </span>
              <button
                type="button"
                onClick={toggleMute}
                className={`min-h-11 px-4 rounded-xl text-xs font-medium border ${
                  live.muted
                    ? 'border-error/40 bg-error/15 text-error'
                    : 'border-accent/40 bg-accent/15 text-accent'
                }`}
              >
                {live.muted ? 'Muted' : 'On'}
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Volume
                </span>
                <span className="text-[10px] text-text-muted tabular-nums">{live.volume}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={live.volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-[var(--color-accent,#a78bfa)]"
                aria-label="Track volume"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {VOL_STEPS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVolume(v)}
                    className={`min-h-9 px-2.5 rounded-lg text-[11px] border ${
                      Math.abs(live.volume - v) < 0.001
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-border text-text-muted'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
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
              onClick={close}
            >
              Done
            </button>
          </div>
          <button
            type="button"
            disabled={!canRemove}
            onClick={removeTrack}
            title={canRemove ? 'Remove this track' : 'Need at least one track'}
            aria-label={canRemove ? `Remove ${live.name}` : 'Need at least one track'}
            className="w-full min-h-11 text-xs rounded-xl border border-error/40 text-error disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-error/10"
          >
            {canRemove ? 'Remove' : 'Remove · Need at least one track'}
          </button>
        </div>
      </div>
    </div>
  )
}
