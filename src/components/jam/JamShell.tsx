import { useEffect, useCallback, useMemo, useState } from 'react'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { useJamStore } from '../../store/jam-store'
import {
  VIBES,
  getKitsForVibe,
  getKit,
  kitToTemplate,
  SOUND_CHOICES,
  applySoundChoiceToCode,
  type VibeId,
  type SoundChoice,
} from '../../engine/kits'
import { suggestMutations, applyMutationToTracks, type MutationCard } from '../../engine/mutators'
import { reshuffleTrack } from '../../engine/reshuffle'
import { liveUpdateEngine } from '../../engine/live-update'
import { PlayButton } from '../transport/PlayButton'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useVisualViewportHeight } from '../../hooks/useVisualViewport'

function queueJam(reason: 'kit' | 'jam' | 'reshuffle' = 'jam') {
  if (!useSessionStore.getState().isPlaying) return
  const q = useUIStore.getState().getEffectiveQuantization(
    useSessionStore.getState().activeTrackId,
  )
  liveUpdateEngine.queueUpdate(q, reason)
}

export function JamShell() {
  const isMobile = useIsMobile()
  const vvHeight = useVisualViewportHeight()
  const tracks = useSessionStore((s) => s.tracks)
  const bpm = useSessionStore((s) => s.bpm)
  const isPlaying = useSessionStore((s) => s.isPlaying)

  const vibe = useJamStore((s) => s.vibe)
  const kitId = useJamStore((s) => s.kitId)
  const lockKit = useJamStore((s) => s.lockKit)
  const showKitPicker = useJamStore((s) => s.showKitPicker)
  const hasPickedKit = useJamStore((s) => s.hasPickedKit)
  const mutationDeal = useJamStore((s) => s.mutationDeal)
  const lastPeek = useJamStore((s) => s.lastPeek)
  const soundTrackId = useJamStore((s) => s.soundTrackId)

  const kits = useMemo(() => getKitsForVibe(vibe), [vibe])
  const activeKit = kitId ? getKit(kitId) : undefined
  const soundTrack = tracks.find((t) => t.id === soundTrackId)

  const [cyclePulse, setCyclePulse] = useState(0)
  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => setCyclePulse((n) => (n + 1) % 1000), 500)
    return () => window.clearInterval(id)
  }, [isPlaying])

  const redeal = useCallback(() => {
    const cards = suggestMutations(useSessionStore.getState().tracks, 3)
    useJamStore.getState().setMutationDeal(cards)
  }, [])

  const applyKit = useCallback((id: string, fromPicker = false) => {
    const kit = getKit(id)
    if (!kit) return
    const template = kitToTemplate(kit)
    useSessionStore.getState().loadTemplate(template)
    const jam = useJamStore.getState()
    jam.setKitId(kit.id)
    jam.setVibe(kit.vibe)
    jam.setHasPickedKit(true)
    if (fromPicker) jam.setShowKitPicker(false)
    jam.setLastPeek(`kit · ${kit.name}`)
    jam.setMutationDeal(suggestMutations(useSessionStore.getState().tracks, 3))
    queueJam('kit')
  }, [])

  // Seed default kit when entering jam with empty session
  useEffect(() => {
    if (tracks.length === 0) {
      const first = getKitsForVibe(vibe)[0]
      if (first) applyKit(first.id)
    } else if (mutationDeal.length === 0) {
      redeal()
    }
    if (!hasPickedKit) {
      useJamStore.getState().setShowKitPicker(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onVibe = (v: VibeId) => {
    useJamStore.getState().setVibe(v)
    const list = getKitsForVibe(v)
    const preferred = list.find((k) => k.id === kitId) ?? list[0]
    if (preferred) applyKit(preferred.id)
  }

  const onMutation = (card: MutationCard) => {
    const state = useSessionStore.getState()
    const result = applyMutationToTracks(state.tracks, card)
    if (!result) {
      redeal()
      return
    }
    const prev = state.tracks.find((t) => t.id === result.trackId)
    if (prev) {
      useJamStore.getState().pushUndo({
        trackId: prev.id,
        code: prev.code,
        label: card.label,
      })
    }
    state.setCode(result.trackId, result.code)
    useJamStore.getState().setLastPeek(`${card.label}`)
    liveUpdateEngine.markDirty()
    queueJam('jam')
    redeal()
  }

  const onUndo = () => {
    const entry = useJamStore.getState().popUndo()
    if (!entry) return
    useSessionStore.getState().setCode(entry.trackId, entry.code)
    useJamStore.getState().setLastPeek(`Undo · ${entry.label}`)
    queueJam('jam')
  }

  const onShuffle = () => {
    const state = useSessionStore.getState()
    const pinEffects = useUIStore.getState().pinEffects
    const jam = useJamStore.getState()
    for (const t of state.tracks) {
      if (t.locked) continue
      const next = reshuffleTrack(t.role, t.code, {
        pinEffects,
        lockKit: jam.lockKit,
        bank: jam.lockKit ? activeKit?.drumsBank : undefined,
      })
      state.setCode(t.id, next)
    }
    jam.setLastPeek(jam.lockKit ? 'Shuffle · same kit' : 'Shuffle · free')
    queueJam('reshuffle')
    redeal()
  }

  const onNewKit = () => {
    const list = getKitsForVibe(vibe)
    if (list.length === 0) return
    const others = list.filter((k) => k.id !== kitId)
    const pick = others[Math.floor(Math.random() * Math.max(others.length, 1))] ?? list[0]
    applyKit(pick.id)
  }

  const onSpice = () => {
    // Light timbre nudge on active or first track
    const cards = suggestMutations(tracks, 1).filter((c) => c.kind === 'timbre')
    const card = cards[0] ?? suggestMutations(tracks, 1)[0]
    if (card) onMutation(card)
  }

  const applySound = (choice: SoundChoice) => {
    if (!soundTrack) return
    const jam = useJamStore.getState()
    jam.pushUndo({
      trackId: soundTrack.id,
      code: soundTrack.code,
      label: `Sound · ${choice.label}`,
    })
    const next = applySoundChoiceToCode(soundTrack.code, choice)
    useSessionStore.getState().setCode(soundTrack.id, next)
    jam.setLastPeek(choice.label)
    jam.setSoundTrackId(null)
    queueJam('kit')
  }

  const shellStyle = isMobile
    ? { height: vvHeight > 0 ? vvHeight : undefined, minHeight: 0 }
    : undefined

  return (
    <div
      className={`flex flex-col bg-bg w-full flex-1 text-text ${isMobile ? 'min-h-0 overflow-hidden' : 'h-full'}`}
      style={shellStyle}
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div>
          <div className="text-sm font-semibold tracking-wide">Strudel Studio</div>
          <div className="text-[10px] uppercase tracking-wider text-accent">Jam Mode</div>
        </div>
        <button
          type="button"
          className="min-h-11 px-3 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30"
          onClick={() => useUIStore.getState().setAppMode('studio')}
        >
          {'</>'} Code
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Vibe chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {VIBES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onVibe(v.id)}
              className={`shrink-0 min-h-11 px-3 rounded-full text-xs font-medium border transition-colors ${
                vibe === v.id
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-bg-elevated text-text-muted border-border hover:border-accent/40'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Kit hero — opens picker (obvious on phone) */}
        <button
          type="button"
          onClick={() => useJamStore.getState().setShowKitPicker(true)}
          className="w-full min-h-12 px-4 rounded-xl border border-accent/40 bg-accent/10 text-left flex items-center justify-between gap-2 hover:border-accent transition-colors"
        >
          <span className="text-sm font-medium text-accent truncate">
            Kit · {activeKit?.name ?? 'Pick one'}
          </span>
          <span className="text-accent shrink-0" aria-hidden>
            ▾
          </span>
        </button>

        {/* BPM ring */}
        <div className="flex flex-col items-center py-2">
          <div
            className="relative w-28 h-28 rounded-full border-2 border-accent/40 flex flex-col items-center justify-center"
            style={{
              boxShadow: isPlaying
                ? `0 0 ${12 + (cyclePulse % 8)}px rgba(167,139,250,0.35)`
                : undefined,
            }}
          >
            <span className="text-[10px] text-text-muted uppercase">BPM</span>
            <span className="text-2xl font-semibold tabular-nums">{bpm}</span>
          </div>
          {/* Track sound slots */}
          <div className="flex flex-wrap justify-center gap-1.5 mt-3 max-w-sm">
            {tracks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => useJamStore.getState().setSoundTrackId(t.id)}
                className="min-h-9 px-2.5 rounded-lg text-[10px] border border-border bg-bg-elevated"
                style={{ borderColor: t.color + '66', color: t.color }}
                title="Change sound"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Mutations */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Mutate</div>
            <button type="button" className="text-[10px] text-accent" onClick={redeal}>
              New cards
            </button>
          </div>
          <div className="space-y-2">
            {mutationDeal.map((card) => (
              <button
                key={card.id + card.label}
                type="button"
                onClick={() => onMutation(card)}
                className="w-full min-h-12 px-3 py-2 rounded-xl border border-border bg-bg-elevated text-left hover:border-accent/50 transition-colors"
              >
                <div className="text-sm font-medium">{card.label}</div>
                <div className="text-[10px] text-text-muted">
                  {card.detail}
                  <span className="ml-2 opacity-60">{card.kind}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Code peek */}
        {lastPeek && (
          <div className="text-[11px] px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent">
            {lastPeek}
            {useJamStore.getState().undoStack.length > 0 && (
              <button type="button" className="ml-3 underline" onClick={onUndo}>
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="shrink-0 border-t border-border px-3 py-2 flex items-center gap-2 safe-pb">
        <PlayButton large={!!isMobile} />
        <button
          type="button"
          onClick={onShuffle}
          className="min-h-11 flex-1 rounded-xl text-xs font-medium bg-bg-elevated border border-border"
        >
          Shuffle{lockKit ? '' : ' ✶'}
        </button>
        <button
          type="button"
          onClick={onNewKit}
          className="min-h-11 px-3 rounded-xl text-xs font-medium bg-bg-elevated border border-border"
        >
          New kit
        </button>
        <button
          type="button"
          onClick={onSpice}
          className="min-h-11 px-3 rounded-xl text-xs font-medium bg-accent/20 text-accent border border-accent/30"
        >
          Spice
        </button>
        <button
          type="button"
          onClick={() => useJamStore.getState().setLockKit(!lockKit)}
          className="min-h-11 px-2 rounded-xl text-[10px] border border-border text-text-muted"
          title="Lock kit on Shuffle"
        >
          {lockKit ? '🔒' : '🔓'}
        </button>
      </div>

      {/* Kit picker sheet */}
      {showKitPicker && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl bg-bg-elevated border border-border p-4 space-y-3">
            <div className="text-sm font-semibold">Pick a kit</div>
            <p className="text-xs text-text-muted">
              Timbre is the difference — choose how this jam should sound.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {kits.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => applyKit(k.id, true)}
                  className={`min-h-14 px-3 py-3 rounded-xl border text-left transition-colors ${
                    kitId === k.id
                      ? 'border-accent bg-accent/15'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{k.description}</div>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="w-full min-h-11 text-xs text-text-muted"
              onClick={() => {
                useJamStore.getState().setShowKitPicker(false)
                useJamStore.getState().setHasPickedKit(true)
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Sound sheet */}
      {soundTrack && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl bg-bg-elevated border border-border p-4 space-y-3">
            <div className="text-sm font-semibold" style={{ color: soundTrack.color }}>
              Sound · {soundTrack.name}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(SOUND_CHOICES[soundTrack.role] ?? SOUND_CHOICES.custom).map((c) => (
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
            <button
              type="button"
              className="w-full min-h-11 text-xs text-text-muted"
              onClick={() => useJamStore.getState().setSoundTrackId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
