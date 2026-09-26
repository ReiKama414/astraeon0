import { useEffect, useState } from 'react'
import { useApp } from '../store/useAppStore'
import { JOURNEY, pauseTour, resumeTour, skipTour, endTour, tourProgress } from '../core/tour'
import { Icon } from './Icon'
import { t } from './i18n'

export function TourOverlay() {
  const tour = useApp((s) => s.tour)
  const lang = useApp((s) => s.lang)
  const transitioning = useApp((s) => s.transitioning)
  const [p, setP] = useState(0)
  useEffect(() => {
    if (!tour.active) return
    const id = setInterval(() => setP(tourProgress.t), 100)
    return () => clearInterval(id)
  }, [tour.active])
  if (!tour.active) return null
  const step = JOURNEY[tour.step]
  const L = (x: [string, string]) => (lang === 'zh' ? x[1] : x[0])
  const total = (tour.step + (transitioning ? 0 : p)) / JOURNEY.length
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(560px,calc(100vw-16px))] -translate-x-1/2 md:bottom-8">
      <div key={tour.step} className="fade-in rounded-2xl glass-strong px-5 pb-4 pt-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted">
          <span>{t('tour', lang)}</span>
          <span className="tabular-nums">
            {tour.step + 1} / {JOURNEY.length}
          </span>
        </div>
        <div className="mt-2 font-display text-[28px] leading-tight text-ink">{L(step.title)}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75">{L(step.text)}</p>
        <div className="mt-4 h-[2px] overflow-hidden rounded bg-white/10">
          <div className="h-full bg-gradient-to-r from-violet to-cyan transition-[width] duration-200" style={{ width: `${total * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {JOURNEY.map((s, i) => (
              <span key={s.id} className={`h-1 w-4 rounded-full ${i < tour.step ? 'bg-violet/70' : i === tour.step ? 'bg-ink' : 'bg-white/15'}`} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button className="btn-icon h-9 w-9" onClick={() => (tour.paused ? resumeTour() : pauseTour())} aria-label={tour.paused ? 'Continue' : 'Pause'} title={tour.paused ? (lang === 'zh' ? '繼續' : 'Continue') : lang === 'zh' ? '暫停' : 'Pause'}>
              <Icon name={tour.paused ? 'play' : 'pause'} size={16} filled />
            </button>
            <button className="btn-icon h-9 w-9" onClick={() => skipTour()} aria-label="Skip" title={lang === 'zh' ? '跳過' : 'Skip'}>
              <Icon name="skip" size={16} />
            </button>
            <button className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] text-ink/85 hover:bg-white/10" onClick={() => endTour()}>
              <Icon name="stop" size={12} filled /> {lang === 'zh' ? '結束導覽' : 'End tour'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
