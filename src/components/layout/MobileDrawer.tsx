import type { ReactNode } from 'react'

export type MobileDrawerSide = 'left' | 'right' | 'bottom'

/**
 * Slide-in drawer / bottom sheet for mobile panels.
 * Extracted from AppShell so Studio + Learn can share the same pattern.
 */
export function MobileDrawer({
  open,
  onClose,
  side,
  children,
  /** Optional label for a11y */
  label,
}: {
  open: boolean
  onClose: () => void
  side: MobileDrawerSide
  children: ReactNode
  label?: string
}) {
  if (!open) return null

  const isBottom = side === 'bottom'

  return (
    <div
      className="fixed inset-0 z-40 flex"
      style={isBottom ? { alignItems: 'flex-end' } : undefined}
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative z-50 overflow-y-auto bg-bg-surface shadow-2xl ${
          isBottom
            ? 'w-full max-h-[75dvh] rounded-t-2xl ml-0 mr-0'
            : side === 'left'
              ? 'h-full mr-auto'
              : 'h-full ml-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isBottom && (
          <div className="sticky top-0 z-10 flex flex-col items-center pt-2 pb-1 bg-bg-surface">
            <div className="w-10 h-1 rounded-full bg-border" aria-hidden />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
