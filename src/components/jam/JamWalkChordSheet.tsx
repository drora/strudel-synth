import { useMemo } from 'react'
import { setWalkCenter } from '../../engine/jam-actions'
import { formatLegalWalkChords, type WalkCenter } from '../../engine/song-seed'
import { useJamStore } from '../../store/jam-store'

interface Props {
  index: number
  onClose: () => void
}

/**
 * Tap picker for one walk-slot chord — legal centers for current root+scale.
 * Mirrors Mutate / Pads bottom-sheet chrome.
 */
export function JamWalkChordSheet({ index, onClose }: Props) {
  const songSeed = useJamStore((s) => s.songSeed)

  const options = useMemo(() => {
    if (!songSeed || index < 0 || index >= songSeed.walk.length) return []
    return formatLegalWalkChords(songSeed.root, songSeed.scale, songSeed.walk, index)
  }, [songSeed, index])

  const current = songSeed?.walk[index]
  const currentKey = current ? `${current.degree}:${current.quality}` : ''

  const onPick = (center: WalkCenter) => {
    setWalkCenter(index, center)
    onClose()
  }

  if (!songSeed) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-label={`Pick walk chord ${index + 1}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[70dvh] flex flex-col rounded-2xl bg-bg-elevated border border-border overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-accent">Walk chord</div>
            <div className="text-sm font-semibold truncate text-text">
              Slot {index + 1} · {songSeed.root} {songSeed.scale.replace('_', ' ')}
            </div>
            <div className="text-[10px] text-text-muted truncate">
              Legal in-scale centers only
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 px-3 rounded-xl text-xs font-medium bg-bg text-text-muted border border-border hover:text-text"
          >
            Close
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 grid grid-cols-3 gap-1.5">
          {options.map(({ center, label }) => {
            const key = `${center.degree}:${center.quality}`
            const selected = key === currentKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPick(center)}
                className={
                  selected
                    ? 'min-h-12 rounded-xl border border-accent bg-accent/15 text-accent text-sm font-semibold'
                    : 'min-h-12 rounded-xl border border-border bg-bg text-text text-sm font-medium hover:border-accent hover:text-accent'
                }
                aria-pressed={selected}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
