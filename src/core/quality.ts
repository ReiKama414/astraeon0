import type { ResolvedQuality } from '../store/useAppStore'

export interface QualityProfile {
  dpr: [number, number]
  msaa: number
  galaxyStars: number
  galaxyHaze: number
  farGalaxyStars: number
  backgroundStars: number
  cosmicWeb: number
  textureSize: number
  sphereSegments: number
  nebulaSprites: number
  bhSteps: number
  bloom: boolean
  bloomLevels: number
  smaa: boolean
  asteroidCount: number
}

export const QUALITY: Record<ResolvedQuality, QualityProfile> = {
  low: { msaa: 0, dpr: [0.75, 1], galaxyStars: 70000, galaxyHaze: 2500, farGalaxyStars: 5000, backgroundStars: 9000, cosmicWeb: 30000, textureSize: 512, sphereSegments: 48, nebulaSprites: 2200, bhSteps: 90, bloom: true, bloomLevels: 4, smaa: false, asteroidCount: 2500 },
  medium: { msaa: 2, dpr: [1, 1.5], galaxyStars: 160000, galaxyHaze: 5000, farGalaxyStars: 9000, backgroundStars: 16000, cosmicWeb: 60000, textureSize: 1024, sphereSegments: 72, nebulaSprites: 4500, bhSteps: 140, bloom: true, bloomLevels: 5, smaa: false, asteroidCount: 5000 },
  high: { msaa: 4, dpr: [1, 2], galaxyStars: 320000, galaxyHaze: 9000, farGalaxyStars: 16000, backgroundStars: 26000, cosmicWeb: 110000, textureSize: 2048, sphereSegments: 128, nebulaSprites: 8000, bhSteps: 200, bloom: true, bloomLevels: 6, smaa: true, asteroidCount: 9000 },
  ultra: { msaa: 4, dpr: [1, 2], galaxyStars: 600000, galaxyHaze: 14000, farGalaxyStars: 26000, backgroundStars: 40000, cosmicWeb: 180000, textureSize: 4096, sphereSegments: 192, nebulaSprites: 13000, bhSteps: 280, bloom: true, bloomLevels: 7, smaa: true, asteroidCount: 15000 },
}

/** Rough device capability probe used to resolve "auto". */
export function detectQuality(): ResolvedQuality {
  if (typeof window === 'undefined') return 'medium'
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100)
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 4
  let gpu = ''
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    /* ignore */
  }
  const weakGpu = /Intel\(R\) (HD|UHD) Graphics [0-9]{3}\b|Mali-4|Adreno \(TM\) [3-5]|PowerVR|SwiftShader|llvmpipe/i.test(gpu)
  if (mobile) return mem >= 6 && !weakGpu ? 'medium' : 'low'
  if (weakGpu || cores <= 4 || mem <= 4) return 'medium'
  if (/RTX [34-9]0|RX [67-9][0-9]{3}|Apple M[2-9] (Pro|Max|Ultra)/i.test(gpu)) return 'ultra'
  return 'high'
}

export function isMobile() {
  return typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)
}
