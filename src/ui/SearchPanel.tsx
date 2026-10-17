import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/useAppStore'
import { searchLocal } from '../core/search'
import { travelTo } from '../core/navigation/Navigator'
import { Icon } from './Icon'
import { displayName, t, typeLabel } from './i18n'
import { SourceBadge } from './InfoPanel'
import { useRegistryVersion } from '../scenes/useRegistry'

export function SearchPanel({ shown }: { shown: boolean }) {
  const lang = useApp((s) => s.lang)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'real' | 'fictional'>('all')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const version = useRegistryVersion()
  const hits = useMemo(() => searchLocal(q, filter), [q, filter, version])
  useEffect(() => input.current?.focus(), [])
  useEffect(() => setActive(0), [q, filter])
  const close = () => useApp.getState().set({ panel: 'none' })
  const go = (id: string) => {
    close()
    travelTo(id)
  }
  return (
    <div data-shown={shown} className="veil pointer-events-auto absolute inset-0 flex justify-center bg-black/35 px-3 pt-16 md:pt-24" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div data-shown={shown} className="pop from-top flex max-h-[70vh] w-full max-w-[560px] flex-col self-start overflow-hidden rounded-[18px] glass-strong">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Icon name="search" size={18} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1))
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              if (e.key === 'Enter' && hits[active]) go(hits[active].obj.id)
            }}
            placeholder={lang === 'zh' ? '地球、Mars、M31、人馬座 A*、星雲…' : 'Earth, 地球, M31, Sagittarius A*, nebula…'}
            className="flex-1 bg-transparent font-display font-semibold text-[20px] text-ink outline-none placeholder:text-faint"
          />
          <button className="btn-icon h-8 w-8" onClick={close} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="flex gap-1.5 border-b border-line px-4 py-2">
          {(['all', 'real', 'fictional'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-[12px] transition-colors duration-300 ${filter === f ? 'bg-white/[0.07] text-ink' : 'text-muted hover:text-ink'}`}>
              {f === 'all' ? (lang === 'zh' ? '全部' : 'All') : t(f === 'real' ? 'real' : 'fictional', lang)}
            </button>
          ))}
        </div>
        <div key={q + filter} className="scroll-thin stagger min-h-0 overflow-y-auto py-1">
          {hits.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted">{t('noResults', lang)}</div>}
          {hits.map((h, i) => (
            <button key={h.obj.id} onMouseEnter={() => setActive(i)} onClick={() => go(h.obj.id)} className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors duration-300 ${i === active ? 'bg-white/[0.045]' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-normal text-ink">
                  {displayName(h.obj, lang)}
                  {lang === 'zh' && h.obj.nameZh && h.obj.nameZh !== h.obj.name && <span className="ml-2 text-xs text-faint">{h.obj.name}</span>}
                  {lang === 'en' && h.obj.nameZh && <span className="ml-2 text-xs text-faint">{h.obj.nameZh}</span>}
                </div>
                <div className="truncate text-[11px] text-muted">
                  {typeLabel(h.obj.type, lang)}
                  {h.parentName && <span className="text-faint"> · {h.parentName}</span>}
                </div>
              </div>
              <SourceBadge o={h.obj} lang={lang} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
