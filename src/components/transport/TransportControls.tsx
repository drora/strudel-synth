import { PlayButton } from './PlayButton'
import { StopButton } from './StopButton'

/** Paired Play/Pause + Stop cluster for the Jam footer transport row. */
export function TransportControls({
  large = false,
  fill = false,
}: {
  large?: boolean
  fill?: boolean
}) {
  return (
    <div
      className={`flex items-stretch gap-1 min-w-0 ${fill ? 'w-full' : ''}`}
      role="group"
      aria-label="Transport"
    >
      <div className={fill ? 'flex-1 min-w-0 flex [&>button]:w-full [&>button]:min-w-0' : undefined}>
        <PlayButton large={large} fill={fill} />
      </div>
      <div className={fill ? 'flex-1 min-w-0 flex [&>button]:w-full [&>button]:min-w-0' : undefined}>
        <StopButton large={large} fill={fill} />
      </div>
    </div>
  )
}
