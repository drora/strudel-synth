import { useUIStore } from '../../store/ui-store'

export function SampleLoadingIndicator({ compact = false }: { compact?: boolean }) {
  const { totalBanks, loadedBanks, failedBanks, done, phase } = useUIStore((s) => s.sampleLoading)

  // Don't show if loading hasn't started
  if (totalBanks === 0 && phase === 'idle') return null
  if (done) {
    return <DoneIndicator loaded={loadedBanks - failedBanks} failed={failedBanks} phase={phase} />
  }
  // Prebake may paint before totals settle — still show a pulse label
  if (totalBanks === 0) {
    if (phase === 'prebake') {
      return (
        <div className="flex items-center gap-2 text-[10px] text-accent animate-pulse" title="Loading kit sample packs">
          <span className="whitespace-nowrap">{compact ? 'Sounds' : 'Loading kit samples…'}</span>
        </div>
      )
    }
    return null
  }

  const pct = Math.round((loadedBanks / Math.max(totalBanks, 1)) * 100)
  const label =
    phase === 'prebake' ? (compact ? 'Sounds' : 'Loading sounds') : (compact ? 'Samples' : 'Samples')

  return (
    <div
      className="flex items-center gap-2 text-[10px] text-text-muted"
      title={
        phase === 'prebake'
          ? `Loading kit sample packs: ${loadedBanks}/${totalBanks}`
          : `Loading community sample banks: ${loadedBanks}/${totalBanks}`
      }
    >
      <span className="whitespace-nowrap">{label}</span>
      <div className={`${compact ? 'w-12' : 'w-16'} h-1.5 bg-bg-elevated rounded-full overflow-hidden`}>
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums w-7 text-right">{pct}%</span>
    </div>
  )
}

/** Briefly shows a checkmark, then fades out after 4s */
function DoneIndicator({
  loaded,
  failed,
  phase,
}: {
  loaded: number
  failed: number
  phase: string
}) {
  const noun = phase === 'prebake' ? 'packs' : 'banks'
  return (
    <div
      className="flex items-center gap-1 text-[10px] text-success animate-fade-out"
      title={`${loaded} sample ${noun} loaded${failed ? `, ${failed} failed` : ''}`}
      style={{
        animation: 'fadeOut 1s ease-out 3s forwards',
      }}
    >
      <span>
        {loaded} {noun} loaded
      </span>
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; pointer-events: none; }
        }
        .animate-fade-out { opacity: 1; }
      `}</style>
    </div>
  )
}
