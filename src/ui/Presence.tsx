import type { ReactNode } from 'react'
import { usePresence } from './usePresence'

/** Mounts children while `open` (plus the exit animation) and passes the animation state down. */
export function Presence({ open, exitMs, children }: { open: boolean; exitMs?: number; children: (shown: boolean) => ReactNode }) {
  const { mounted, shown } = usePresence(open, exitMs)
  return mounted ? <>{children(shown)}</> : null
}
