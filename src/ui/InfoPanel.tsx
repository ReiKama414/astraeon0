import { useState } from 'react'
import { useApp, toast } from '../store/useAppStore'
import { registry } from '../core/registry/CelestialRegistry'
import type { CelestialObject } from '../core/registry/types'
import { travelTo } from '../core/navigation/Navigator'
import { useFavorites } from '../core/favorites'
import { ExoplanetArchiveAdapter, HorizonsAdapter, GaiaAdapter } from '../core/adapters/adapters'
import { Icon } from './Icon'
import { displayDesc, displayName, t, typeLabel, type Lang } from './i18n'
import { propertyRows } from './format'
import { useRegistryVersion } from '../scenes/useRegistry'
import { rig } from '../scenes/common/cameraRig'
import { useLatest, usePresence } from './usePresence'
import * as THREE from 'three'
import { simClock } from '../core/time/SimulationClock'

/** Next perihelion (JD, TDB) — JPL Horizons */
const PERIHELION_JD: Record<string, number> = { halley: 2474040.4859 }

export function SourceBadge({ o, lang }: { o: CelestialObject; lang: Lang }) {
  if (o.sourceType !== 'real') return <span className="badge fiction">{lang === 'zh' ? '虛構' : 'Fictional'}</span>
  if (o.discoveryStatus === 'candidate') return <span className="badge candidate">{lang === 'zh' ? '候選' : 'Candidate'}</span>
  return <span className="badge real">{t('real', lang)}</span>
}

function Actions({ o, lang }: { o: CelestialObject; lang: Lang }) {
  const sceneId = useApp((s) => s.sceneId)
  const focusId = useApp((s) => s.focusId)
  const compareIds = useApp((s) => s.compareIds)
  const fav = useFavorites((s) => s.items.some((f) => f.id === o.id))
  const here = registry.sceneFor(o.id).id === sceneId && focusId === o.id
  const hosts = !!o.visual.hostsScene && registry.sceneFor(o.id).id !== sceneId
  const canCompare = ['planet', 'moon', 'dwarf-planet', 'asteroid', 'exoplanet', 'fantasy-planet', 'star', 'galaxy', 'black-hole', 'nebula', 'star-cluster'].includes(o.type)
  return (
    <div className="flex flex-wrap gap-1.5">
      {(!here || hosts) && (
        <button className="btn-text primary" onClick={() => travelTo(o.id)}>
          {hosts ? t('enter', lang) : t('travel', lang)}
          <Icon name="chevronRight" size={13} />
        </button>
      )}
      <button
        className={`btn-text ${fav ? '!text-champagne !border-champagne/40' : ''}`}
        onClick={async () => {
          const on = await useFavorites.getState().toggle(o.id)
          toast(on ? (lang === 'zh' ? '已加入收藏' : 'Saved to favorites') : lang === 'zh' ? '已移除收藏' : 'Removed from favorites')
        }}
        aria-pressed={fav}
      >
        <Icon name="star" size={13} filled={fav} /> {fav ? t('favorited', lang) : t('favorite', lang)}
      </button>
      {canCompare && (
        <button
          className="btn-text"
          onClick={() => {
            const ids = compareIds.includes(o.id) ? compareIds : [...compareIds, o.id].slice(-4)
            useApp.getState().set({ compareIds: ids, panel: 'compare' })
          }}
        >
          <Icon name="compare" size={13} /> {t('compare', lang)}
        </button>
      )}
      {o.type === 'comet' && PERIHELION_JD[o.id] && (
        <button
          className="btn-text"
          onClick={() => {
            // jump simulation time a few days before perihelion, when the tail is at its finest
            simClock.jd = PERIHELION_JD[o.id] - 12
            simClock.setRate(3600)
            simClock.setPaused(false)
            travelTo(o.id)
            toast(lang === 'zh' ? '時間已跳至 2061 年近日點前夕' : 'Time moved to just before the 2061 perihelion')
          }}
        >
          <Icon name="clock" size={13} /> {lang === 'zh' ? '前往近日點' : 'Go to perihelion'}
        </button>
      )}
      {o.id === 'earth' && (
        <button className="btn-text" onClick={() => travelTo('celestial-sphere')}>
          <Icon name="constellation" size={13} /> {lang === 'zh' ? '觀看星空' : 'Night sky'}
        </button>
      )}
    </div>
  )
}

function Encyclopedia({ o, lang }: { o: CelestialObject; lang: Lang }) {
  const rows = propertyRows(o, lang, true)
  const [busy, setBusy] = useState(false)
  const inSky = o.id === 'celestial-sphere' || o.type === 'constellation'
  const adapter =
    o.type === 'exoplanet' || o.type === 'star-system'
      ? o.id.startsWith('trappist') ? () => ExoplanetArchiveAdapter.refreshSystem('TRAPPIST-1') : o.id.startsWith('proxima') ? () => ExoplanetArchiveAdapter.refreshSystem('Proxima Cen') : null
      : HorizonsAdapter.supports(o.id)
        ? () => HorizonsAdapter.refreshBody(o.id)
        : inSky
          ? () => {
              const d = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.quat)
              const ra = ((Math.atan2(-d.z, d.x) * 180) / Math.PI + 360) % 360
              const dec = (Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) * 180) / Math.PI
              return GaiaAdapter.loadField(ra, dec)
            }
          : null
  const adapterLabel = o.type === 'exoplanet' || o.type === 'star-system' ? 'NASA Exoplanet Archive' : inSky ? (lang === 'zh' ? '載入視野內 Gaia DR3 恆星' : 'Load Gaia DR3 stars in view') : 'JPL Horizons'
  return (
    <div className="content-in mt-5 space-y-5">
      {o.sourceType !== 'real' && (
        <p className="border-l border-dream/40 pl-3 text-[12px] leading-relaxed text-dream/90">
          {lang === 'zh' ? '程序化生成的虛構天體，不代表真實天文資料。' : 'Procedurally generated fiction — not real astronomical data.'}
          {o.seed !== undefined && <span className="mt-1 block font-mono text-[10.5px] text-dream/60">seed {o.seed}</span>}
        </p>
      )}
      <dl className="stagger grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[12.5px]">
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <dt className="text-muted">{lang === 'zh' ? r.label[1] : r.label[0]}</dt>
            <dd className={`text-right tabular-nums ${r.value === 'Unknown' || r.value === '未知' ? 'text-faint' : 'text-ink/90'}`}>{r.value}</dd>
          </div>
        ))}
        <div className="contents">
          <dt className="text-muted">{lang === 'zh' ? '狀態' : 'Status'}</dt>
          <dd className="text-right capitalize text-ink/90">{o.discoveryStatus}</dd>
        </div>
        {o.discovery && (
          <div className="contents">
            <dt className="text-muted">{lang === 'zh' ? '發現' : 'Discovery'}</dt>
            <dd className="text-right text-ink/90">{o.discovery}</dd>
          </div>
        )}
      </dl>
      {o.type === 'black-hole' && (
        <p className="text-[11.5px] leading-relaxed text-faint">
          {lang === 'zh' ? '黑洞外觀為視覺模擬：以近似測地線積分呈現重力透鏡、光子環與都卜勒增亮，並非完整的廣義相對論輻射轉移計算。' : 'Appearance is a visual simulation: approximate geodesic integration for lensing, photon ring and Doppler beaming — not a full general-relativistic radiative-transfer calculation.'}
        </p>
      )}
      <div>
        <div className="hairline mb-3" />
        <div className="eyebrow mb-2">{t('source', lang)}</div>
        <ul className="space-y-1 text-[11.5px] text-muted">
          {o.dataSource.map((d) => (
            <li key={d.name}>
              {d.url ? (
                <a className="pointer-events-auto underline decoration-white/15 underline-offset-[3px] transition-colors hover:text-ink" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              ) : (
                d.name
              )}
              {d.license && <span className="text-faint"> — {d.license}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-1.5 text-[10.5px] text-faint">
          {lang === 'zh' ? '更新於' : 'Updated'} {o.updatedAt}
        </div>
      </div>
      {adapter && (
        <button
          disabled={busy}
          className="btn-text w-full justify-center disabled:opacity-50"
          onClick={async () => {
            setBusy(true)
            const r = await adapter()
            setBusy(false)
            toast(r.message)
          }}
        >
          <Icon name="reset" size={13} className={busy ? 'animate-spin' : ''} /> {inSky ? adapterLabel : `${lang === 'zh' ? '更新資料：' : 'Refresh from'} ${adapterLabel}`}
        </button>
      )}
    </div>
  )
}

export function InfoPanel() {
  useRegistryVersion()
  const lang = useApp((s) => s.lang)
  const selectedId = useApp((s) => s.selectedId)
  const open = useApp((s) => s.infoOpen)
  const enc = useApp((s) => s.encyclopediaOpen)
  const tour = useApp((s) => s.tour.active)
  const live = registry.get(selectedId)
  const o = useLatest(live)
  const { mounted, shown } = usePresence(!!live && !tour)
  if (!mounted || !o) return null
  const rows = propertyRows(o, lang).slice(0, 4)
  const set = useApp.getState().set
  const alt = lang === 'zh' ? o.name : o.nameZh
  return (
    <div data-shown={shown} className="pop from-right pointer-events-auto absolute bottom-[84px] left-2 right-2 z-10 md:bottom-auto md:left-auto md:right-6 md:top-20 md:w-[348px]">
      <div className="overflow-hidden rounded-[18px] glass-strong">
        <div key={o.id} className="content-in flex items-start gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-3">
              <span className="eyebrow">{typeLabel(o.type, lang)}</span>
              <SourceBadge o={o} lang={lang} />
            </div>
            <div className="truncate font-display font-semibold text-[30px] leading-[1.05] tracking-[0.01em] text-ink">{displayName(o, lang)}</div>
            {open && alt && alt !== displayName(o, lang) && <div className="mt-0.5 truncate font-display font-semibold text-[15px] text-muted">{alt}</div>}
          </div>
          <div className="-mr-2 flex shrink-0 items-center">
            <button className="btn-icon h-8 w-8" onClick={() => set({ infoOpen: !open })} aria-label={open ? 'Collapse' : 'Expand'}>
              <Icon name={open ? 'chevronDown' : 'chevronUp'} size={15} />
            </button>
            <button className="btn-icon h-8 w-8" onClick={() => set({ selectedId: null, encyclopediaOpen: false })} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
        <div className={`grid transition-[grid-template-rows] duration-500 ease-[var(--ease-soft)] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="min-h-0 overflow-hidden">
            <div key={o.id} className={`scroll-thin content-in overflow-y-auto px-5 pb-5 ${enc ? 'max-h-[46vh] md:max-h-[calc(100vh-250px)]' : 'max-h-[40vh] md:max-h-none'}`}>
              {!enc && rows.length > 0 && (
                <div className="stagger mb-4 mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                  {rows.map((r) => (
                    <div key={r.key}>
                      <div className="text-[11px] text-faint">{lang === 'zh' ? r.label[1] : r.label[0]}</div>
                      <div className={`mt-0.5 text-[13.5px] tabular-nums ${r.value === 'Unknown' || r.value === '未知' ? 'text-faint' : 'text-ink/90'}`}>{r.value}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className={`text-[13px] leading-[1.75] text-ink/72 ${enc ? '' : 'line-clamp-3'}`}>{displayDesc(o, lang)}</p>
              <div className="mt-4">
                <Actions o={o} lang={lang} />
              </div>
              <button className="group mt-4 flex items-center gap-2 text-[12px] text-muted transition-colors hover:text-ink" onClick={() => set({ encyclopediaOpen: !enc })}>
                <Icon name="book" size={13} /> {t('encyclopedia', lang)}
                <Icon name="chevronDown" size={12} className={`transition-transform duration-500 ${enc ? 'rotate-180' : ''}`} />
              </button>
              {enc && <Encyclopedia o={o} lang={lang} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
