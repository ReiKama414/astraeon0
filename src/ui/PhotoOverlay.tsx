import { useState } from 'react'
import { useApp, toast } from '../store/useAppStore'
import { captureScreenshot } from '../core/capture'
import { isMobile } from '../core/quality'
import { Icon } from './Icon'

export function PhotoOverlay() {
  const lang = useApp((s) => s.lang)
  const fov = useApp((s) => s.fov)
  const [scale, setScale] = useState(isMobile() ? 1 : 2)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const scales = isMobile() ? [1, 2] : [1, 2, 3, 4]
  const set = useApp.getState().set
  const shoot = async () => {
    setBusy(true)
    try {
      const r = await captureScreenshot(scale)
      toast(`${r.width} × ${r.height} PNG`)
    } catch (e) {
      toast(`Capture failed: ${(e as Error).message}`)
    }
    setBusy(false)
  }
  if (hidden)
    return (
      <button className="fixed inset-0 z-20 cursor-default" onDoubleClick={() => setHidden(false)} aria-label="Show photo controls" style={{ pointerEvents: 'none' }}>
        <span className="pointer-events-auto absolute bottom-4 right-4 rounded-full glass px-3 py-1.5 text-[11px] text-muted" onClick={() => setHidden(false)}>
          {lang === 'zh' ? '顯示控制' : 'Show controls'}
        </span>
      </button>
    )
  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex w-[calc(100vw-16px)] max-w-[720px] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl glass-strong px-4 py-3 md:bottom-6">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="uppercase tracking-[0.18em]">FOV</span>
          <input className="astr-range w-28" type="range" min={12} max={100} step={1} value={fov} onChange={(e) => set({ fov: Number(e.target.value) })} />
          <span className="w-8 tabular-nums text-ink/80">{fov}°</span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <span className="mr-1 uppercase tracking-[0.18em] text-muted">{lang === 'zh' ? '解析度' : 'Resolution'}</span>
          {scales.map((s) => (
            <button key={s} onClick={() => setScale(s)} className={`rounded-full px-2.5 py-1 tabular-nums ${scale === s ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'}`}>
              {s}×
            </button>
          ))}
        </div>
        <button disabled={busy} onClick={shoot} className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-[#0a0a1a] transition-transform hover:scale-[1.03] disabled:opacity-60">
          <Icon name="camera" size={16} /> {busy ? '…' : lang === 'zh' ? '拍攝 PNG' : 'Capture PNG'}
        </button>
        <button className="btn-icon h-9 w-9" onClick={() => setHidden(true)} title={lang === 'zh' ? '隱藏控制' : 'Hide controls'} aria-label="Hide controls">
          <Icon name="eye" size={16} />
        </button>
        <button className="rounded-full px-3 py-1.5 text-[12px] text-muted hover:text-ink" onClick={() => set({ photoMode: false })}>
          {lang === 'zh' ? '離開' : 'Exit'}
        </button>
      </div>
      <div className="absolute left-1/2 top-4 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-faint">{lang === 'zh' ? '攝影模式 · 拖曳旋轉 · 滾輪縮放 · F 自由飛行' : 'Photo mode · drag to orbit · scroll to zoom · F free flight'}</div>
    </div>
  )
}
