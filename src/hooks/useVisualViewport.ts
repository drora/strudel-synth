import { useEffect, useState } from 'react'

/**
 * Soft-keyboard–friendly viewport height (CSS px).
 * Falls back to window.innerHeight when visualViewport is unavailable.
 * Used by AppShell / LearnShell so layout tracks the *visible* area instead of
 * fighting html/body overflow:hidden when the mobile keyboard opens.
 */
export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window !== 'undefined'
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 0,
  )

  useEffect(() => {
    const vv = window.visualViewport
    const update = () => {
      setHeight(vv?.height ?? window.innerHeight)
    }
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return height
}
