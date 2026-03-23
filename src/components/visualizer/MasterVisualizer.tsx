import { useSessionStore } from '../../store/session-store'

/**
 * Strudel's built-in scope() and spectrum() functions render to canvas elements
 * that Strudel creates and manages in the page background automatically.
 * This component provides a container area and the cycle indicator.
 *
 * The actual audio visualizations (oscilloscope + spectrum analyzer) are
 * appended to the evaluated code via composeTracks() — they render as
 * full-width background canvases that Strudel positions at the bottom of the page.
 */
export function MasterVisualizer() {
  const isPlaying = useSessionStore((s) => s.isPlaying)

  if (!isPlaying) return null

  // Strudel renders scope/spectrum as background canvases automatically.
  // We just provide minimal spacing so they're visible above the transport bar.
  return (
    <div className="h-16 bg-bg border-t border-border/30 relative overflow-hidden">
      {/* Strudel's canvas visualizers render into the page background.
          This div ensures they have visible space above the transport bar. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] text-text-muted/30">scope + spectrum</span>
      </div>
    </div>
  )
}
