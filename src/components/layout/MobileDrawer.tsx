import type { ReactNode } from 'react'

export type MobileDrawerSide = 'left' | 'right' | 'bottom'

/**
 * Slide-in drawer / bottom sheet for mobile panels.
 * Blur backdrop, rounded top sheet, safe-area padding.
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
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-md"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative z-50 overflow-y-auto bg-bg-surface/95 backdrop-blur-xl shadow-2xl border-border ${
          isBottom
            ? 'w-full max-h-[75dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]'
            : side === 'left'
              ? 'h-full mr-auto border-r pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
              : 'h-full ml-auto border-l pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isBottom && (
          <div className="sticky top-0 z-10 flex flex-col items-center pt-2.5 pb-1.5 bg-bg-surface/95 backdrop-blur-xl">
            <div className="w-10 h-1 rounded-full bg-border" aria-hidden />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
