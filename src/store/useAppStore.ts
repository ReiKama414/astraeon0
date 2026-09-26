import { create } from 'zustand'

export type Quality = 'auto' | 'low' | 'medium' | 'high' | 'ultra'
export type ResolvedQuality = Exclude<Quality, 'auto'>
export type Panel = 'none' | 'search' | 'menu' | 'favorites' | 'compare' | 'settings'

export interface TourState {
  active: boolean
  step: number
  paused: boolean
}

interface AppState {
  sceneId: string
  selectedId: string | null
  focusId: string | null
  hoveredId: string | null
  quality: Quality
  resolvedQuality: ResolvedQuality
  panel: Panel
  infoOpen: boolean
  encyclopediaOpen: boolean
  showLabels: boolean
  showOrbits: boolean
  showConstellationLines: boolean
  showStarNames: boolean
  skyDepth: number
  photoMode: boolean
  fov: number
  flightMode: boolean
  showStats: boolean
  transitioning: boolean
  tour: TourState
  compareIds: string[]
  toast: string | null
  lang: 'en' | 'zh'
  set: (p: Partial<AppState>) => void
}

export const useApp = create<AppState>((set) => ({
  sceneId: 'universe',
  selectedId: null,
  focusId: null,
  hoveredId: null,
  quality: 'auto',
  resolvedQuality: 'high',
  panel: 'none',
  infoOpen: true,
  encyclopediaOpen: false,
  showLabels: true,
  showOrbits: true,
  showConstellationLines: true,
  showStarNames: true,
  skyDepth: 0,
  photoMode: false,
  fov: 50,
  flightMode: false,
  showStats: false,
  transitioning: false,
  tour: { active: false, step: 0, paused: false },
  compareIds: [],
  toast: null,
  lang: typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en',
  set: (p) => set(p),
}))

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(msg: string) {
  useApp.getState().set({ toast: msg })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => useApp.getState().set({ toast: null }), 2600)
}
