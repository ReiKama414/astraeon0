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
import * as THREE from 'three'

export function SourceBadge({ o, lang }: { o: CelestialObject; lang: Lang }) {
  if (o.sourceType !== 'real') return <span className="chip fiction">{lang === 'zh' ? '虛構' : 'Fictional'}</span>
  if (o.discoveryStatus === 'candidate') return <span className="chip candidate">{lang === 'zh' ? '候選' : 'Candidate'}</span>
  return <span className="chip real">{t('real', lang)}</span>
}

function Actions({ o, lang }: { o: CelestialObject; lang: Lang }) {
  const sceneId = useApp((s) => s.sceneId)
  const focusId = useApp((s) => s.focusId)
  const compareIds = useApp((s) => s.compareIds)
  const fav = useFavorites((s) => s.items.some((f) => f.id === o.id))
  const here = registry.sceneFor(o.id).id === sceneId && focusId === o.id
  const hosts = !!o.visual.hostsScene && registry.sceneFor(o.id).id !== sceneId
  const canCompare = ['planet', 'moon', 'dwarf-planet', 'exoplanet', 'fantasy-planet', 'star', 'galaxy', 'black-hole', 'nebula'].includes(o.type)
  const btn = 'flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] transition-colors'
  return (
    <div className="flex flex-wrap gap-1.5">
      {(!here || hosts) && (
        <button className={`${btn} bg-violet/15 text-ink hover:bg-violet/25`} onClick={() => travelTo(o.id)}>
          <Icon name="route" size={14} /> {hosts ? t('enter', lang) : t('travel', lang)}
        </button>
      )}
      <button
        className={`${btn} ${fav ? 'text-amber' : 'text-muted hover:text-ink'} bg-white/[0.04] hover:bg-white/[0.08]`}
        onClick={async () => {
          const on = await useFavorites.getState().toggle(o.id)
          toast(on ? (lang === 'zh' ? '已加入收藏' : 'Saved to favorites') : lang === 'zh' ? '已移除收藏' : 'Removed from favorites')
        }}
        aria-pressed={fav}
      >
        <Icon name="star" size={14} filled={fav} /> {fav ? t('favorited', lang) : t('favorite', lang)}
      </button>
      {canCompare && (
        <button
          className={`${btn} bg-white/[0.04] text-muted hover:bg-white/[0.08] hover:text-ink`}
          onClick={() => {
            const ids = compareIds.includes(o.id) ? compareIds : [...compareIds, o.id].slice(-4)
            useApp.getState().set({ compareIds: ids, panel: 'compare' })
          }}
        >
          <Icon name="compare" size={14} /> {t('compare', lang)}
        </button>
      )}
      {o.id === 'earth' && (
        <button className={`${btn} bg-white/[0.04] text-muted hover:bg-white/[0.08] hover:text-ink`} onClick={() => travelTo('celestial-sphere')}>
          <Icon name="constellation" size={14} /> {lang === 'zh' ? '觀看星空' : 'Night sky'}
        </button>
      )}
    </div>
  )
}

function Encyclopedia({ o, lang }: { o: CelestialObject; lang: Lang }) {
  const rows = propertyRows(o, lang, true)
  const [busy, setBusy] = useState(false)
  const adapter =
    o.type === 'exoplanet' || o.type === 'star-system'
      ? o.id.startsWith('trappist') ? () => ExoplanetArchiveAdapter.refreshSystem('TRAPPIST-1') : o.id.startsWith('proxima') ? () => ExoplanetArchiveAdapter.refreshSystem('Proxima Cen') : null
      : HorizonsAdapter.supports(o.id)
        ? () => HorizonsAdapter.refreshBody(o.id)
        : o.id === 'celestial-sphere' || o.type === 'constellation'
          ? () => {
              const d = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.quat)
              const ra = ((Math.atan2(-d.z, d.x) * 180) / Math.PI + 360) % 360
              const dec = (Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) * 180) / Math.PI
              return GaiaAdapter.loadField(ra, dec)
            }
          : null
  const adapterLabel = o.type === 'exoplanet' || o.type === 'star-system' ? 'NASA Exoplanet Archive' : o.id === 'celestial-sphere' || o.type === 'constellation' ? (lang === 'zh' ? '載入視野內 Gaia DR3 恆星' : 'Load Gaia DR3 stars in view') : 'JPL Horizons'
  return (
    <div className="mt-4 space-y-4">
      {o.sourceType !== 'real' && (
        <div className="rounded-xl border border-dashed border-amber/30 bg-amber/[0.04] px-3 py-2 text-[12px] leading-relaxed text-amber/90">
          {lang === 'zh' ? '此天體為程序化生成的虛構天體，不代表真實天文資料。' : 'This object is procedurally generated fiction and does not represent real astronomical data.'}
          {o.seed !== undefined && <div className="mt-1 font-mono text-[11px] text-amber/70">seed {o.seed} · id {o.id}</div>}
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <dt className="text-muted">{lang === 'zh' ? r.label[1] : r.label[0]}</dt>
            <dd className={`text-right ${r.value === 'Unknown' || r.value === '未知' ? 'text-faint' : 'text-ink/90'}`}>{r.value}</dd>
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
          {lang === 'zh' ? '黑洞外觀為視覺模擬：以近似測地線積分呈現重力透鏡、光子環與都卜勒增亮，並非完整廣義相對論輻射轉移計算。' : 'Appearance is a visual simulation: approximate geodesic integration for lensing, photon ring and Doppler beaming — not a full general-relativistic radiative-transfer calculation.'}
        </p>
      )}
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-faint">{t('source', lang)}</div>
        <ul className="space-y-1 text-[11.5px] text-muted">
          {o.dataSource.map((d) => (
            <li key={d.name}>
              {d.url ? (
                <a className="pointer-events-auto underline decoration-white/20 underline-offset-2 hover:text-ink" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              ) : (
                d.name
              )}
              {d.license && <span className="text-faint"> — {d.license}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-1 text-[10.5px] text-faint">
          {lang === 'zh' ? '更新' : 'Updated'} {o.updatedAt}
        </div>
      </div>
      {adapter && (
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line px-3 py-2 text-[12px] text-muted transition-colors hover:text-ink disabled:opacity-50"
          onClick={async () => {
            setBusy(true)
            const r = await adapter()
            setBusy(false)
            toast(r.message)
          }}
        >
          <Icon name="reset" size={13} className={busy ? 'animate-spin' : ''} /> {o.id === 'celestial-sphere' || o.type === 'constellation' ? adapterLabel : `${lang === 'zh' ? '從以下來源更新：' : 'Refresh from'} ${adapterLabel}`}
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
  const o = registry.get(selectedId)
  if (!o || tour) return null
  const rows = propertyRows(o, lang).slice(0, 4)
  const set = useApp.getState().set
  const alt = lang === 'zh' ? o.name : o.nameZh
  return (
    <div
      className={`pointer-events-auto absolute z-10 transition-all duration-300
        bottom-[84px] left-2 right-2 md:bottom-auto md:left-auto md:right-5 md:top-20 md:w-[340px]
        ${open ? '' : 'md:w-auto'}`}
    >
      <div className={`fade-in overflow-hidden rounded-2xl glass-strong ${open ? '' : 'rounded-full'}`}>
        <div className="flex items-start gap-3 px-4 pb-2 pt-3.5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted">
              {typeLabel(o.type, lang)}
              <SourceBadge o={o} lang={lang} />
            </div>
            <div className="truncate font-display text-[26px] leading-tight text-ink">{displayName(o, lang)}</div>
            {open && alt && alt !== displayName(o, lang) && <div className="truncate text-[12px] text-muted">{alt}</div>}
          </div>
          <div className="flex shrink-0 items-center">
            <button className="btn-icon h-8 w-8" onClick={() => set({ infoOpen: !open })} aria-label={open ? 'Collapse' : 'Expand'}>
              <Icon name={open ? 'chevronDown' : 'chevronUp'} size={16} />
            </button>
            <button className="btn-icon h-8 w-8" onClick={() => set({ selectedId: null, encyclopediaOpen: false })} aria-label="Close">
              <Icon name="close" size={15} />
            </button>
          </div>
        </div>
        {open && (
          <div className={`scroll-thin overflow-y-auto px-4 pb-4 ${enc ? 'max-h-[46vh] md:max-h-[calc(100vh-240px)]' : 'max-h-[40vh] md:max-h-none'}`}>
            {!enc && rows.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2">
                {rows.map((r) => (
                  <div key={r.key}>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-faint">{lang === 'zh' ? r.label[1] : r.label[0]}</div>
                    <div className={`text-[13px] ${r.value === 'Unknown' || r.value === '未知' ? 'text-faint' : 'text-ink/90'}`}>{r.value}</div>
                  </div>
                ))}
              </div>
            )}
            <p className={`text-[13px] leading-relaxed text-ink/75 ${enc ? '' : 'line-clamp-3'}`}>{displayDesc(o, lang)}</p>
            <div className="mt-3">
              <Actions o={o} lang={lang} />
            </div>
            <button className="mt-3 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink" onClick={() => set({ encyclopediaOpen: !enc })}>
              <Icon name="book" size={13} /> {t('encyclopedia', lang)}
              <Icon name={enc ? 'chevronUp' : 'chevronDown'} size={12} />
            </button>
            {enc && <Encyclopedia o={o} lang={lang} />}
          </div>
        )}
      </div>
    </div>
  )
}
