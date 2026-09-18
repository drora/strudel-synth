import { useMemo } from 'react'
import type { SoundChoice } from '../../engine/kits'
import { groupSoundChoices } from '../../engine/sound-families'

interface Props {
  title?: string
  choices: readonly SoundChoice[]
  isActive: (choice: SoundChoice) => boolean
  onChoose: (choice: SoundChoice) => void
  onClose: () => void
  closeOnChoose?: boolean
}

/** Shared family-grouped Sound picker used by track sheets and Pads. */
export function SoundPickerSheet({
  title = 'Choose sound',
  choices,
  isActive,
  onChoose,
  onClose,
  closeOnChoose = false,
}: Props) {
  const groups = useMemo(() => groupSoundChoices(choices), [choices])
  const current = choices.find(isActive)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl bg-bg-elevated border border-border overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-accent">Sound picker</div>
            <div className="text-sm font-semibold text-text">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 min-w-9 rounded-lg text-xs text-text-muted border border-border hover:text-text"
            aria-label="Close sound picker"
          >
            ✕
          </button>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-accent/10 border-b border-accent/20">
          <span className="text-[10px] uppercase tracking-wider text-accent">Now playing</span>
          <span className="text-sm font-semibold text-text truncate">
            {current?.label ?? 'Custom sound'}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
          {groups.map((group) => (
            <section key={group.family} aria-label={group.family}>
              <div className="sticky top-0 z-10 -mx-1 mb-2 px-1 py-1.5 bg-bg-elevated/95 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {group.family}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((choice) => {
                  const active = isActive(choice)
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => {
                        onChoose(choice)
                        if (closeOnChoose) onClose()
                      }}
                      aria-pressed={active}
                      className={`min-h-11 px-3 rounded-xl border text-xs text-left transition-colors ${
                        active
                          ? 'border-accent bg-accent/20 text-accent'
                          : 'border-border bg-bg text-text-muted hover:border-accent/50 hover:text-text'
                      }`}
                    >
                      {choice.label}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
