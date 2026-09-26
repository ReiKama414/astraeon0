import { useSyncExternalStore } from 'react'
import { registry } from '../core/registry/CelestialRegistry'

/** Re-render when the registry changes (procedural chunks streamed in/out, catalogue imports). */
export function useRegistryVersion() {
  return useSyncExternalStore(
    (cb) => registry.subscribe(cb),
    () => registry.version,
  )
}
