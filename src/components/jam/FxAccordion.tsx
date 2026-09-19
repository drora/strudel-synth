import { useState, type ReactNode } from 'react'
import {
  groupedFxControls,
  summarizeFxGroup,
  type FxGroupId,
} from '../../engine/improv-plate'

export type FxAccordionControl = {
  key: string
  label: string
  steps: number[]
  off?: number
  group?: FxGroupId
}

interface FxAccordionProps<T extends FxAccordionControl> {
  controls: T[]
  getValue: (key: string) => number | null | undefined
  renderControl: (control: T) => ReactNode
  /** Extra class on the chip stack (e.g. denser Pads spacing). */
  bodyClassName?: string
}

/**
 * Shared FX accordion for track FX tab + Pads FX panel.
 * Gain (ungrouped) stays always open; Filter/Envelope/Reverb/Delay collapse
 * to one summary row each, with one group open at a time.
 */
export function FxAccordion<T extends FxAccordionControl>({
  controls,
  getValue,
  renderControl,
  bodyClassName = 'space-y-2',
}: FxAccordionProps<T>) {
  const [openGroup, setOpenGroup] = useState<FxGroupId | null>(null)
  const rows = groupedFxControls(controls)

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const body = (
          <div className={bodyClassName}>
            {row.items.map((fx) => (
              <div key={fx.key}>{renderControl(fx)}</div>
            ))}
          </div>
        )

        if (!row.group || !row.label) {
          return <div key={row.items[0]!.key}>{body}</div>
        }

        const { text, active } = summarizeFxGroup(row.label, row.items, getValue)
        const open = openGroup === row.group

        return (
          <div
            key={row.group}
            className={`rounded-xl border px-2.5 py-2 ${
              active ? 'border-accent/40' : 'border-border'
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setOpenGroup((cur) => (cur === row.group ? null : row.group))
              }
              className="w-full flex items-center gap-2 min-h-9 text-left"
              aria-expanded={open}
            >
              <span
                className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                  active ? 'bg-accent' : 'bg-border'
                }`}
                aria-hidden
              />
              <span
                className={`flex-1 text-[11px] font-medium truncate ${
                  active ? 'text-accent' : 'text-text-muted'
                }`}
              >
                {open ? row.label : text}
              </span>
              <span className="shrink-0 text-[10px] text-text-muted tabular-nums">
                {open ? '▾' : '▸'}
              </span>
            </button>
            {open && <div className="mt-2">{body}</div>}
          </div>
        )
      })}
    </div>
  )
}
