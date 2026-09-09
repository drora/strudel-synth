import { useEffect, useRef, useState, useCallback } from 'react'
import { PlayButton } from './PlayButton'
import { BpmControl } from './BpmControl'
import { TransportViz } from './TransportViz'
import { SampleLoadingIndicator } from './SampleLoadingIndicator'
import { useSessionStore } from '../../store/session-store'
import { useUIStore, QUANT_OPTIONS } from '../../store/ui-store'
import type { Quantization } from '../../engine/live-update'
import { liveUpdateEngine } from '../../engine/live-update'
import { composeTracks, initEngine, evaluateCode, maybeLoadCommunityBanks } from '../../engine/strudel'
import { ensureAudioUnlocked, getAudioContextState } from '../../engine/audio-context'
import { ArrangementLite, SessionControls, useSessionManager } from '../session/SessionManager'

interface TransportBarProps {
  onToggleDocs?: () => void
  onToggleCheatsheet?: () => void
  onTogglePiano?: () => void
  onToggleRecorder?: () => void
  isMobile?: boolean
}

async function startOrQueueUpdate(quant: Quantization) {
  const state = useSessionStore.getState()
  if (state.isPlaying) {
    liveUpdateEngine.queueUpdate(quant, 'manual')
    return
  }
  const unlock = await ensureAudioUnlocked()
  if (!unlock.ok) {
    useUIStore.getState().setAudioError('Tap Play again — iOS blocked audio')
    return
  }
  useUIStore.getState().setAudioError(null)
  await initEngine()
  await ensureAudioUnlocked()
  state.setPlaying(true)
  liveUpdateEngine.markPlayStarted()
  const code = composeTracks(state.tracks, state.bpm)
  await evaluateCode(code)
  liveUpdateEngine.markPlayStarted()
  maybeLoadCommunityBanks()
}



function AudioBadge() {
  const [state, setState] = useState(() => getAudioContextState())
  const audioError = useUIStore((s) => s.audioError)
  useEffect(() => {
    const id = window.setInterval(() => setState(getAudioContextState()), 800)
    return () => window.clearInterval(id)
  }, [])
  const running = state === 'running'
  const label = audioError ? 'blocked' : state === 'missing' ? 'audio' : state
  return (
    <button
      type="button"
      title={audioError ?? `AudioContext: ${state}`}
      onClick={() => { if (audioError) useUIStore.getState().setAudioError(null) }}
      className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-medium border ${
        audioError ? 'border-error/40 text-error bg-error/10' : running ? 'border-success/30 text-success/80 bg-success/10' : 'border-border text-text-muted bg-bg-elevated'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${audioError ? 'bg-error' : running ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
      {label}
    </button>
  )
}

function ShareLinkButton({ className }: { className?: string }) {
  const { copyShareLink } = useSessionManager()
  const [label, setLabel] = useState('Copy share link')
  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={async () => {
        const r = await copyShareLink()
        setLabel(r === 'fail' ? 'Hash set — copy address' : 'Link copied')
        window.setTimeout(() => setLabel('Copy share link'), 1500)
      }}
    >
      {label}
    </button>
  )
}

export function TransportBar({
  onToggleDocs,
  onToggleCheatsheet,
  onTogglePiano,
  onToggleRecorder,
  isMobile,
}: TransportBarProps) {
  const tracks = useSessionStore((s) => s.tracks)
  const activeTrackId = useSessionStore((s) => s.activeTrackId)
  const activeTrack = tracks.find((t) => t.id === activeTrackId)
  const anyLocked = tracks.some((t) => t.locked)
  const anyMuted = tracks.some((t) => t.muted)
  const defaultQuantization = useUIStore((s) => s.defaultQuantization)
  const crossfadeSwaps = useUIStore((s) => s.crossfadeSwaps)
  const effectiveQuant = useUIStore((s) => s.getEffectiveQuantization(activeTrackId))
  const audioError = useUIStore((s) => s.audioError)
  const quantShort =
    QUANT_OPTIONS.find((o) => o.value === effectiveQuant)?.short ?? effectiveQuant

  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  const handleLockAll = () => useSessionStore.getState().lockAll()

  const handleMuteAll = () => {
    const state = useSessionStore.getState()
    state.tracks.forEach((t) => {
      if (anyMuted && t.muted) state.toggleMute(t.id)
      if (!anyMuted && !t.muted) state.toggleMute(t.id)
    })
  }

  const handleActiveUpdate = useCallback(async () => {
    if (!activeTrackId) return
    try {
      const q = useUIStore.getState().getEffectiveQuantization(activeTrackId)
      await startOrQueueUpdate(q)
      useSessionStore.getState().setError(activeTrackId, null)
    } catch (err) {
      useSessionStore.getState().setError(
        activeTrackId,
        err instanceof Error ? err.message : String(err),
      )
    }
  }, [activeTrackId])

  const handleActiveLock = useCallback(() => {
    if (activeTrackId) useSessionStore.getState().toggleLock(activeTrackId)
  }, [activeTrackId])

  const hit = isMobile ? 'min-h-11 min-w-11 px-3 py-2 text-xs' : 'px-2 py-1 text-xs'
  const hitSm = isMobile ? 'min-h-11 px-3 py-2 text-xs' : 'px-2 py-1 text-[10px]'

  const secondaryToggles = (
    <>
      <button
        onClick={onTogglePiano}
        className={`${hitSm} text-text-muted hover:text-accent rounded transition-colors`}
        title="Toggle piano keyboard"
      >
        Keys
      </button>
      <button
        onClick={onToggleRecorder}
        className={`${hitSm} text-text-muted hover:text-accent rounded transition-colors`}
        title="Voice recorder"
      >
        Rec
      </button>
      <button
        onClick={onToggleDocs}
        className={`${hitSm} text-text-muted hover:text-accent rounded transition-colors`}
        title="Toggle right panel"
      >
        Panel
      </button>
      <button
        onClick={onToggleCheatsheet}
        className={`${hitSm} text-text-muted hover:text-accent rounded transition-colors`}
        title="Cheatsheet (Cmd+/)"
      >
        ?
      </button>
      <button
        onClick={() => useUIStore.getState().setAppMode('learn')}
        className={`${hitSm} font-medium text-text-muted hover:text-accent bg-bg-elevated hover:bg-accent/10 rounded transition-colors`}
        title="Switch to Learn Mode"
      >
        Learn
      </button>
    </>
  )

  return (
    <div className="shrink-0 flex flex-col">
      {audioError && (
        <div role="status" className="px-3 py-2 text-xs text-error bg-error/10 border-t border-error/30 flex items-center justify-between gap-2">
          <span>{audioError}</span>
          <button type="button" className="text-error/80 hover:text-error underline shrink-0" onClick={() => useUIStore.getState().setAudioError(null)}>Dismiss</button>
        </div>
      )}
    <div
      className={`flex items-center bg-bg-surface/95 backdrop-blur-md border-t border-border shrink-0 ${
        isMobile ? 'flex-wrap gap-2 px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]' : 'h-14 gap-4 px-4'
      }`}
    >
      {/* Play / Stop — primary thumb target */}
      <PlayButton large={!!isMobile} />
      <AudioBadge />

      {/* BPM */}
      <BpmControl compact={!!isMobile} />

      {!isMobile && <div className="w-px h-6 bg-border" />}

      {/* Mobile thumb primaries: Update + Lock for active track */}
      {isMobile && (
        <>
          <button
            type="button"
            disabled={!activeTrack}
            onClick={() => void handleActiveUpdate()}
            className={`${hit} font-medium rounded transition-colors disabled:opacity-40 bg-accent/20 text-accent`}
            title={`Update active track (${effectiveQuant})`}
          >
            Update ·{quantShort}
          </button>
          <button
            type="button"
            disabled={!activeTrack}
            onClick={handleActiveLock}
            className={`${hit} rounded transition-colors disabled:opacity-40 flex items-center justify-center ${
              activeTrack?.locked
                ? 'bg-accent/30 text-accent'
                : 'bg-bg-elevated text-text-muted'
            }`}
            title="Lock / unlock active track"
          >
            {activeTrack?.locked ? '🔒' : '🔓'}
          </button>
        </>
      )}

      {/* Desktop: Lock All / Mute All / Quant / Crossfade stub */}
      {!isMobile && (
        <>
          <button
            onClick={handleLockAll}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
              anyLocked
                ? 'bg-accent/20 text-accent'
                : 'bg-bg-elevated text-text-muted hover:text-text'
            }`}
            title="Lock/unlock all tracks (Ctrl+Shift+L)"
          >
            {anyLocked ? 'Unlock All' : 'Lock All'}
          </button>

          <button
            onClick={handleMuteAll}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              anyMuted
                ? 'bg-error/20 text-error'
                : 'bg-bg-elevated text-text-muted hover:text-text'
            }`}
            title="Mute/unmute all tracks"
          >
            {anyMuted ? 'Unmute All' : 'Mute All'}
          </button>

          <label
            className="flex items-center gap-1 text-[10px] text-text-muted"
            title="Default quantization for Update / Lock / hotkeys"
          >
            <span className="hidden sm:inline">Quant</span>
            <select
              value={defaultQuantization}
              onChange={(e) =>
                useUIStore.getState().setDefaultQuantization(e.target.value as Quantization)
              }
              className="bg-bg-elevated text-text text-[10px] rounded px-1.5 py-1 border border-border focus:outline-none focus:border-accent"
            >
              {QUANT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.short === '∞' ? 'now' : o.short}
                </option>
              ))}
            </select>
          </label>

          {/*
            Crossfade swaps — STUBBED disabled.
            Strudel's xfade(left, amount, right) blends two concurrent patterns; it is not
            a compose/evaluate swap transition API. Enabling would invent broken audio wiring.
          */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Crossfade swaps unavailable — Strudel xfade() is concurrent blend, not a pattern-swap API"
            className="px-2 py-1 text-[10px] rounded bg-bg-elevated text-text-muted/50 cursor-not-allowed line-through decoration-text-muted/40"
          >
            Crossfade{crossfadeSwaps ? ' on' : ''}
          </button>
        </>
      )}

      {/* Sample loading progress */}
      <SampleLoadingIndicator />

      {!isMobile && (
        <>
          <div className="w-px h-6 bg-border" />
          <ArrangementLite compact />
          <ShareLinkButton className="px-2 py-1 text-[10px] rounded bg-bg-elevated text-accent hover:bg-accent/15" />
        </>
      )}

      {/* Beat visualizer + track dots */}
      <div className={`flex-1 flex items-center justify-center ${isMobile ? 'min-w-[4rem]' : ''}`}>
        <TransportViz />
      </div>

      {/* Desktop secondary toggles inline; mobile → More menu */}
      {isMobile ? (
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`${hit} rounded bg-bg-elevated text-text-muted hover:text-text`}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            title="More controls"
          >
            More
          </button>
          {moreOpen && (
            <div
              role="menu"
              className="absolute right-0 bottom-full mb-2 z-50 min-w-[12rem] rounded-xl border border-border bg-bg-surface shadow-2xl py-2"
            >
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-text-muted">
                Jam
              </div>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/15 text-text"
                onClick={() => {
                  handleLockAll()
                  setMoreOpen(false)
                }}
              >
                {anyLocked ? 'Unlock All' : 'Lock All'}
              </button>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/15 text-text"
                onClick={() => {
                  handleMuteAll()
                  setMoreOpen(false)
                }}
              >
                {anyMuted ? 'Unmute All' : 'Mute All'}
              </button>
              <div className="px-3 py-2 flex items-center gap-2 text-sm text-text-muted">
                <span>Quant</span>
                <select
                  value={defaultQuantization}
                  onChange={(e) =>
                    useUIStore.getState().setDefaultQuantization(e.target.value as Quantization)
                  }
                  className="flex-1 bg-bg-elevated text-text text-sm rounded px-2 py-1.5 border border-border min-h-11"
                >
                  {QUANT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border-t border-border my-1" />
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-text-muted">
                Panels
              </div>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/15 text-text"
                onClick={() => {
                  onTogglePiano?.()
                  setMoreOpen(false)
                }}
              >
                Keys
              </button>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/15 text-text"
                onClick={() => {
                  onToggleRecorder?.()
                  setMoreOpen(false)
                }}
              >
                Rec
              </button>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/15 text-text"
                onClick={() => {
                  onToggleDocs?.()
                  setMoreOpen(false)
                }}
              >
                Panel / FX
              </button>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/15 text-text"
                onClick={() => {
                  onToggleCheatsheet?.()
                  setMoreOpen(false)
                }}
              >
                Cheatsheet (?)
              </button>
              <div className="border-t border-border my-1" />
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-text-muted">
                Session / Producer
              </div>
              <div className="px-1 pb-1 [&_.border-b]:border-0">
                <SessionControls showArrangement />
              </div>
              <div className="border-t border-border my-1" />
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/15 text-accent font-medium"
                onClick={() => {
                  useUIStore.getState().setAppMode('learn')
                  setMoreOpen(false)
                }}
              >
                Learn
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {secondaryToggles}
        </>
      )}
    </div>
    </div>
  )
}
