import { useApp } from '../store/useAppStore'
import { QUALITY } from '../core/quality'

export function useQuality() {
  const q = useApp((s) => s.resolvedQuality)
  return QUALITY[q]
}
