import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import { getKit } from '../../engine/kits'
import {
  layoutImprovPads,
  hitsToNoteCode,
  applyImprovMixToCode,
  IMPROV_MIX_DEFAULT,
  IMPROV_VOL_STEPS,
  IMPROV_VEL_STEPS,
  IMPROV_FX_CONTROLS,
  isImprovFxOn,
  type ImprovHit,
  type ImprovPadMix,
} from '../../engine/improv-plate'
import { improvSoundChoices } from '../../engine/kit-sound-choices'
import { listMicSampleNames, micSampleDuration } from '../../engine/mic-sample'
import { liveUpdateEngine } from '../../engine/live-update'
import { startImprovNote, stopImprovNote, warmImprovTrigger, preloadImprovVoice, padVelocity } from '../../engine/improv-trigger'
import { ROLE_COLORS } from '../../engine/types'

interface Props {
  onClose: () => void
}

/** Render order: TOP 5 6 7 8 then BOTTOM 1 2 3 4 */
const RENDER_SLOTS = [5, 6, 7, 8, 1, 2, 3, 4] as const

/**
 * Jam improv fidget plate — SuperDough one-shots + Keep → vox track.
 * Bottom sheet (z-50), like JamMutateSheet.
 */
export function JamImprovPlate({ onClose }: Props) {
  const songRoot = useJamStore((s) => s.songRoot)
  const songScale = useJamStore((s) => s.songScale)
  const songSeed = useJamStore((s) => s.songSeed)
  const kitId = useJamStore((s) => s.kitId)
  const isPlaying = useSessionStore((s) => s.isPlaying)

  const [octave, setOctave] = useState(4)
  const [pressed, setPressed] = useState<number | null>(null)
  const [mix, setMix] = useState<ImprovPadMix>(IMPROV_MIX_DEFAULT)
  const kit = kitId ? getKit(kitId) : undefined
  const voices = useMemo(
    () => improvSoundChoices(kit, listMicSampleNames()),
    [kit],
  )
  const [voice, setVoice] = useState<string>(() => {
    const choices = improvSoundChoices(kitId ? getKit(kitId) : undefined, listMicSampleNames())
    return choices[0]?.sound ?? 'sawtooth'
  })

  useEffect(() => {
    void warmImprovTrigger().then(() => preloadImprovVoice(voice))
  }, [voice])

  const pads = useMemo(
    () =>
      layoutImprovPads(
        songRoot,
        songScale,
        octave,
        songSeed?.walk ?? null,
      ),
    [songRoot, songScale, octave, songSeed],
  )
  const bySlot = useMemo(() => {
    const m = new Map(pads.map((p) => [p.slot, p]))
    return m
  }, [pads])

  const hitsRef = useRef<ImprovHit[]>([])
  const [hitCount, setHitCount] = useState(0)
  const activePadRef = useRef<number | null>(null)
  const pendingRef = useRef<{ note: string; cycle: number; at: number; velocity: number } | null>(null)

  useEffect(() => () => stopImprovNote(), [])

  const padDown = useCallback(
    (slot: number, ev: React.PointerEvent) => {
      const pad = bySlot.get(slot)
      if (!pad?.enabled || !pad.note) return
      ev.currentTarget.setPointerCapture(ev.pointerId)
      activePadRef.current = slot
      setPressed(slot)
      const vel = padVelocity(ev.pressure, ev.pointerType, mix.velocity)
      startImprovNote(pad.note, voice, mix, vel)
      const playing = useSessionStore.getState().isPlaying
      const cycle = playing ? liveUpdateEngine.getCurrentCycle() : 0
      pendingRef.current = { note: pad.note, cycle, at: performance.now(), velocity: vel }
    },
    [bySlot, voice, mix],
  )

  const padUp = useCallback(() => {
    stopImprovNote()
    const pending = pendingRef.current
    pendingRef.current = null
    activePadRef.current = null
    setPressed(null)
    if (!pending) return
    const dur = Math.max(0.05, (performance.now() - pending.at) / 1000)
    hitsRef.current = [
      ...hitsRef.current,
      { note: pending.note, cycle: pending.cycle, dur, velocity: pending.velocity, at: pending.at },
    ]
    setHitCount(hitsRef.current.length)
  }, [])

  const onKeep = useCallback(() => {
    if (pendingRef.current) padUp()
    const hits = hitsRef.current
    if (hits.length === 0) return
    const session = useSessionStore.getState()
    const code = applyImprovMixToCode(
      hitsToNoteCode(hits, voice, session.bpm, micSampleDuration(voice)),
      mix,
    )
    const jam = useJamStore.getState()
    const id = session.addTrack({
      name: 'Pads',
      role: 'vox',
      code,
      color: ROLE_COLORS.vox,
      muted: false,
      soloed: false,
      locked: false,
      volume: mix.volume,
      octave: 0,
      error: null,
    })
    jam.touchTrack(id)
    jam.setSoundTrackId(null)
    jam.setCodeTrackId(null)
    jam.setImprovHold(null)
    jam.setLastPeek('Pads · kept')
    hitsRef.current = []
    setHitCount(0)
    if (session.isPlaying) {
      liveUpdateEngine.queueUpdate('immediate', 'jam')
    }
  }, [voice, mix, padUp])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-label="Pads"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl bg-bg-elevated border border-border overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-accent">Pads</div>
            <div className="text-sm font-semibold truncate text-text">
              Improv · {songRoot} {songScale}
            </div>
            <div className="text-[10px] text-text-muted truncate">
              Hold pads · Rec smears past the take
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-xl border border-border bg-bg overflow-hidden">
              <button
                type="button"
                className="min-h-11 min-w-11 text-sm font-medium text-text-muted hover:text-text"
                aria-label="Octave down"
                onClick={() => setOctave((o) => Math.max(1, o - 1))}
              >
                −
              </button>
              <span className="px-2 text-xs font-semibold tabular-nums text-text">
                oct {octave}
              </span>
              <button
                type="button"
                className="min-h-11 min-w-11 text-sm font-medium text-text-muted hover:text-text"
                aria-label="Octave up"
                onClick={() => setOctave((o) => Math.min(7, o + 1))}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 px-3 rounded-xl text-xs font-medium bg-bg text-text-muted border border-border hover:text-text"
            >
              Close
            </button>
          </div>
        </div>

        <div className="shrink-0 px-2 pt-2 overflow-x-auto">
          <div className="flex gap-1.5 pb-1 min-w-min">
            {voices.map((v) => {
              const id = v.sound ?? v.id
              const selected = id === voice
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoice(id)}
                  className={`shrink-0 min-h-9 px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                    selected
                      ? 'bg-accent/20 text-accent border-accent/40'
                      : 'bg-bg text-text-muted border-border hover:text-text'
                  }`}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 p-3">
          <div
            className="grid grid-cols-4 gap-2"
            onPointerLeave={padUp}
            onPointerCancel={padUp}
          >
            {RENDER_SLOTS.map((slot) => {
              const pad = bySlot.get(slot)!
              const dim = !pad.enabled
              const glow = pad.walkGlow
              const down = pressed === slot
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={dim}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    padDown(slot, e)
                  }}
                  onPointerUp={padUp}
                  className={`aspect-square rounded-2xl border text-sm font-semibold select-none touch-none transition-shadow ${
                    dim
                      ? 'opacity-25 bg-bg border-border cursor-not-allowed'
                      : down
                        ? 'bg-accent/30 border-accent text-text'
                        : glow
                          ? 'bg-purple-500/25 border-purple-400/70 text-text shadow-[0_0_18px_rgba(168,85,247,0.55)]'
                          : 'bg-bg border-border text-text-muted hover:border-accent/40'
                  }`}
                  style={
                    glow && !dim
                      ? { boxShadow: '0 0 22px 4px rgba(168, 85, 247, 0.55)' }
                      : undefined
                  }
                  aria-label={pad.enabled ? pad.label : `empty slot ${slot}`}
                >
                  {pad.enabled ? (
                    <span className={glow ? 'text-base' : 'text-xs opacity-80'}>
                      {pad.label}
                    </span>
                  ) : (
                    <span className="sr-only">disabled</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>


        <div className="shrink-0 px-3 pb-2 space-y-2 max-h-[28vh] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Vol</span>
              <span className="text-[10px] text-text-muted tabular-nums">{mix.volume}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={mix.volume}
              onChange={(e) =>
                setMix((m) => ({ ...m, volume: Number(e.target.value) }))
              }
              className="w-full accent-[var(--color-accent,#a78bfa)]"
              aria-label="Pad volume"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {IMPROV_VOL_STEPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMix((m) => ({ ...m, volume: v }))}
                  className={`min-h-8 px-2 rounded-lg text-[11px] border ${
                    Math.abs(mix.volume - v) < 0.001
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border text-text-muted'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Vel</span>
              <span className="text-[10px] text-text-muted tabular-nums">{mix.velocity}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {IMPROV_VEL_STEPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMix((m) => ({ ...m, velocity: v }))}
                  className={`min-h-8 px-2 rounded-lg text-[11px] border ${
                    Math.abs(mix.velocity - v) < 0.001
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border text-text-muted'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          {IMPROV_FX_CONTROLS.map((fx) => {
            const current = mix[fx.key]
            const on = isImprovFxOn(fx.key, current)
            return (
              <div key={fx.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">
                    {fx.label}
                  </span>
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {on ? current : '—'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {fx.steps.map((v) => {
                    const selected = on && current === v
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setMix((m) => ({
                            ...m,
                            [fx.key]: selected ? fx.off : v,
                          }))
                        }
                        className={`min-h-8 px-2 rounded-lg text-[11px] border ${
                          selected
                            ? 'border-accent bg-accent/20 text-accent'
                            : 'border-border text-text-muted'
                        }`}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-border">
          <button
            type="button"
            disabled={hitCount === 0}
            onClick={onKeep}
            className="flex-1 min-h-11 rounded-xl text-xs font-semibold bg-accent/20 text-accent border border-accent/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Keep{hitCount > 0 ? ` · ${hitCount}` : ''}
          </button>
          <span className="text-[10px] text-text-muted whitespace-nowrap">
            {isPlaying ? 'over the jam' : 'one-shots'}
          </span>
        </div>
      </div>
    </div>
  )
}
