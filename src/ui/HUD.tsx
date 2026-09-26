import { useEffect } from 'react'
import { useApp } from '../store/useAppStore'
import { TopBar } from './TopBar'
import { SearchPanel } from './SearchPanel'
import { SideNav } from './SideNav'
import { InfoPanel } from './InfoPanel'
import { BottomDock } from './BottomDock'
import { TourOverlay } from './TourOverlay'
import { PhotoOverlay } from './PhotoOverlay'
import { ComparePanel } from './ComparePanel'
import { SettingsPanel } from './SettingsPanel'
import { StatsHUD } from './StatsHUD'
import { SceneTitle } from './SceneTitle'
import { ControlsHint } from './ControlsHint'
import { cancelAllTravel, goUp } from '../core/navigation/Navigator'

export function HUD() {
  const photo = useApp((s) => s.photoMode)
  const panel = useApp((s) => s.panel)
  const toast = useApp((s) => s.toast)
  const showStats = useApp((s) => s.showStats)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          useApp.getState().set({ panel: 'none' })
          t.blur()
        }
        return
      }
      const s = useApp.getState()
      if (e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        s.set({ panel: 'search' })
      } else if (e.key === 'Escape') {
        if (s.photoMode) s.set({ photoMode: false })
        else if (s.panel !== 'none') s.set({ panel: 'none' })
        else if (s.transitioning) cancelAllTravel()
      } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        s.set({ flightMode: !s.flightMode })
      } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey) {
        s.set({ photoMode: !s.photoMode })
      } else if (e.key === 'Backspace') {
        goUp()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (photo) return <PhotoOverlay />

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      <TopBar />
      <SideNav />
      <InfoPanel />
      <BottomDock />
      <SceneTitle />
      <ControlsHint />
      <TourOverlay />
      {panel === 'search' && <SearchPanel />}
      {panel === 'compare' && <ComparePanel />}
      {panel === 'settings' && <SettingsPanel />}
      {showStats && <StatsHUD />}
      {toast && (
        <div className="fade-in pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full glass px-4 py-2 text-xs text-ink/90">{toast}</div>
      )}
    </div>
  )
}
