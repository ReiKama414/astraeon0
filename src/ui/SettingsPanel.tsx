import { useApp, type Quality } from '../store/useAppStore'
import { detectQuality } from '../core/quality'
import { TEXTURE_CREDITS } from '../core/assets/RemoteTextures'
import { Icon } from './Icon'
import { t } from './i18n'
import { registry } from '../core/registry/CelestialRegistry'

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="flex w-full items-center justify-between py-1.5 text-[13px]" onClick={() => onChange(!value)} role="switch" aria-checked={value}>
      <span className="text-ink/85">{label}</span>
      <span className={`relative h-[18px] w-8 rounded-full transition-colors duration-500 ${value ? 'bg-champagne/70' : 'bg-white/10'}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-ink shadow transition-all duration-500 ease-[var(--ease-soft)] ${value ? 'left-[16px]' : 'left-[2px]'}`} />
      </span>
    </button>
  )
}

export function SettingsPanel({ shown }: { shown: boolean }) {
  const s = useApp()
  const lang = s.lang
  const set = s.set
  const isSky = registry.sceneById(s.sceneId).kind === 'sky'
  const qualities: Quality[] = ['auto', 'low', 'medium', 'high', 'ultra']
  return (
    <div className="pointer-events-auto absolute bottom-[84px] left-1/2 z-20 w-[min(360px,calc(100vw-16px))] -translate-x-1/2 md:bottom-[92px]">
    <div data-shown={shown} className="pop rounded-[18px] glass-strong px-5 pb-4 pt-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display font-semibold text-[22px]">{t('settings', lang)}</div>
        <button className="btn-icon h-8 w-8" onClick={() => set({ panel: 'none' })} aria-label="Close">
          <Icon name="close" size={15} />
        </button>
      </div>
      <div className="mb-3">
        <div className="eyebrow mb-2">{t('quality', lang)}</div>
        <div className="flex gap-1">
          {qualities.map((q) => (
            <button
              key={q}
              onClick={() => set({ quality: q, resolvedQuality: q === 'auto' ? detectQuality() : q })}
              className={`flex-1 rounded-full py-1.5 text-[11px] capitalize transition-colors ${s.quality === q ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}
            >
              {q}
            </button>
          ))}
        </div>
        {s.quality === 'auto' && <div className="mt-1 text-[10.5px] text-faint">{lang === 'zh' ? `目前：${s.resolvedQuality}（依裝置效能自動調整）` : `Currently ${s.resolvedQuality} — adapts to device performance`}</div>}
      </div>
      <Toggle label={t('labels', lang)} value={s.showLabels} onChange={(v) => set({ showLabels: v })} />
      <Toggle label={t('orbits', lang)} value={s.showOrbits} onChange={(v) => set({ showOrbits: v })} />
      <Toggle label={t('lines', lang)} value={s.showConstellationLines} onChange={(v) => set({ showConstellationLines: v })} />
      <Toggle label={t('starNames', lang)} value={s.showStarNames} onChange={(v) => set({ showStarNames: v })} />
      {isSky && (
        <div className="py-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink/85">{t('depth', lang)}</span>
            <span className="text-[11px] tabular-nums text-muted">{Math.round(s.skyDepth * 100)}%</span>
          </div>
          <input className="astr-range mt-2 w-full" type="range" min={0} max={1} step={0.01} value={s.skyDepth} onChange={(e) => set({ skyDepth: Number(e.target.value) })} />
          <div className="mt-1 text-[10.5px] leading-snug text-faint">{lang === 'zh' ? '將恆星從天球移至真實距離（1 單位 = 1 光年），可見星座並非真實的 3D 群聚。' : 'Moves stars from the celestial sphere to their true distances (1 unit = 1 ly) — constellations are not physical 3D groups.'}</div>
        </div>
      )}
      <Toggle label={t('stats', lang)} value={s.showStats} onChange={(v) => set({ showStats: v })} />
      <div className="flex items-center justify-between py-1.5 text-[13px]">
        <span className="text-ink/85">Language / 語言</span>
        <div className="flex gap-1">
          {(['en', 'zh'] as const).map((l) => (
            <button key={l} onClick={() => set({ lang: l })} className={`rounded-full px-2.5 py-1 text-[11px] ${lang === l ? 'bg-white/10 text-ink' : 'text-muted'}`}>
              {l === 'en' ? 'EN' : '中文'}
            </button>
          ))}
        </div>
      </div>
      <details className="mt-2 text-[11px] text-muted">
        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.2em] text-faint">{lang === 'zh' ? '資料與素材來源' : 'Data & asset credits'}</summary>
        <ul className="mt-2 space-y-1.5">
          {TEXTURE_CREDITS.map((c) => (
            <li key={c.what}>
              <span className="text-ink/75">{c.what}</span> — {c.who} <span className="text-faint">({c.license})</span>
            </li>
          ))}
          <li>
            <span className="text-ink/75">Catalogue data</span> — NASA NSSDCA fact sheets, JPL SSD, NASA Exoplanet Archive, SIMBAD/Hipparcos, NED, EHT, GRAVITY <span className="text-faint">(per-object sources in the encyclopedia)</span>
          </li>
        </ul>
      </details>
      <div className="mt-3 border-t border-line pt-2 text-[10.5px] leading-relaxed text-faint">
        {lang === 'zh' ? '操作：拖曳旋轉 · 滾輪縮放 · 右鍵/Shift 平移 · 雙擊前往 · / 搜尋 · F 自由飛行（WASD/QE）· P 攝影 · Backspace 返回上一層' : 'Drag to orbit · scroll to zoom · right-drag/Shift to pan · double-click to travel · / search · F free flight (WASD/QE) · P photo · Backspace up one level'}
      </div>
    </div>
    </div>
  )
}
