import { useEffect, useState, useSyncExternalStore } from 'react'
import { useApp } from '../store/useAppStore'
import { simClock } from '../core/time/SimulationClock'
import { dateFromJd } from '../core/coords/UniverseCoordinateSystem'
import { startTour } from '../core/tour'
import { exploreRandom, discoverNewWorld } from '../core/discovery'
import { resetView } from '../core/navigation/Navigator'
import { Icon } from './Icon'
import { formatRate, formatSimDate } from './format'
import { t } from './i18n'

function useClock() {
  return useSyncExternalStore(
    (cb) => simClock.subscribe(cb),
    () => `${simClock.rate}|${simClock.paused}`,
  )
}

function SimDate() {
  const [txt, setTxt] = useState('')
  useEffect(() => {
    const id = setInterval(() => setTxt(formatSimDate(dateFromJd(simClock.jd))), 200)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-[11px] tabular-nums text-ink/80">{txt}</span>
}

const PRESETS = [1, 10, 100]

export function TimeControl() {
  useClock()
  const lang = useApp((s) => s.lang)
  const [custom, setCustom] = useState(false)
  const sliderVal = Math.log10(Math.max(1, simClock.rate))
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button className="btn-icon h-9 w-9 shrink-0" onClick={() => simClock.setPaused(!simClock.paused)} aria-label={simClock.paused ? t('play', lang) : t('pause', lang)} title={simClock.paused ? t('play', lang) : t('pause', lang)}>
        <Icon name={simClock.paused ? 'play' : 'pause'} size={16} filled />
      </button>
      {PRESETS.map((p) => (
        <button key={p} onClick={() => { simClock.setRate(p); simClock.setPaused(false); setCustom(false) }} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] tabular-nums transition-colors ${simClock.rate === p && !custom ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'}`}>
          {p}×
        </button>
      ))}
      <button onClick={() => setCustom(!custom)} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] transition-colors ${custom || !PRESETS.includes(simClock.rate) ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'}`} title={lang === 'zh' ? '自訂速度' : 'Custom speed'}>
        {lang === 'zh' ? '自訂' : 'Custom'}
      </button>
      {custom && (
        <div className="flex items-center gap-2 pl-1">
          <input className="astr-range w-24 md:w-36" type="range" min={0} max={7.5} step={0.01} value={sliderVal} onChange={(e) => { simClock.setRate(Math.round(10 ** Number(e.target.value))); simClock.setPaused(false) }} aria-label="Simulation speed" />
          <span className="w-[120px] text-[10.5px] tabular-nums text-muted">{formatRate(simClock.rate)}</span>
        </div>
      )}
      <button className="btn-icon h-9 w-9" onClick={() => { simClock.reset(); setCustom(false) }} title={t('resetTime', lang)} aria-label={t('resetTime', lang)}>
        <Icon name="clock" size={16} />
      </button>
      <div className="hidden flex-col pl-1 leading-tight md:flex">
        <span className="text-[9px] uppercase tracking-[0.2em] text-faint">{t('simTime', lang)}</span>
        <SimDate />
      </div>
    </div>
  )
}

export function BottomDock() {
  const lang = useApp((s) => s.lang)
  const flight = useApp((s) => s.flightMode)
  const tour = useApp((s) => s.tour.active)
  const set = useApp.getState().set
  if (tour) return null
  const tool = (icon: string, label: string, onClick: () => void, active = false) => (
    <button className={`btn-icon group relative ${active ? 'is-active' : ''}`} onClick={onClick} aria-label={label}>
      <Icon name={icon} />
      <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md glass-strong px-2 py-1 text-[11px] text-ink opacity-0 transition-opacity group-hover:opacity-100 md:block">{label}</span>
    </button>
  )
  return (
    <div className="absolute bottom-3 left-1/2 flex w-[calc(100vw-16px)] -translate-x-1/2 flex-col items-center gap-2 md:bottom-5 md:w-auto">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full glass px-2 py-1 scroll-thin">
        <TimeControl />
        <div className="mx-1 h-6 w-px shrink-0 bg-white/10" />
        {tool('route', t('tour', lang), () => startTour())}
        {tool('dice', t('random', lang), () => exploreRandom())}
        {tool('sparkle', t('discover', lang), () => discoverNewWorld())}
        {tool('target', t('reset', lang), () => resetView())}
        <span className="hidden md:contents">{tool('plane', `${t('flight', lang)} (F · WASD)`, () => set({ flightMode: !flight }), flight)}</span>
        {tool('compare', t('compare', lang), () => set({ panel: 'compare' }))}
        {tool('camera', t('photo', lang), () => set({ photoMode: true }))}
        {tool('settings', t('settings', lang), () => set({ panel: useApp.getState().panel === 'settings' ? 'none' : 'settings' }))}
      </div>
    </div>
  )
}
