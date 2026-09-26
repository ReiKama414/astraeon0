import { useEffect, useState } from 'react'
import { perfStats } from '../scenes/common/perf'
import { useApp } from '../store/useAppStore'

export function StatsHUD() {
  const [, force] = useState(0)
  const q = useApp((s) => s.resolvedQuality)
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 500)
    return () => clearInterval(id)
  }, [])
  const s = perfStats
  const rows: [string, string][] = [
    ['FPS', `${s.fps.toFixed(0)} (${s.frameMs.toFixed(1)} ms)`],
    ['Draw calls', String(s.calls)],
    ['Triangles', s.triangles.toLocaleString()],
    ['Points', s.points.toLocaleString()],
    ['Geometries', String(s.geometries)],
    ['Textures', String(s.textures)],
    ['GPU mem (est.)', `${s.gpuMemMB.toFixed(0)} MB`],
    ['Active objects', String(s.activeObjects)],
    ['Procedural', String(s.procedural)],
    ['DPR', s.dpr.toFixed(2)],
    ['Quality', q],
  ]
  return (
    <div className="pointer-events-none absolute right-3 top-[76px] z-20 rounded-xl glass px-3 py-2 font-mono text-[10.5px] leading-[1.55] text-ink/80 md:right-auto md:left-[76px] md:top-auto md:bottom-[130px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6">
          <span className="text-faint">{k}</span>
          <span className="tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  )
}
