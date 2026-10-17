import { gauss, type Rng } from '../../core/procedural/rng'

/**
 * Additional parametric nebula / cluster models: planetary nebulae, Lagoon, Horsehead,
 * open & globular clusters, and five dreamlike fantasy styles.
 * All functions write through the minimal Builder interface below.
 */
export interface B {
  emit(x: number, y: number, z: number, c: number[], size: number, rot: number, bright?: number): void
  dust(x: number, y: number, z: number, c: number[], size: number, rot: number, alpha?: number): void
  star(x: number, y: number, z: number, c: number[], size: number): void
}
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
function dir(r: Rng): [number, number, number] {
  const u = r() * 2 - 1
  const t = r() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}
const HOT = [0.72, 0.84, 1.0]
const WARM = [1.0, 0.86, 0.66]
const RED = [1.0, 0.62, 0.42]

function field(b: B, r: Rng, n: number, R: number) {
  for (let i = 0; i < n; i++) {
    const [x, y, z] = dir(r)
    const rr = R * (0.6 + 0.4 * r())
    b.star(x * rr, y * rr, z * rr, mix(r() < 0.5 ? HOT : WARM, [1, 1, 1], r() * 0.4), 0.3 + Math.pow(r(), 6) * 1.8)
  }
}

/** Ring / Helix: a thick toroidal shell seen near pole-on, O III core, Hα/N II rim, faint halo. */
export function planetary(b: B, r: Rng, n: number, pal: number[][], helix: boolean) {
  const [inner, rim, halo] = pal
  const R = helix ? 44 : 34
  for (let i = 0; i < n * 0.55; i++) {
    const a = r() * Math.PI * 2
    const rr = R * (0.72 + 0.28 * Math.pow(r(), 0.7)) * (1 + 0.08 * Math.sin(a * 3 + 1))
    const t = (rr / R - 0.72) / 0.28
    const y = gauss(r) * R * (helix ? 0.22 : 0.3) * (1 - t * 0.5)
    b.emit(Math.cos(a) * rr * 1.15, y, Math.sin(a) * rr, mix(inner, rim, Math.min(1, t * 1.2 + 0.1)), 4 + r() * 8, r() * 6.28, 0.35 + t * 0.35)
  }
  for (let i = 0; i < n * 0.22; i++) {
    const [x, y, z] = dir(r)
    const rr = R * 0.7 * Math.cbrt(r())
    b.emit(x * rr * 1.1, y * rr * 0.8, z * rr, inner, 6 + r() * 10, r() * 6.28, 0.18)
  }
  for (let i = 0; i < n * 0.15; i++) {
    const a = r() * Math.PI * 2
    const rr = R * (1.15 + r() * (helix ? 0.9 : 0.6))
    b.emit(Math.cos(a) * rr * 1.1, gauss(r) * R * 0.35, Math.sin(a) * rr, halo, 8 + r() * 14, r() * 6.28, 0.07)
  }
  if (helix) {
    // cometary knots: tiny dark heads with bright rims pointing at the central star
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2
      const rr = R * (0.55 + 0.25 * r())
      const x = Math.cos(a) * rr * 1.15, z = Math.sin(a) * rr, y = gauss(r) * 3
      b.dust(x, y, z, [0.05, 0.03, 0.03], 1.2, 0, 0.9)
      b.emit(x * 0.985, y, z * 0.985, rim, 1.1, 0, 1.1)
    }
  }
  b.star(0, 0, 0, [0.85, 0.9, 1], 2.6) // white dwarf
  field(b, r, 160, 160)
}

/** Lagoon Nebula: broad pink H II cloud, a dark lane, the bright "Hourglass" and the NGC 6530 cluster. */
export function lagoon(b: B, r: Rng, n: number, pal: number[][]) {
  const [ha, core, teal, dust] = pal
  for (let i = 0; i < n * 0.6; i++) {
    const x = gauss(r) * 62, y = gauss(r) * 28, z = gauss(r) * 20
    const t = Math.min(1, Math.hypot(x * 0.6, y) / 60)
    b.emit(x, y, z, mix(ha, teal, Math.max(0, t - 0.55) * 0.8), 10 + r() * 20, r() * 6.28, 0.14 + (1 - t) * 0.14)
  }
  for (let i = 0; i < n * 0.08; i++) b.emit(-18 + gauss(r) * 5, 2 + gauss(r) * 4, 6 + gauss(r) * 3, core, 3 + r() * 5, r() * 6.28, 1.2) // Hourglass
  for (let i = 0; i < n * 0.16; i++) {
    const t = gauss(r) * 55
    b.dust(t, -4 + t * 0.12 + gauss(r) * 4, 14 + gauss(r) * 4, [dust[0] * 0.25, dust[1] * 0.22, dust[2] * 0.22], 6 + r() * 9, r() * 6.28, 0.75)
  }
  for (let i = 0; i < 160; i++) b.star(24 + gauss(r) * 12, gauss(r) * 9, 8 + gauss(r) * 8, HOT, 0.7 + Math.pow(r(), 5) * 3)
  field(b, r, 260, 110)
}

/** Horsehead: the dark Barnard 33 silhouette rising in front of the glowing IC 434 curtain. */
export function horsehead(b: B, r: Rng, n: number, pal: number[][]) {
  const [ha, edge, blue, dust] = pal
  // emission curtain: bright above a straight ionisation front, fading upward
  for (let i = 0; i < n * 0.5; i++) {
    const x = (r() - 0.5) * 150
    const y = -8 + Math.pow(r(), 1.6) * 80
    const z = -24 + gauss(r) * 6
    const near = Math.exp(-(y + 8) / 22)
    b.emit(x, y, z, mix(ha, edge, near * 0.5), 10 + r() * 16, r() * 6.28, 0.12 + near * 0.25)
  }
  const dustC = [dust[0] * 0.12, dust[1] * 0.1, dust[2] * 0.1]
  // the dark cloud below the front
  for (let i = 0; i < n * 0.22; i++) b.dust((r() - 0.5) * 160, -12 - Math.pow(r(), 0.7) * 60, -10 + gauss(r) * 6, dustC, 9 + r() * 12, r() * 6.28, 0.95)
  // horse head & neck: a chain of blobs forming the famous profile
  const profile: [number, number, number][] = [[-4, -10, 7], [-4, -2, 6.5], [-2, 6, 6], [2, 12, 6.5], [7, 16, 5.5], [12, 15, 4.2], [15, 11, 3.2], [16, 7, 2.6], [5, 20, 3], [0, 18, 3.5]]
  for (const [px, py, pr] of profile)
    for (let i = 0; i < 160; i++) {
      const [dx, dy, dz] = dir(r)
      const rr = pr * Math.cbrt(r())
      b.dust(px + dx * rr, py + dy * rr, -6 + dz * rr * 0.6, dustC, 1.8 + r() * 2.6, r() * 6.28, 0.97)
    }
  // NGC 2023 reflection nebula (blue) and Sigma Orionis
  for (let i = 0; i < n * 0.06; i++) b.emit(-44 + gauss(r) * 7, -30 + gauss(r) * 6, 4, blue, 5 + r() * 8, r() * 6.28, 0.35)
  b.star(-44, -30, 5, HOT, 2.2)
  b.star(30, 62, 10, HOT, 3.6)
  field(b, r, 220, 120)
}

/** Pleiades: hot blue B stars wrapped in delicate reflection nebulosity (Merope's veil). */
export function pleiades(b: B, r: Rng, n: number, pal: number[][]) {
  const [blue, pale] = pal
  const sisters: [number, number, number, number][] = [[0, 0, 0, 4.6], [-14, 6, 3, 3.6], [10, 10, -2, 3.4], [-8, -12, 5, 3.3], [18, -4, 1, 3.1], [-22, -4, -4, 2.8], [6, -18, -3, 2.6], [-2, 16, 6, 2.4], [24, 8, 4, 2.2]]
  for (const [x, y, z, s] of sisters) {
    b.star(x, y, z, HOT, s)
    // soft wisps streaming across the brighter stars
    for (let i = 0; i < n * 0.05; i++) {
      const t = gauss(r)
      b.emit(x + t * 12 + gauss(r) * 3, y + t * 5 + gauss(r) * 3, z + gauss(r) * 3, mix(blue, pale, r() * 0.5), 3 + r() * 6, 0.4 + r() * 0.3, 0.16)
    }
  }
  for (let i = 0; i < n * 0.3; i++) b.emit(gauss(r) * 30, gauss(r) * 24, gauss(r) * 18, blue, 10 + r() * 16, r() * 6.28, 0.035)
  for (let i = 0; i < 500; i++) {
    const [x, y, z] = dir(r)
    const rr = 45 * Math.pow(r(), 0.8)
    b.star(x * rr, y * rr, z * rr, mix(HOT, WARM, Math.pow(r(), 2)), 0.25 + Math.pow(r(), 5) * 1.6)
  }
  field(b, r, 200, 140)
}

/** Globular cluster: a King-profile swarm of old stars, red giants dotted through a golden core. */
export function globular(b: B, r: Rng, n: number, big: boolean) {
  const N = Math.floor(n * (big ? 4.5 : 3))
  const rc = big ? 5 : 3.5
  for (let i = 0; i < N; i++) {
    const [x, y, z] = dir(r)
    const u = r()
    const rr = rc * Math.sqrt(1 / Math.max(1e-3, 1 - u * 0.985) - 1) * 1.2
    if (rr > 60) continue
    const giant = r() < 0.03
    const c = giant ? RED : mix(WARM, HOT, Math.pow(r(), 3) * 0.6)
    b.star(x * rr, y * rr, z * rr, c, giant ? 0.9 + r() * 0.8 : 0.22 + Math.pow(r(), 6) * 0.7)
  }
  for (let i = 0; i < 400; i++) {
    const [x, y, z] = dir(r)
    const rr = rc * 1.4 * Math.cbrt(r())
    b.emit(x * rr, y * rr, z * rr, [1, 0.85, 0.6], 6, 0, 0.05)
  }
  field(b, r, 150, 160)
}

// ---------------------------------------------------------------- fantasy styles
export type FantasyStyle = 'rose' | 'veil' | 'bloom' | 'ring' | 'river'
export const FANTASY_STYLES: FantasyStyle[] = ['rose', 'veil', 'bloom', 'ring', 'river']

export function fantasyNebula(b0: B, r: Rng, n: number, pal: number[][], style: FantasyStyle) {
  const [c0, c1, c2, c3] = pal
  // additive layers pile up fast: keep each wisp faint so colour survives instead of burning to white
  const gain = 0.2 * Math.min(1, 6000 / Math.max(1, n)) * (style === 'veil' ? 3 : 1)
  const b: B = {
    emit: (x, y, z, c, s, rot, br = 1) => b0.emit(x, y, z, c, s, rot, br * gain),
    dust: (x, y, z, c, s, rot, a) => b0.dust(x, y, z, c, s, rot, a),
    star: (x, y, z, c, s) => b0.star(x, y, z, c, s),
  }
  if (style === 'rose') {
    // layered petals spiralling outward, like a cosmic flower
    const petals = 5 + Math.floor(r() * 4)
    for (let i = 0; i < n * 0.8; i++) {
      const k = Math.floor(r() * petals)
      const t = Math.pow(r(), 0.8)
      const a = (k / petals) * Math.PI * 2 + t * 1.6 + Math.sin(t * 6) * 0.15
      const rad = 10 + t * 62
      const w = 3 + t * 6
      b.emit(Math.cos(a) * rad + gauss(r) * w * 0.5, gauss(r) * w * 0.5 * (1 - t * 0.4), Math.sin(a) * rad + gauss(r) * w * 0.5, mix(mix(c0, c1, t), c2, Math.max(0, t - 0.6)), 4 + r() * 9, a + Math.PI / 2, 0.45 + (1 - t) * 0.4)
    }
    for (let i = 0; i < n * 0.03; i++) b.emit(gauss(r) * 6, gauss(r) * 4, gauss(r) * 6, [1, 0.95, 0.9], 4 + r() * 6, 0, 0.5)
  } else if (style === 'veil') {
    // auroral curtains: folded ribbons made of vertical light streaks, bright at the base, fading upward
    const sheets = 3 + Math.floor(r() * 3)
    const perSheet = Math.floor((n * 0.9) / sheets)
    for (let sIdx = 0; sIdx < sheets; sIdx++) {
      const z0 = (sIdx - sheets / 2) * 22
      const phase = r() * 6.28
      const base = -26 + gauss(r) * 6
      const colA = [c0, c1, c3][sIdx % 3]
      const colB = [c1, c2, c0][sIdx % 3]
      const columns = Math.floor(perSheet / 12)
      for (let k = 0; k < columns; k++) {
        const x = (k / columns - 0.5) * 170 + gauss(r) * 0.8
        const fold = Math.sin(x * 0.045 + phase) * 18 + Math.sin(x * 0.11 + phase * 2) * 6
        const h = 30 + 28 * (0.5 + 0.5 * Math.sin(x * 0.07 + phase * 3)) * (0.6 + 0.4 * r())
        const y0 = base + Math.sin(x * 0.03 + phase) * 6
        const bright = 0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(x * 0.4 + phase * 5), 3)
        for (let m = 0; m < 12; m++) {
          const t = m / 11
          const fade = Math.pow(1 - t, 1.6) * (t < 0.08 ? t / 0.08 : 1)
          b.emit(x, y0 + t * h, z0 + fold, mix(colA, colB, t), 3.6 + t * 4, Math.PI / 2, 1.4 * bright * fade + 0.05)
        }
      }
    }
  } else if (style === 'bloom') {
    // radial filaments bursting from a luminous heart
    const rays = 180 + Math.floor(r() * 120)
    for (let k = 0; k < rays; k++) {
      const [dx, dy, dz] = dir(r)
      const len = 30 + r() * 45
      const col = r() < 0.5 ? c0 : c1
      for (let j = 0; j < 14; j++) {
        const t = j / 14
        const rr = 6 + t * len
        b.emit(dx * rr + gauss(r) * 0.8, dy * rr * 0.8 + gauss(r) * 0.8, dz * rr + gauss(r) * 0.8, mix(col, c2, t), 2 + t * 4, r() * 6.28, 2.2 * (1 - t) + 0.3)
      }
    }
    for (let i = 0; i < n * 0.15; i++) {
      const [x, y, z] = dir(r)
      const rr = 18 * Math.cbrt(r())
      b.emit(x * rr, y * rr, z * rr, c3, 8 + r() * 10, 0, 0.12)
    }
  } else if (style === 'ring') {
    // iridescent halo rings like a giant cosmic bubble
    const rings = 3 + Math.floor(r() * 3)
    for (let k = 0; k < rings; k++) {
      const R = 24 + k * 14
      const tilt = gauss(r) * 0.3
      const col = [c0, c1, c2, c3][k % 4]
      for (let i = 0; i < (n * 0.8) / rings; i++) {
        const a = r() * Math.PI * 2
        const rr = R + gauss(r) * 2.5
        const y = gauss(r) * 2 + Math.sin(a) * rr * tilt
        b.emit(Math.cos(a) * rr, y, Math.sin(a) * rr, mix(col, [1, 1, 1], 0.15 * Math.sin(a * 3) ** 2), 3 + r() * 6, r() * 6.28, 0.28)
      }
    }
    b.star(0, 0, 0, [1, 0.95, 0.9], 3)
  } else {
    // river: a luminous stream meandering across the sky, with star-forming pearls
    for (let i = 0; i < n * 0.85; i++) {
      const t = r()
      const x = (t - 0.5) * 180
      const y = Math.sin(t * 7) * 18
      const z = Math.cos(t * 4.3) * 22
      const w = 7 + 5 * Math.sin(t * 13) ** 2
      b.emit(x + gauss(r) * w, y + gauss(r) * w * 0.6, z + gauss(r) * w, mix(c0, c1, (Math.sin(t * 9) + 1) / 2), 5 + r() * 11, r() * 6.28, 0.22)
    }
    for (let k = 0; k < 9; k++) {
      const t = r()
      const cx = (t - 0.5) * 180, cy = Math.sin(t * 7) * 18, cz = Math.cos(t * 4.3) * 22
      for (let i = 0; i < 70; i++) b.emit(cx + gauss(r) * 3, cy + gauss(r) * 3, cz + gauss(r) * 3, c2, 2 + r() * 3, 0, 0.9)
      b.star(cx, cy, cz, [1, 0.97, 0.92], 2.2)
    }
  }
  // sparkling foreground dust of tiny stars gives every fantasy nebula a dreamy glitter
  for (let i = 0; i < 320; i++) {
    const [x, y, z] = dir(r)
    const rr = 80 * Math.pow(r(), 0.7)
    b.star(x * rr, y * rr * 0.7, z * rr, mix([1, 1, 1], c1, r() * 0.5), 0.12 + Math.pow(r(), 10) * 0.9)
  }
  field(b, r, 80, 150)
}
