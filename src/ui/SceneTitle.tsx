import { useEffect, useState } from 'react'
import { useApp } from '../store/useAppStore'
import { registry } from '../core/registry/CelestialRegistry'
import { displayName } from './i18n'

/** Cinematic title that fades in when a new scale/scene is entered. */
export function SceneTitle() {
  const sceneId = useApp((s) => s.sceneId)
  const lang = useApp((s) => s.lang)
  const tour = useApp((s) => s.tour.active)
  const [show, setShow] = useState<string | null>(null)
  useEffect(() => {
    const host = registry.get(registry.sceneById(sceneId).hostId)
    if (!host) return
    setShow(sceneId)
    const t = setTimeout(() => setShow(null), 3800)
    return () => clearTimeout(t)
  }, [sceneId])
  if (!show || tour) return null
  const scene = registry.sceneById(show)
  const host = registry.get(scene.hostId)
  if (!host) return null
  const sub = { universe: ['Level 0 · Observable Universe', '層級 0 · 可觀測宇宙'], galaxy: ['Level 1–2 · Galaxy', '層級 1–2 · 星系'], system: ['Level 3–5 · Star System', '層級 3–5 · 恆星系統'], nebula: ['Level 3 · Deep-Space Object', '層級 3 · 深空天體'], 'black-hole': ['Level 4 · Black Hole · visual simulation', '層級 4 · 黑洞 · 視覺模擬'], sky: ['Celestial sphere from Earth', '從地球看見的天球'], 'fantasy-universe': ['Fictional sector · procedural', '虛構星區 · 程序化生成'] }[scene.kind]
  return (
    <div key={show} className="pointer-events-none absolute inset-x-0 top-[21%] text-center">
      <div className="scene-title eyebrow" style={{ animationDelay: '0.15s' }}>{sub[lang === 'zh' ? 1 : 0]}</div>
      <div className="scene-title mt-3 font-display font-semibold text-[40px] text-ink/90 md:text-[56px]">{displayName(host, lang)}</div>
    </div>
  )
}
