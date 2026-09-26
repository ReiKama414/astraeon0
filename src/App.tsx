import { useEffect, useState } from 'react'
import { Stage } from './scenes/Stage'
import { useApp } from './store/useAppStore'
import { detectQuality } from './core/quality'
import { useFavorites } from './core/favorites'
import { HUD } from './ui/HUD'
import { LabelLayer } from './ui/LabelLayer'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { rig } from './scenes/common/cameraRig'
import { SCALES } from './core/coords/SceneScaleManager'

function webglOk(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export function App() {
  const [webgl] = useState(webglOk)
  const [intro, setIntro] = useState(true)

  useEffect(() => {
    useApp.getState().set({ resolvedQuality: detectQuality() })
    useFavorites.getState().load()
    // opening shot: sweep in toward the Local Group
    rig.distance = SCALES.universe.maxDistance * 0.4
    rig.yaw = 0.9
    rig.pitch = -0.55
    rig.target.set(0, 0, 0)
    const t0 = performance.now()
    const from = rig.distance
    let raf = 0
    const step = () => {
      if (rig.travel || useApp.getState().transitioning || performance.now() - rig.lastInput < 200) return
      const t = Math.min(1, (performance.now() - t0) / 5200)
      const e = 1 - Math.pow(1 - t, 3)
      rig.distance = Math.exp(Math.log(from) + (Math.log(SCALES.universe.defaultDistance) - Math.log(from)) * e)
      rig.yaw = 0.9 - 0.5 * e
      rig.pitch = -0.55 + 0.1 * e
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const h = setTimeout(() => setIntro(false), 350)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(h)
    }
  }, [])

  if (!webgl) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <div className="font-display text-4xl tracking-[0.3em]">ASTRALIS</div>
          <p className="mt-4 text-sm text-muted">This experience needs WebGL 2, which is unavailable in this browser or has been disabled. Please try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ErrorBoundary>
        <Stage />
      </ErrorBoundary>
      <LabelLayer />
      <HUD />
      <div className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#010108] transition-opacity duration-[2600ms] ${intro ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: intro ? '0ms' : '100ms' }}>
        <div className="text-center">
          <div className="font-display text-5xl font-light tracking-[0.45em] text-ink/90 md:text-6xl">ASTRALIS</div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.5em] text-muted">Cinematic Universe Explorer</div>
        </div>
      </div>
    </>
  )
}
