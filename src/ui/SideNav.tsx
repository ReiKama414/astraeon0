import { useState } from 'react'
import { useLatest, usePresence } from './usePresence'
import { useApp } from '../store/useAppStore'
import { registry } from '../core/registry/CelestialRegistry'
import { travelTo } from '../core/navigation/Navigator'
import { useFavorites, openFavorite } from '../core/favorites'
import { discoverNewWorld } from '../core/discovery'
import { Icon } from './Icon'
import { displayName, typeLabel } from './i18n'
import type { CelestialObject } from '../core/registry/types'

type Cat = { id: string; icon: string; label: [string, string]; items: () => CelestialObject[]; action?: () => void }

const CATS: Cat[] = [
  { id: 'universe', icon: 'universe', label: ['Universe', '宇宙'], items: () => ['universe', 'local-group', 'virgo-cluster'].map((i) => registry.get(i)!).filter(Boolean) },
  { id: 'galaxies', icon: 'galaxy', label: ['Galaxies', '星系'], items: () => [...registry.byType('galaxy').filter((g) => g.sourceType === 'real' && g.visual.hostsScene), ...registry.byType('galaxy').filter((g) => g.sourceType === 'real' && !g.visual.hostsScene)] },
  { id: 'solar', icon: 'sun', label: ['Solar System', '太陽系'], items: () => ['sol', 'sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'io', 'europa', 'ganymede', 'callisto', 'saturn', 'titan', 'uranus', 'neptune', 'triton', 'pluto', 'ceres', 'vesta', 'pallas', 'hygiea', 'bennu', 'eris', 'makemake', 'haumea', 'halley', 'asteroid-belt'].map((i) => registry.get(i)!).filter(Boolean) },
  { id: 'exo', icon: 'planet', label: ['Exoplanets', '系外行星'], items: () => ['proxima-system', 'proxima-b', 'proxima-d', 'proxima-c', 'trappist-1-system', 'trappist-1b', 'trappist-1c', 'trappist-1d', 'trappist-1e', 'trappist-1f', 'trappist-1g', 'trappist-1h'].map((i) => registry.get(i)!).filter(Boolean) },
  { id: 'bh', icon: 'blackhole', label: ['Black Holes', '黑洞'], items: () => registry.byType('black-hole').filter((b) => b.sourceType === 'real') },
  { id: 'nebulae', icon: 'nebula', label: ['Nebulae', '星雲'], items: () => [...registry.byType('nebula', 'star-cluster').filter((n) => n.visual.hostsScene), ...registry.byType('nebula', 'star-cluster').filter((n) => !n.visual.hostsScene && n.nameZh && !n.nameZh.startsWith('梅西耶'))] },
  { id: 'const', icon: 'constellation', label: ['Constellations', '星座'], items: () => [registry.get('celestial-sphere')!, ...registry.byType('constellation').filter((c) => c.id !== 'celestial-sphere').sort((a, b) => a.name.localeCompare(b.name))] },
  { id: 'fantasy', icon: 'sparkle', label: ['Fantasy Worlds', '幻想世界'], items: () => [registry.get('fantasy-universe')!, ...registry.all().filter((o) => o.sourceType === 'fantasy' && (o.type === 'fantasy-planet' || o.type === 'galaxy' || o.type === 'nebula')).slice(0, 16)] },
  { id: 'favorites', icon: 'star', label: ['Favorites', '收藏'], items: () => [] },
]

export function SideNav() {
  const lang = useApp((s) => s.lang)
  const [open, setOpen] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(true)
  const favs = useFavorites((s) => s.items)
  const cat = useLatest(CATS.find((c) => c.id === open))
  const fly = usePresence(!!open)
  const L = (l: [string, string]) => (lang === 'zh' ? l[1] : l[0])
  return (
    <>
      <div className="absolute left-3 top-1/2 hidden -translate-y-1/2 md:left-5 md:block">
        <div className={`pointer-events-auto flex flex-col items-center gap-1 rounded-full glass p-1 transition-all duration-300 ${railOpen ? '' : 'opacity-60'}`}>
          <button className="btn-icon h-9 w-9" onClick={() => { setRailOpen(!railOpen); setOpen(null) }} title={railOpen ? 'Collapse' : 'Expand'} aria-label="Toggle menu">
            <Icon name={railOpen ? 'chevronLeft' : 'menu'} size={16} />
          </button>
          {railOpen &&
            CATS.map((c) => (
              <button key={c.id} className={`btn-icon group relative ${open === c.id ? 'is-active' : ''}`} onClick={() => setOpen(open === c.id ? null : c.id)} aria-label={L(c.label)}>
                <Icon name={c.icon} />
                <span className="pointer-events-none absolute left-12 -translate-x-1 whitespace-nowrap rounded-full glass-strong px-3 py-1 text-[12px] text-ink opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">{L(c.label)}</span>
              </button>
            ))}
        </div>
      </div>
      {/* mobile: compact menu button */}
      <div className="absolute left-3 top-[64px] md:hidden">
        <button className={`btn-icon pointer-events-auto glass ${open ? 'is-active' : ''}`} onClick={() => setOpen(open ? null : 'galaxies')} aria-label="Menu">
          <Icon name="menu" />
        </button>
      </div>
      {cat && fly.mounted && (
        <div className="pointer-events-auto absolute left-3 top-[112px] z-20 w-[min(300px,calc(100vw-24px))] md:left-[80px] md:top-1/2 md:-translate-y-1/2">
        <div data-shown={fly.shown} className="pop from-left flex max-h-[calc(100vh-240px)] flex-col overflow-hidden rounded-[18px] glass-strong md:max-h-[70vh]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <div className="scroll-thin flex flex-1 gap-1 overflow-x-auto md:hidden">
              {CATS.map((c) => (
                <button key={c.id} onClick={() => setOpen(c.id)} className={`btn-icon h-9 w-9 shrink-0 ${open === c.id ? 'is-active' : ''}`} aria-label={L(c.label)}>
                  <Icon name={c.icon} size={16} />
                </button>
              ))}
            </div>
            <div className="hidden flex-1 font-display font-semibold text-[22px] md:block">{L(cat.label)}</div>
            <button className="btn-icon h-8 w-8" onClick={() => setOpen(null)} aria-label="Close">
              <Icon name="close" size={15} />
            </button>
          </div>
          <div key={cat.id} className="scroll-thin stagger overflow-y-auto py-1">
            {cat.id === 'fantasy' && (
              <button className="mx-4 my-2 flex w-[calc(100%-32px)] items-center justify-center gap-2 rounded-full border border-dashed border-dream/35 px-3 py-2.5 text-[13px] text-dream transition-colors duration-300 hover:bg-dream/[0.07]" onClick={() => { setOpen(null); discoverNewWorld() }}>
                <Icon name="sparkle" size={15} /> {lang === 'zh' ? '發現新世界' : 'Discover New World'}
              </button>
            )}
            {cat.id === 'favorites' ? (
              favs.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-muted">{lang === 'zh' ? '尚無收藏。在資訊面板中點擊星形圖示即可收藏。' : 'No favorites yet. Use the star in the info panel to save one.'}</div>
              ) : (
                favs.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2 px-4 py-2 hover:bg-white/[0.05]">
                    <button className="min-w-0 flex-1 text-left" onClick={() => { setOpen(null); openFavorite(f) }}>
                      <div className="truncate text-[14px]">{f.name}</div>
                      <div className="text-[11px] text-muted">
                        {typeLabel(f.type as never, lang)}
                        {f.sourceType !== 'real' && <span className="text-dream/80"> · {lang === 'zh' ? '虛構' : 'Fictional'}{f.seed !== undefined ? ` · seed ${f.seed}` : ''}</span>}
                      </div>
                    </button>
                    <button className="btn-icon h-8 w-8 opacity-60 group-hover:opacity-100" onClick={() => useFavorites.getState().remove(f.id)} aria-label="Remove">
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))
              )
            ) : (
              cat.items().map((o) => (
                <button key={o.id} className="group flex w-full items-center gap-3 px-5 py-2 text-left transition-colors duration-300 hover:bg-white/[0.04]" onClick={() => { setOpen(null); travelTo(o.id) }}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">{displayName(o, lang)}</div>
                    <div className="text-[11px] text-muted">
                      {typeLabel(o.type, lang)}
                      {o.discoveryStatus === 'candidate' && <span className="text-amber/80"> · {lang === 'zh' ? '候選' : 'Candidate'}</span>}
                      {o.sourceType !== 'real' && <span className="text-dream/80"> · {lang === 'zh' ? '虛構' : 'Fictional'}</span>}
                    </div>
                  </div>
                  <Icon name="chevronRight" size={14} className="text-faint transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              ))
            )}
          </div>
        </div>
        </div>
      )}
    </>
  )
}
