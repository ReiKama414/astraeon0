/**
 * Dev-only QA harness (never bundled in production): lets automated checks drive the app in a
 * throttled/hidden browser pane — pump frames, travel, and save canvas captures via /__shot.
 */
import gsap from 'gsap'
import { advance } from '@react-three/fiber'
import { useApp } from '../store/useAppStore'
import { rig } from '../scenes/common/cameraRig'
import { travelTo } from '../core/navigation/Navigator'
import { registry } from '../core/registry/CelestialRegistry'
import * as generator from '../core/procedural/generator'
import { captureScreenshot } from '../core/capture'

let pump: ReturnType<typeof setInterval> | null = null

const h = {
  start() {
    gsap.ticker.lagSmoothing(0)
    if (pump) clearInterval(pump)
    pump = setInterval(() => {
      gsap.ticker.tick()
      advance(performance.now())
    }, 33)
    useApp.getState().set({ quality: 'high', resolvedQuality: 'high' })
    rig.lastInput = performance.now() + 1e7
    return 'pumping'
  },
  async go(id: string, settleMs = 2200) {
    await travelTo(id)
    useApp.getState().set({ selectedId: null })
    await new Promise((r) => setTimeout(r, settleMs))
    return useApp.getState().sceneId
  },
  async shot(name: string, scale = 0.5) {
    for (let i = 0; i < 100 && (rig.warp > 0.01 || rig.fade > 0.01 || useApp.getState().transitioning); i++) await new Promise((r) => setTimeout(r, 100))
    const orig = HTMLAnchorElement.prototype.click
    let url = ''
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      url = this.href
    }
    try {
      await captureScreenshot(scale)
    } finally {
      HTMLAnchorElement.prototype.click = orig
    }
    await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url })
    return name
  },
  rig,
  app: useApp,
  registry,
  generator,
}

;(window as unknown as { __h: typeof h }).__h = h
