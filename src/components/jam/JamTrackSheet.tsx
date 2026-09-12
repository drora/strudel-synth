import { useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useJamStore } from '../../store/jam-store'
import {
  getKit,
  applySoundChoiceToCode,
  matchSoundChoice,
  type SoundChoice,
} from '../../engine/kits'
import { soundChoicesForKit, improvSoundChoices } from '../../engine/kit-sound-choices'
import { listMicSampleNames } from '../../engine/mic-sample'
import { isPadsKeepTrack, setImprovVoiceInCode } from '../../engine/improv-plate'
import {
  parseEffectValue,
  setEffectInCode,
  removeEffectFromCode,
  isPatternedEffect,
} from '../../engine/code-effects'
import { liveUpdateEngine } from '../../engine/live-update'
import { reshuffleTrackById, setTrackOctave } from '../../engine/jam-actions'
import { isMelodicRole } from '../../engine/note-harmony'
import type { Track } from '../../engine/types'
import { queueJam, queueJamImmediate } from './jam-shell-utils'

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
  const live = useSessionStore((s) => s.tracks.find((t) => t.id === track.id))
  const trackCount = useSessionStore((s) => s.tracks.length)
  const canRemove = trackCount > 1
  const kitId = useJamStore((s) => s.kitId)
  const activeKit = kitId ? getKit(kitId) : undefined

  if (!live) return null

  const soundChoices = isPadsKeepTrack(live)
    ? improvSoundChoices(activeKit, listMicSampleNames())
    : soundChoicesForKit(live.role, activeKit)

  const close = () => useJamStore.getState().setSoundTrackId(null)

  const removeTrack = () => {
    if (!canRemove) return
    const id = live.id
    const name = live.name
    useSessionStore.getState().removeTrack(id)
    const jam = useJamStore.getState()
    jam.clearLastTouchedIfRemoved(id)
    jam.setLastPeek(`Removed · ${name}`)
    queueJamImmediate('jam')
  }

  const applySound = (choice: SoundChoice) => {
    const jam = useJamStore.getState()
    jam.pushUndo({
      trackId: live.id,
      code: live.code,
      label: `Sound · ${choice.label}`,
    })
    let next = isPadsKeepTrack(live) && choice.sound
      ? setImprovVoiceInCode(live.code, choice.sound)
      : applySoundChoiceToCode(live.code, choice)
    if (
      live.role === 'vox' &&
      choice.sound &&
      parseEffectValue(next, 'attack') == null
    ) {
      next = setEffectInCode(next, 'attack', 0.08)
    }
    useSessionStore.getState().setCode(live.id, next)
    jam.touchTrack(live.id)
    jam.setLastPeek(`Sound · ${choice.label}`)
    queueJam('kit')
  }

  const applyFx = (key: string, value: number) => {
    if (isPatternedEffect(live.code, key)) {
      useJamStore.getState().setLastPeek(`FX · ${key} is patterned — Edit in Code`)
      return
    }
    const jam = useJamStore.getState()
    const current = parseEffectValue(live.code, key)
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
    jam.touchTrack(live.id)
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
    queueJamImmediate('mute-solo')
  }

  const setVolume = (v: number) => {
    useSessionStore.getState().setVolume(live.id, v)
    const jam = useJamStore.getState()
    jam.touchTrack(live.id)
    jam.setLastPeek(`${live.name} · vol ${v}`)
    liveUpdateEngine.markDirty()
    queueJamImmediate('mute-solo')
  }

  const editSoundInCode = () => {
    useSessionStore.getState().setActiveTrack(live.id)
    const jam = useJamStore.getState()
    jam.setSoundTrackId(null)
    jam.setCodeTrackId(live.id)
  }

  const shuffleThis = () => {
    if (live.locked) {
      useJamStore.getState().setLastPeek(`Locked · ${live.name}`)
      return
    }
    reshuffleTrackById(live.id)
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
            {soundChoices.map((c) => {
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
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Lock
              </span>
              <button
                type="button"
                onClick={() => {
                  useSessionStore.getState().toggleLock(live.id)
                  const now = useSessionStore.getState().tracks.find((t) => t.id === live.id)
                  useJamStore.getState().setLastPeek(
                    now?.locked ? `Locked · ${live.name}` : `Unlocked · ${live.name}`,
                  )
                }}
                aria-pressed={live.locked}
                aria-label={live.locked ? `Unlock ${live.name}` : `Lock ${live.name}`}
                title={
                  live.locked
                    ? 'Unlock — Shuffle may change this track'
                    : 'Lock — Shuffle skips this track'
                }
                className={`min-h-11 px-4 rounded-xl text-xs font-medium border ${
                  live.locked
                    ? 'border-accent/40 bg-accent/15 text-accent'
                    : 'border-border text-text-muted hover:border-accent'
                }`}
              >
                {live.locked ? 'Locked' : 'Lock'}
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
            {isMelodicRole(live.role) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    Octave
                  </span>
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {(live.octave ?? 0) >= 0 ? '+' : ''}
                    {live.octave ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-xl text-sm font-medium border border-border hover:border-accent"
                    onClick={() => setTrackOctave(live.id, (live.octave ?? 0) - 1)}
                    aria-label="Octave down"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-xl text-sm font-medium border border-border hover:border-accent"
                    onClick={() => setTrackOctave(live.id, 0)}
                    aria-label="Reset octave"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-xl text-sm font-medium border border-border hover:border-accent"
                    onClick={() => setTrackOctave(live.id, (live.octave ?? 0) + 1)}
                    aria-label="Octave up"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 min-h-11 text-xs font-medium text-accent border border-accent/40 rounded-xl bg-transparent hover:bg-accent/10"
              onClick={editSoundInCode}
            >
              Edit in Code
            </button>
            <button
              type="button"
              className="flex-1 min-h-11 text-xs font-semibold rounded-xl bg-accent text-bg border border-accent hover:brightness-110"
              onClick={close}
            >
              Done
            </button>
          </div>
          <div className="flex items-center justify-center gap-3 pt-0.5">
            <button
              type="button"
              disabled={live.locked}
              onClick={shuffleThis}
              title={
                live.locked
                  ? `Locked · unlock to shuffle ${live.name}`
                  : `Shuffle only ${live.name}`
              }
              aria-label={
                live.locked
                  ? `Locked — cannot shuffle ${live.name}`
                  : `Shuffle this track · ${live.name}`
              }
              className="text-[11px] text-text-muted hover:text-accent underline-offset-2 hover:underline disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed px-2 py-1"
            >
              Shuffle this
            </button>
            <button
              type="button"
              disabled={!canRemove}
              onClick={removeTrack}
              title={canRemove ? 'Remove this track' : 'Need at least one track'}
              aria-label={canRemove ? `Remove ${live.name}` : 'Need at least one track'}
              className="text-[11px] text-error/70 hover:text-error underline-offset-2 hover:underline disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed px-2 py-1"
            >
              {canRemove ? 'Remove track' : 'Need at least one track'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
