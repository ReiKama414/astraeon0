import { useEffect, useState } from 'react'
import { useApp } from '../store/useAppStore'
import { isMobile } from '../core/quality'

/** One-time, self-dismissing hint about navigation gestures. */
export function ControlsHint() {
  const lang = useApp((s) => s.lang)
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem('astralis-hint-seen')
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (!show) return
    const hide = () => {
      setShow(false)
      try {
        localStorage.setItem('astralis-hint-seen', '1')
      } catch {
        /* storage unavailable */
      }
    }
    const t = setTimeout(hide, 11000)
    const onInput = () => setTimeout(hide, 1500)
    window.addEventListener('pointerdown', onInput, { once: true })
    window.addEventListener('wheel', onInput, { once: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', onInput)
      window.removeEventListener('wheel', onInput)
    }
  }, [show])
  if (!show) return null
  const items = isMobile()
    ? lang === 'zh'
      ? ['單指拖曳旋轉', '雙指縮放', '點擊選擇天體']
      : ['Drag to rotate', 'Pinch to zoom', 'Tap to select']
    : lang === 'zh'
      ? ['拖曳旋轉', '滾輪縮放 · 放大可進入下一層級', '雙擊前往天體', '/ 搜尋']
      : ['Drag to rotate', 'Scroll to zoom — zoom in to descend a scale level', 'Double-click to travel', '/ to search']
  return (
    <div className="fade-in pointer-events-none absolute bottom-[96px] left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-x-4 gap-y-1 px-4 text-center text-[11px] tracking-wide text-muted md:bottom-[100px]" style={{ animationDelay: '2.4s' }}>
      {items.map((i) => (
        <span key={i}>{i}</span>
      ))}
    </div>
  )
}
