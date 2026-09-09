import { LearnShell } from '../learning/LearnShell'
import { JamShell } from '../jam/JamShell'
import { useUIStore } from '../../store/ui-store'

/**
 * Thin mode router: Jam is home; Learn is optional.
 * Studio is no longer a separate appMode — code lives as a sheet inside Jam.
 */
export function AppShell() {
  const appMode = useUIStore((s) => s.appMode)

  if (appMode === 'learn') {
    return <LearnShell />
  }

  return <JamShell />
}
