import { useEffect, useState } from 'react'

/**
 * Keeps an element mounted while it animates out.
 * `shown` flips one tick after mount so CSS transitions (see `.pop`) run in both directions.
 */
export function usePresence(open: boolean, exitMs = 480) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const t = setTimeout(() => setShown(true), 20)
      return () => clearTimeout(t)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(t)
  }, [open, exitMs])
  return { mounted, shown }
}

/** Remembers the last non-null value so exiting panels keep rendering their content. */
export function useLatest<T>(value: T | null | undefined): T | null {
  const [v, setV] = useState<T | null>(value ?? null)
  useEffect(() => {
    if (value != null) setV(value)
  }, [value])
  return value ?? v
}
