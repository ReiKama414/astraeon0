import { useApp } from '../store/useAppStore'
import { registry } from '../core/registry/CelestialRegistry'
import { travelTo, goUp } from '../core/navigation/Navigator'
import { Icon } from './Icon'
import { displayName, t } from './i18n'
import { SCALES } from '../core/coords/SceneScaleManager'

export function Breadcrumb() {
  const sceneId = useApp((s) => s.sceneId)
  const lang = useApp((s) => s.lang)
  const scene = registry.sceneById(sceneId)
  const chain = registry
    .ancestors(scene.hostId)
    .filter((a) => a.visual.hostsScene || a.type === 'galaxy-group')
    .reverse()
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
      {chain.map((a, i) => (
        <span key={a.id} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-faint">/</span>}
          <button className={`pointer-events-auto transition-colors hover:text-ink ${i === chain.length - 1 ? 'text-ink/85' : ''}`} onClick={() => travelTo(a.id)}>
            {displayName(a, lang)}
          </button>
        </span>
      ))}
    </div>
  )
}

export function TopBar() {
  const lang = useApp((s) => s.lang)
  const sceneId = useApp((s) => s.sceneId)
  const skyDepth = useApp((s) => s.skyDepth)
  const scene = registry.sceneById(sceneId)
  return (
    <>
      <div className="absolute left-4 top-4 flex max-w-[60vw] items-start gap-3 md:left-6 md:top-5">
        <div>
          <button className="pointer-events-auto block text-left" onClick={() => travelTo('universe')} aria-label="ASTRALIS — back to the universe overview">
            <div className="font-display font-semibold text-[20px] leading-none tracking-[0.4em] text-ink transition-[letter-spacing] duration-700 hover:tracking-[0.46em] md:text-[27px]">ASTRALIS</div>
          </button>
          <div className="mt-2 hidden md:block">
            <Breadcrumb />
          </div>
        </div>
        {sceneId !== 'universe' && (
          <button className="btn-icon pointer-events-auto -mt-1.5 glass" title={t('back', lang)} aria-label={t('back', lang)} onClick={() => goUp()}>
            <Icon name="arrowUp" />
          </button>
        )}
      </div>
      <div className="absolute right-3 top-3 md:left-1/2 md:right-auto md:top-5 md:w-[min(420px,calc(100vw-420px))] md:-translate-x-1/2">
        <button className="pointer-events-auto flex h-11 w-11 items-center justify-center gap-3 rounded-full glass text-left text-sm text-muted transition-colors hover:text-ink md:h-auto md:w-full md:justify-start md:px-4 md:py-2.5" onClick={() => useApp.getState().set({ panel: 'search' })} aria-label={t('search', lang)}>
          <Icon name="search" size={16} />
          <span className="hidden flex-1 truncate md:inline">{t('search', lang)}</span>
          <kbd className="hidden rounded border border-line px-1.5 text-[10px] text-faint md:inline">/</kbd>
        </button>
      </div>
      <div className="absolute bottom-[92px] left-4 hidden text-[10px] leading-relaxed tracking-wide text-faint md:left-6 md:block">
        <div>{scene.kind === 'sky' && skyDepth > 0.02 ? (lang === 'zh' ? '真實 3D 距離：1 單位 = 1 光年' : 'True 3D distances: 1 unit = 1 light-year') : SCALES[scene.kind].unitLabel}</div>
        {SCALES[scene.kind].presentation && <div className="text-champagne/60">{lang === 'zh' ? '展示比例：尺寸經壓縮以利觀察' : 'Presentation scale — sizes compressed for visibility'}</div>}
      </div>
    </>
  )
}
