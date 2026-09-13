/**
 * Coalesce concurrent callers onto one shared promise.
 * Used by startPlayback so Save+Play / double-Play await one init.
 */
export function coalesceInFlight<T>(
  holder: { current: Promise<T> | null },
  run: () => Promise<T>,
): Promise<T> {
  if (holder.current) return holder.current
  const p = run().finally(() => {
    if (holder.current === p) holder.current = null
  })
  holder.current = p
  return p
}
