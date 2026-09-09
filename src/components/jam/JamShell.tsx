import { VIBES } from '../../engine/kits'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import { useUIStore } from '../../store/ui-store'
import { PlayButton } from '../transport/PlayButton'
import { SampleLoadingIndicator } from '../transport/SampleLoadingIndicator'
import { JamTrackSheet } from './JamTrackSheet'
import { JamCodeSheet } from './JamCodeSheet'
import { JamDealStrip } from './JamDealStrip'
import { JamKitPicker } from './JamKitPicker'
import { JamAddTrack } from './JamAddTrack'
import { JamPhaseRing } from './JamPhaseRing'
import { JamMicRec } from './JamMicRec'
import { JamABToggle } from './JamABToggle'
import { useJamShell } from './useJamShell'
import { JamTrackChip } from './JamTrackChip'
import { usePlayingLoopPhase } from '../../hooks/useLoopPhase'

function openCodeForTrack(trackId: string | null | undefined) {
  if (!trackId) return
  useSessionStore.getState().setActiveTrack(trackId)
  useJamStore.getState().setCodeTrackId(trackId)
}

export function JamShell() {
  const j = useJamShell()
  const { phase } = usePlayingLoopPhase()
  const codeTrackId = useJamStore((s) => s.codeTrackId)
  const codeTrack = j.tracks.find((t) => t.id === codeTrackId)

  return (
    <div
      className={`flex flex-col bg-bg w-full flex-1 text-text ${j.isMobile ? 'min-h-0 overflow-hidden' : 'h-full'}`}
      style={j.shellStyle}
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div>
          <div className="text-sm font-semibold tracking-wide">Strudel Studio</div>
          <div className="text-[10px] uppercase tracking-wider text-accent">Jam</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-h-11 px-3 rounded-lg text-xs font-medium bg-bg-elevated text-text-muted border border-border hover:text-accent"
            onClick={() => {
              const active =
                useSessionStore.getState().activeTrackId ?? j.tracks[0]?.id ?? null
              openCodeForTrack(active)
            }}
            title="Edit active track code"
          >
            {'</>'} Code
          </button>
          <button
            type="button"
            className="min-h-11 px-3 rounded-lg text-xs font-medium bg-bg-elevated text-text-muted border border-border hover:text-accent"
            onClick={() => useUIStore.getState().setAppMode('learn')}
          >
            Learn
          </button>
        </div>
      </header>

      {j.showKitLoadingBanner && (
        <div
          className="shrink-0 px-3 py-2 bg-accent/15 border-b border-accent/30 text-accent text-xs font-medium flex items-center justify-between gap-2"
          role="status"
          aria-live="polite"
        >
          <span className="animate-pulse">Loading kit samples…</span>
          <SampleLoadingIndicator compact />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {VIBES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => j.onVibe(v.id)}
              className={`shrink-0 min-h-11 px-3 rounded-full text-xs font-medium border transition-colors ${
                j.vibe === v.id
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-bg-elevated text-text-muted border-border hover:border-accent/40'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => useJamStore.getState().setShowKitPicker(true)}
            className="flex-1 min-h-12 px-4 rounded-xl border border-accent/40 bg-accent/10 text-left flex items-center justify-between gap-2 hover:border-accent transition-colors"
          >
            <span className="text-sm font-medium text-accent truncate">
              Kit · {j.activeKit?.name ?? 'Pick one'}
            </span>
            <span className="text-accent shrink-0" aria-hidden>
              ▾
            </span>
          </button>
          <JamABToggle />
        </div>

        <div className="flex flex-col items-center py-2">
          <JamPhaseRing bpm={j.bpm} isPlaying={j.isPlaying} />
          {j.showKitLoadingBanner && (
            <div className="mt-2 text-[11px] text-accent animate-pulse font-medium">
              Loading kit samples…
            </div>
          )}
          <div className="mt-3 w-full max-w-sm">
            <div className="text-[10px] uppercase tracking-wider text-text-muted text-center mb-1.5">
              Sounds / FX · tap · M mute · long-press Code
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {j.tracks.map((t) => (
                <JamTrackChip
                  key={t.id}
                  track={t}
                  phase={phase}
                  isPlaying={j.isPlaying}
                />
              ))}
              <JamAddTrack />
            </div>
          </div>
        </div>

        <JamDealStrip
          missionDeal={j.missionDeal}
          mutationDeal={j.mutationDeal}
          lastPeek={j.lastPeek}
          undoLen={j.undoLen}
          onMission={j.onMission}
          onMutation={j.onMutation}
          onUndo={j.onUndo}
          onRedeal={j.redeal}
        />
      </div>

      <div className="shrink-0 border-t border-border px-3 py-2 flex flex-col gap-1.5 safe-pb">
        {(j.showKitLoadingBanner || (j.sampleLoading.totalBanks > 0 && !j.sampleLoading.done)) && (
          <div className="flex items-center justify-between gap-2 px-1">
            <SampleLoadingIndicator compact />
            {j.showKitLoadingBanner && (
              <span className="text-[10px] text-accent whitespace-nowrap font-medium">
                Loading kit samples…
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <PlayButton large={!!j.isMobile} />
          <JamMicRec large={!!j.isMobile} />
          <button
            type="button"
            onClick={j.onShuffle}
            className="min-h-11 flex-1 rounded-xl text-xs font-medium bg-bg-elevated border border-border"
          >
            Shuffle{j.lockKit ? '' : ' ✶'}
          </button>
          <button
            type="button"
            onClick={j.onNewKit}
            className="min-h-11 px-3 rounded-xl text-xs font-medium bg-bg-elevated border border-border"
          >
            New kit
          </button>
          <button
            type="button"
            onClick={j.onSpice}
            className="min-h-11 px-3 rounded-xl text-xs font-medium bg-accent/20 text-accent border border-accent/30"
          >
            Spice
          </button>
          <button
            type="button"
            onClick={() => useJamStore.getState().setLockKit(!j.lockKit)}
            className="min-h-11 px-2 rounded-xl text-[10px] border border-border text-text-muted"
            title="Lock kit on Shuffle"
          >
            {j.lockKit ? '🔒' : '🔓'}
          </button>
        </div>
      </div>

      {j.showKitPicker && (
        <JamKitPicker
          kits={j.kits}
          kitId={j.kitId}
          onPick={(id) => j.applyKit(id, true)}
          onSkip={() => {
            useJamStore.getState().setShowKitPicker(false)
            useJamStore.getState().setHasPickedKit(true)
          }}
        />
      )}

      {j.soundTrack && <JamTrackSheet track={j.soundTrack} />}
      {codeTrack && <JamCodeSheet track={codeTrack} />}
    </div>
  )
}
