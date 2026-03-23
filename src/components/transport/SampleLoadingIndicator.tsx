import { useUIStore } from '../../store/ui-store'

export function SampleLoadingIndicator() {
  const { totalBanks, loadedBanks, failedBanks, done } = useUIStore((s) => s.sampleLoading)

  // Don't show if loading hasn't started or is finished
  if (totalBanks === 0) return null
  if (done) {
    return <DoneIndicator loaded={loadedBanks - failedBanks} failed={failedBanks} />
  }

  const pct = Math.round((loadedBanks / totalBanks) * 100)

  return (
    <div className="flex items-center gap-2 text-[10px] text-text-muted" title={`Loading community sample banks: ${loadedBanks}/${totalBanks}`}>
      <span className="whitespace-nowrap">Samples</span>
      <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
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
function DoneIndicator({ loaded, failed }: { loaded: number; failed: number }) {
  return (
    <div
      className="flex items-center gap-1 text-[10px] text-success animate-fade-out"
      title={`${loaded} sample banks loaded${failed ? `, ${failed} failed` : ''}`}
      style={{
        animation: 'fadeOut 1s ease-out 3s forwards',
      }}
    >
      <span>
        {loaded} banks loaded
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
