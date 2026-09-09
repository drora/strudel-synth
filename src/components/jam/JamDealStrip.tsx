import type { MutationCard } from '../../engine/mutators'
import type { MissionCard } from '../../engine/missions'
import { useJamStore } from '../../store/jam-store'
import { useSessionStore } from '../../store/session-store'
import { suggestMissions } from '../../engine/missions'

interface Props {
  missionDeal: MissionCard[]
  mutationDeal: MutationCard[]
  lastPeek: string | null
  undoLen: number
  onMission: (m: MissionCard) => void
  onMutation: (c: MutationCard) => void
  onUndo: () => void
  onRedeal: () => void
}

export function JamDealStrip({
  missionDeal,
  mutationDeal,
  lastPeek,
  undoLen,
  onMission,
  onMutation,
  onUndo,
  onRedeal,
}: Props) {
  return (
    <>
      {/* Missions strip */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Mission</div>
          <button
            type="button"
            className="text-[10px] text-accent"
            onClick={() =>
              useJamStore
                .getState()
                .setMissionDeal(suggestMissions(useSessionStore.getState().tracks, 2))
            }
          >
            New
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {missionDeal.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onMission(m)}
              className="min-h-11 px-3 py-2 rounded-xl border border-accent/25 bg-accent/5 text-left hover:border-accent/60 transition-colors"
            >
              <div className="text-xs font-semibold text-accent">{m.label}</div>
              <div className="text-[10px] text-text-muted">{m.goal}</div>
            </button>
          ))}
          {missionDeal.length === 0 && (
            <div className="text-[10px] text-text-muted col-span-full">No missions — tap New</div>
          )}
        </div>
      </div>

      {/* Mutations */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Mutate</div>
          <button type="button" className="text-[10px] text-accent" onClick={onRedeal}>
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
          {undoLen > 0 && (
            <button type="button" className="ml-3 underline" onClick={onUndo}>
              Undo
            </button>
          )}
        </div>
      )}
    </>
  )
}
