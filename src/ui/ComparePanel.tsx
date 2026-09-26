import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp } from '../store/useAppStore'
import { registry } from '../core/registry/CelestialRegistry'
import type { CelestialObject } from '../core/registry/types'
import { PlanetSurface, Atmosphere } from '../scenes/solar/Planet'
import { EarthSurface } from '../scenes/solar/Earth'
import { StarBody } from '../scenes/solar/Star'
import { Icon } from './Icon'
import { displayName, typeLabel } from './i18n'
import { propertyRows, sci } from './format'
import { searchLocal } from '../core/search'

const SUN = new THREE.Vector3(600, 250, 900)

function radiusKm(o: CelestialObject) {
  return o.physical.radiusKm ?? (o.physical.radiusEarth ? o.physical.radiusEarth * 6371 : undefined)
}

function CompareBody({ o, r, x }: { o: CelestialObject; r: number; x: number }) {
  const center = useRef<THREE.Group>(null)
  const v = o.visual.planet
  return (
    <group position={[x, 0, 0]} ref={center}>
      {o.visual.renderer === 'sun' ? <StarBody obj={o} radius={r} light={false} /> : o.visual.renderer === 'earth' ? <EarthSurface obj={o} radius={r} sunPos={SUN} centerRef={center} /> : v ? <PlanetSurface obj={o} radius={r} sunPos={SUN} centerRef={center} /> : null}
      {v?.atmosphere && o.visual.renderer !== 'sun' && <Atmosphere radius={r} visual={v.atmosphere} sunPos={SUN} centerRef={center} />}
    </group>
  )
}

function CompareView({ bodies, actual }: { bodies: CelestialObject[]; actual: boolean }) {
  const radii = bodies.map((b) => radiusKm(b) ?? 1)
  const max = Math.max(...radii)
  const min = Math.min(...radii)
  const scaled = radii.map((R) => (actual ? R / max : min === max ? 1 : 0.3 + (0.7 * (Math.log(R) - Math.log(min))) / (Math.log(max) - Math.log(min))))
  const gap = 0.35
  const xs: number[] = []
  let cursor = 0
  scaled.forEach((r, i) => {
    cursor += (i === 0 ? 0 : gap) + r
    xs.push(cursor)
    cursor += r
  })
  const width = cursor
  const offset = width / 2
  return (
    <Canvas orthographic camera={{ position: [0, 0.4, 10], zoom: 1, near: 0.1, far: 100 }} flat dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ camera, size }) => {
      const c = camera as THREE.OrthographicCamera
      c.zoom = Math.min(size.width / (width + 0.6), size.height / 2.4)
      c.lookAt(0, 0, 0)
      c.updateProjectionMatrix()
    }}>
      <ambientLight intensity={0.05} />
      <directionalLight position={SUN.toArray()} intensity={3} />
      <Suspense fallback={null}>
        {bodies.map((b, i) => (
          <CompareBody key={b.id} o={b} r={Math.max(scaled[i], 0.002)} x={xs[i] - offset} />
        ))}
      </Suspense>
    </Canvas>
  )
}

const METRICS: { key: string; label: [string, string] }[] = [
  { key: 'radius', label: ['Radius', '半徑'] },
  { key: 'mass', label: ['Mass', '質量'] },
  { key: 'distance', label: ['Distance', '距離'] },
  { key: 'temperature', label: ['Temperature', '溫度'] },
  { key: 'period', label: ['Orbital period', '公轉週期'] },
  { key: 'diameter', label: ['Diameter', '直徑'] },
]

export function ComparePanel() {
  const lang = useApp((s) => s.lang)
  const ids = useApp((s) => s.compareIds)
  const selected = useApp((s) => s.selectedId)
  const [actual, setActual] = useState(false)
  const [q, setQ] = useState('')
  const set = useApp.getState().set
  const objs = ids.map((i) => registry.get(i)).filter(Boolean) as CelestialObject[]
  const bodies = objs.filter((o) => radiusKm(o) && (o.visual.planet || o.visual.renderer === 'sun'))
  const tiny = actual && bodies.length > 1 && Math.min(...bodies.map((b) => radiusKm(b)!)) / Math.max(...bodies.map((b) => radiusKm(b)!)) < 0.02
  const suggestions = useMemo(() => (q ? searchLocal(q, 'all', 6).filter((h) => !ids.includes(h.obj.id)) : []), [q, ids])
  const add = (id: string) => set({ compareIds: [...ids.filter((x) => x !== id), id].slice(-4) })
  const bars = METRICS.map((m) => {
    const vals = objs.map((o) => propertyRows(o, lang, true).find((r) => r.key === m.key))
    const nums = vals.map((v) => v?.numeric).filter((n): n is number => n !== undefined && n > 0)
    return { m, vals, nums }
  }).filter((b) => b.nums.length >= 1)

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-2 md:p-8" onPointerDown={(e) => e.target === e.currentTarget && set({ panel: 'none' })}>
      <div className="fade-in flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-2xl glass-strong">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="font-display text-xl">{lang === 'zh' ? '天體比較' : 'Celestial Comparison'}</div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-white/[0.05] p-0.5 text-[11px]">
            <button className={`rounded-full px-3 py-1 ${!actual ? 'bg-white/10 text-ink' : 'text-muted'}`} onClick={() => setActual(false)}>
              {lang === 'zh' ? '展示比例' : 'Presentation scale'}
            </button>
            <button className={`rounded-full px-3 py-1 ${actual ? 'bg-white/10 text-ink' : 'text-muted'}`} onClick={() => setActual(true)}>
              {lang === 'zh' ? '真實相對比例' : 'Actual relative scale'}
            </button>
          </div>
          <button className="btn-icon h-8 w-8" onClick={() => set({ panel: 'none' })} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto">
          <div className="relative h-[220px] border-b border-line md:h-[300px]">
            {bodies.length > 0 ? (
              <CompareView key={`${bodies.map((b) => b.id).join()}-${actual}`} bodies={bodies} actual={actual} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-muted">{lang === 'zh' ? '加入行星、衛星或恆星以並排檢視 3D 模型。' : 'Add planets, moons or stars to see them side by side in 3D.'}</div>
            )}
            <div className="pointer-events-none absolute bottom-2 left-3 text-[10.5px] text-faint">
              {actual ? (lang === 'zh' ? '半徑依真實數值等比例縮放' : 'Radii drawn to true proportion') : lang === 'zh' ? '展示比例：半徑以對數壓縮，並非真實比例' : 'Presentation scale: radii log-compressed — not to scale'}
              {tiny && <span className="text-amber/80"> · {lang === 'zh' ? '部分天體在真實比例下過小而難以看見' : 'some bodies are too small to see at true scale'}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
            {objs.map((o) => (
              <span key={o.id} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-3 pr-1 text-[12px]">
                {displayName(o, lang)}
                {o.sourceType !== 'real' && <span className="text-[10px] text-amber">◇</span>}
                <button className="btn-icon h-6 w-6" onClick={() => set({ compareIds: ids.filter((x) => x !== o.id) })} aria-label="Remove">
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
            {selected && !ids.includes(selected) && ids.length < 4 && (
              <button className="rounded-full border border-dashed border-line px-3 py-1 text-[12px] text-muted hover:text-ink" onClick={() => add(selected)}>
                + {displayName(registry.get(selected)!, lang)}
              </button>
            )}
            {ids.length < 4 && (
              <div className="relative">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'zh' ? '加入天體…' : 'Add object…'} className="w-40 rounded-full border border-line bg-transparent px-3 py-1 text-[12px] outline-none placeholder:text-faint" />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 top-8 z-10 w-56 overflow-hidden rounded-xl glass-strong py-1">
                    {suggestions.map((h) => (
                      <button key={h.obj.id} className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-white/[0.06]" onClick={() => { add(h.obj.id); setQ('') }}>
                        {displayName(h.obj, lang)} <span className="text-faint">· {typeLabel(h.obj.type, lang)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
            {bars.map(({ m, vals, nums }) => {
              const lmax = Math.log10(Math.max(...nums))
              const lmin = Math.log10(Math.min(...nums))
              return (
                <div key={m.key}>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-faint">
                    {lang === 'zh' ? m.label[1] : m.label[0]} <span className="normal-case tracking-normal">{nums.length > 1 && lmax - lmin > 2 ? (lang === 'zh' ? '（對數尺度）' : '(log scale)') : ''}</span>
                  </div>
                  {objs.map((o, i) => {
                    const v = vals[i]
                    const n = v?.numeric
                    const log = lmax - lmin > 2
                    const w = n && n > 0 ? (log ? 0.08 + (0.92 * (Math.log10(n) - lmin)) / Math.max(1e-9, lmax - lmin) : n / Math.max(...nums)) : 0
                    return (
                      <div key={o.id} className="mb-1 grid grid-cols-[90px_1fr] items-center gap-2 text-[11.5px]">
                        <span className="truncate text-muted">{displayName(o, lang)}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet/70 to-cyan/70" style={{ width: `${Math.max(0, Math.min(1, w)) * 100}%` }} />
                          </div>
                          <span className={`w-[128px] truncate text-right tabular-nums ${n ? 'text-ink/85' : 'text-faint'}`}>{v?.value ?? (lang === 'zh' ? '不適用' : 'n/a')}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          {objs.length > 0 && bodies.length > 0 && (
            <div className="px-5 pb-4 text-[10.5px] text-faint">
              {lang === 'zh' ? '最大半徑' : 'Largest radius'}: {sci(Math.max(...bodies.map((b) => radiusKm(b)!)))} km
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
