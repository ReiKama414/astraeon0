/**
 * Galaxy particle model (pure function — runs inside a Web Worker).
 * Produces a 3D star distribution: bulge, bar, exponential disk, logarithmic spiral arms,
 * dust lanes, H II regions and an unresolved-starlight haze layer.
 */
import type { GalaxyVisual } from '../core/registry/types'
import { mulberry32, gauss } from '../core/procedural/rng'

export interface GalaxyBuffers {
  stars: { position: Float32Array; color: Float32Array; size: Float32Array }
  dust: { position: Float32Array; color: Float32Array; size: Float32Array }
  haze: { position: Float32Array; color: Float32Array; size: Float32Array }
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function tempColor(t: number): [number, number, number] {
  const k = t / 100
  let r: number, g: number, b: number
  if (k <= 66) {
    r = 255
    g = 99.47 * Math.log(k) - 161.12
    b = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04
  } else {
    r = 329.7 * Math.pow(k - 60, -0.1332)
    g = 288.12 * Math.pow(k - 60, -0.0755)
    b = 255
  }
  return [Math.min(1, Math.max(0, r / 255)), Math.min(1, Math.max(0, g / 255)), Math.min(1, Math.max(0, b / 255))]
}

export function generateGalaxy(g: GalaxyVisual, starCount: number, hazeCount: number, unitsPerKpc: number): GalaxyBuffers {
  const rnd = mulberry32(g.seed)
  const R = g.radiusKpc
  const core = hexToRgb(g.coreColor)
  const armC = hexToRgb(g.armColor)
  const hii = hexToRgb(g.hiiColor ?? '#ff6f9f')
  const dustC = hexToRgb(g.dustColor ?? '#1a0f0a')
  const spiral = g.morphology === 'spiral' || g.morphology === 'barred-spiral' || g.morphology === 'lenticular'
  const elliptical = g.morphology === 'elliptical'
  const irregular = g.morphology === 'irregular'
  const bar = g.barLength ? g.barLength * R : 0
  const Rd = R / 3.6
  const pitch = g.armTightness
  const r0 = Math.max(bar, R * 0.08)
  const q = 1 - (g.ellipticity ?? 0)

  const sp = new Float32Array(starCount * 3)
  const sc = new Float32Array(starCount * 3)
  const ss = new Float32Array(starCount)
  const dustN = spiral ? Math.floor(starCount * 0.07) : elliptical ? 0 : Math.floor(starCount * 0.03)
  const dp = new Float32Array(dustN * 3)
  const dc = new Float32Array(dustN * 3)
  const ds = new Float32Array(dustN)
  const hp = new Float32Array(hazeCount * 3)
  const hc = new Float32Array(hazeCount * 3)
  const hs = new Float32Array(hazeCount)

  // irregular galaxy clumps
  const clumps = irregular ? Array.from({ length: 7 }, () => [gauss(rnd) * R * 0.35, gauss(rnd) * R * 0.08, gauss(rnd) * R * 0.3, R * (0.15 + rnd() * 0.25)]) : []

  const armAngle = (r: number, k: number) => Math.log(Math.max(r, r0) / r0) / pitch + (k * 2 * Math.PI) / Math.max(1, g.arms)

  const sample = (out: [number, number, number], kind: 'star' | 'dust' | 'haze'): number => {
    // returns category: 0 bulge, 1 bar, 2 disk, 3 arm, 4 hii, 5 halo/globular
    const u = rnd()
    if (elliptical) {
      const rr = R * 0.18 * (1 / Math.sqrt(Math.max(1e-4, rnd())) - 1)
      const r = Math.min(rr, R * 1.6)
      const ct = rnd() * 2 - 1
      const ph = rnd() * Math.PI * 2
      const st = Math.sqrt(1 - ct * ct)
      out[0] = r * st * Math.cos(ph)
      out[1] = r * ct * q
      out[2] = r * st * Math.sin(ph) * (0.85 + 0.15 * q)
      if (kind === 'star' && rnd() < 0.012) {
        const gr = R * (0.4 + rnd() * 1.4)
        const a = rnd() * Math.PI * 2
        const c2 = rnd() * 2 - 1
        const s2 = Math.sqrt(1 - c2 * c2)
        out[0] = gr * s2 * Math.cos(a)
        out[1] = gr * c2
        out[2] = gr * s2 * Math.sin(a)
        return 5
      }
      return 0
    }
    if (irregular) {
      if (u < 0.7) {
        const c = clumps[Math.floor(rnd() * clumps.length)]
        out[0] = c[0] + gauss(rnd) * c[3]
        out[1] = c[1] + gauss(rnd) * c[3] * 0.3
        out[2] = c[2] + gauss(rnd) * c[3]
        return rnd() < 0.08 ? 4 : 3
      }
      if (bar && u < 0.85) {
        out[0] = gauss(rnd) * bar * 0.5
        out[1] = gauss(rnd) * bar * 0.08
        out[2] = gauss(rnd) * bar * 0.14
        return 1
      }
      const r = -Rd * Math.log(Math.max(1e-6, rnd() * rnd()))
      const a = rnd() * Math.PI * 2
      out[0] = Math.cos(a) * r
      out[1] = gauss(rnd) * R * g.diskThickness
      out[2] = Math.sin(a) * r * 0.8
      return 2
    }
    // --- spiral / barred / lenticular ---
    const bulgeFrac = g.bulgeRatio
    if (u < bulgeFrac) {
      const rb = R * (g.morphology === 'lenticular' ? 0.22 : 0.1)
      const r = rb * Math.pow(-Math.log(Math.max(1e-6, rnd())), 1.4) * 0.6
      const ct = rnd() * 2 - 1
      const ph = rnd() * Math.PI * 2
      const st = Math.sqrt(1 - ct * ct)
      out[0] = r * st * Math.cos(ph)
      out[1] = r * ct * 0.62
      out[2] = r * st * Math.sin(ph)
      return 0
    }
    if (bar && u < bulgeFrac + 0.1) {
      out[0] = gauss(rnd) * bar * 0.42
      out[1] = gauss(rnd) * bar * 0.05
      out[2] = gauss(rnd) * bar * 0.12
      return 1
    }
    let r = -Rd * Math.log(Math.max(1e-6, rnd() * (0.3 + 0.7 * rnd())))
    if (r > R * 1.25) r = R * rnd()
    const inArm = kind !== 'haze' ? rnd() < (g.morphology === 'lenticular' ? 0.1 : 0.66) : rnd() < 0.5
    let a: number
    let cat = 2
    if (inArm && g.arms > 0 && r > r0 * 0.7) {
      const k = Math.floor(rnd() * g.arms)
      const spread = (0.18 + 0.22 * (r / R)) * (kind === 'dust' ? 0.45 : 1)
      a = armAngle(r, k) + gauss(rnd) * spread + (kind === 'dust' ? -0.14 : 0)
      cat = kind === 'star' && rnd() < 0.035 ? 4 : 3
    } else {
      a = rnd() * Math.PI * 2
    }
    const thick = R * g.diskThickness * (cat === 3 || cat === 4 ? 0.6 : 1.2) * (1 + 0.6 * (r / R)) * (kind === 'dust' ? 0.5 : 1)
    out[0] = Math.cos(a) * r
    out[1] = gauss(rnd) * thick
    out[2] = Math.sin(a) * r
    return cat
  }

  const p: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < starCount; i++) {
    const cat = sample(p, 'star')
    sp[i * 3] = p[0] * unitsPerKpc
    sp[i * 3 + 1] = p[1] * unitsPerKpc
    sp[i * 3 + 2] = p[2] * unitsPerKpc
    const rn = Math.hypot(p[0], p[2]) / R
    let col: [number, number, number]
    let size = 0.6 + Math.pow(rnd(), 6) * 2.6
    let bright = 0.55 + rnd() * 0.45
    if (cat === 0 || cat === 1 || cat === 5) {
      const t = 3400 + rnd() * 2200
      const tc = tempColor(t)
      col = [tc[0] * 0.35 + core[0] * 0.65, tc[1] * 0.35 + core[1] * 0.65, tc[2] * 0.35 + core[2] * 0.65]
      bright *= cat === 5 ? 1.6 : 1.15
      if (cat === 5) size *= 1.4
    } else if (cat === 4) {
      col = hii
      size = 1.2 + rnd() * 1.6
      bright = 1.6
    } else if (cat === 3) {
      const young = rnd() < 0.45
      const t = young ? 9000 + rnd() * 20000 : 4500 + rnd() * 3500
      const tc = tempColor(t)
      col = [tc[0] * 0.4 + armC[0] * 0.6, tc[1] * 0.4 + armC[1] * 0.6, tc[2] * 0.4 + armC[2] * 0.6]
      if (young) {
        size *= 1.3
        bright *= 1.35
      }
    } else {
      const t = 3800 + rnd() * 3800
      const tc = tempColor(t)
      const mix = Math.min(1, rn * 1.3)
      col = [tc[0] * (1 - mix * 0.3) + armC[0] * mix * 0.3, tc[1] * (1 - mix * 0.3) + armC[1] * mix * 0.3, tc[2] * (1 - mix * 0.3) + armC[2] * mix * 0.3]
      bright *= 0.6
    }
    sc[i * 3] = col[0] * bright
    sc[i * 3 + 1] = col[1] * bright
    sc[i * 3 + 2] = col[2] * bright
    ss[i] = size
  }
  for (let i = 0; i < dustN; i++) {
    // dust lanes live in the disk: keep them out of the bright bulge so the core stays luminous
    let tries = 0
    do sample(p, 'dust')
    while (Math.hypot(p[0], p[2]) < R * (bar ? 0.22 : 0.16) && ++tries < 8)
    dp[i * 3] = p[0] * unitsPerKpc
    dp[i * 3 + 1] = p[1] * unitsPerKpc
    dp[i * 3 + 2] = p[2] * unitsPerKpc
    const v = 0.6 + rnd() * 0.4
    dc[i * 3] = dustC[0] * v
    dc[i * 3 + 1] = dustC[1] * v
    dc[i * 3 + 2] = dustC[2] * v
    ds[i] = 2.5 + rnd() * 5
  }
  for (let i = 0; i < hazeCount; i++) {
    const cat = sample(p, 'haze')
    hp[i * 3] = p[0] * unitsPerKpc
    hp[i * 3 + 1] = p[1] * unitsPerKpc * 0.7
    hp[i * 3 + 2] = p[2] * unitsPerKpc
    const c = cat === 0 || cat === 1 ? core : cat === 3 ? armC : [(core[0] + armC[0]) / 2, (core[1] + armC[1]) / 2, (core[2] + armC[2]) / 2]
    const pink = cat === 3 && rnd() < 0.12
    const b = 0.5 + rnd() * 0.5
    hc[i * 3] = (pink ? hii[0] : c[0]) * b
    hc[i * 3 + 1] = (pink ? hii[1] : c[1]) * b
    hc[i * 3 + 2] = (pink ? hii[2] : c[2]) * b
    hs[i] = (cat === 0 ? 1.6 : 1) * (6 + rnd() * 10)
  }
  return {
    stars: { position: sp, color: sc, size: ss },
    dust: { position: dp, color: dc, size: ds },
    haze: { position: hp, color: hc, size: hs },
  }
}
