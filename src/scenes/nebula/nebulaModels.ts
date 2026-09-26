import type { NebulaVisual } from '../../core/registry/types'
import { mulberry32, gauss, type Rng } from '../../core/procedural/rng'

/**
 * Parametric 3D nebula models. Each returns layered billboard "cloudlets":
 * emission (additive), dust (absorbing) and embedded stars. Shapes are artistic
 * reconstructions guided by the objects' published morphology.
 */
export interface NebulaBuffers {
  emission: { pos: Float32Array; col: Float32Array; size: Float32Array; rot: Float32Array; alpha: Float32Array; n: number }
  dust: { pos: Float32Array; col: Float32Array; size: Float32Array; rot: Float32Array; alpha: Float32Array; n: number }
  stars: { pos: Float32Array; col: Float32Array; size: Float32Array; n: number }
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const mix3 = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

class Builder {
  e: number[][] = []
  d: number[][] = []
  s: number[][] = []
  emit(x: number, y: number, z: number, c: number[], size: number, rot: number, bright = 1) {
    this.e.push([x, y, z, c[0] * bright, c[1] * bright, c[2] * bright, size, rot])
  }
  dust(x: number, y: number, z: number, c: number[], size: number, rot: number, alpha = 1) {
    this.d.push([x, y, z, c[0], c[1], c[2], size, rot, alpha])
  }
  star(x: number, y: number, z: number, c: number[], size: number) {
    this.s.push([x, y, z, c[0], c[1], c[2], size])
  }
  build(): NebulaBuffers {
    const pack = (arr: number[][], withRot: boolean) => {
      const n = arr.length
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), rot = new Float32Array(n), alpha = new Float32Array(n)
      arr.forEach((a, i) => {
        pos.set(a.slice(0, 3), i * 3)
        col.set(a.slice(3, 6), i * 3)
        size[i] = a[6]
        if (withRot) rot[i] = a[7]
        alpha[i] = a[8] ?? 1
      })
      return { pos, col, size, rot, alpha, n }
    }
    const e = pack(this.e, true), d = pack(this.d, true), s = pack(this.s, false)
    return { emission: e, dust: d, stars: { pos: s.pos, col: s.col, size: s.size, n: s.n } }
  }
}

function sphereDir(r: Rng): [number, number, number] {
  const u = r() * 2 - 1
  const t = r() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}

const STAR_HOT = [0.75, 0.85, 1.0]
const STAR_WARM = [1.0, 0.88, 0.7]

function scatterStars(b: Builder, r: Rng, n: number, R: number, flat = 0.6) {
  for (let i = 0; i < n; i++) {
    const [x, y, z] = sphereDir(r)
    const rr = R * Math.cbrt(r())
    const hot = r() < 0.5
    b.star(x * rr, y * rr * flat, z * rr, mix3(hot ? STAR_HOT : STAR_WARM, [1, 1, 1], r() * 0.3), 0.3 + Math.pow(r(), 6) * 2.2)
  }
}

function orion(b: Builder, r: Rng, n: number, pal: number[][]) {
  const [ha, warm, oiii] = pal
  // concave blister cavity opening toward the viewer (+z)
  for (let i = 0; i < n * 0.62; i++) {
    const u = Math.sqrt(r())
    const a = r() * Math.PI * 2
    const rad = 62 * u
    const x = Math.cos(a) * rad * (1 + 0.25 * Math.sin(a * 3))
    const y = Math.sin(a) * rad * 0.85
    const z = -rad * rad * 0.012 - 18 + gauss(r) * 5
    const inner = 1 - u
    const col = mix3(ha, mix3(warm, oiii, inner), Math.pow(inner, 0.8))
    b.emit(x, y, z, col, 10 + r() * 22 * (0.5 + u), r() * 6.28, 0.35 + inner * 1.3)
  }
  // bright Huygens region around the Trapezium
  for (let i = 0; i < n * 0.12; i++) {
    const g = [gauss(r) * 9, gauss(r) * 7, gauss(r) * 5 - 6]
    b.emit(g[0], g[1], g[2], mix3(oiii, [1, 1, 1], 0.35), 6 + r() * 10, r() * 6.28, 3.2)
  }
  // wispy outer wings
  for (let i = 0; i < n * 0.18; i++) {
    const t = r()
    const side = r() < 0.5 ? -1 : 1
    const x = side * (30 + t * 55) + gauss(r) * 8
    const y = (t * t * 40 - 10) * (side > 0 ? 1 : -0.6) + gauss(r) * 8
    b.emit(x, y, -25 + gauss(r) * 10, ha, 12 + r() * 20, r() * 6.28, 0.35)
  }
  // dark bay ("Fish's Mouth") and foreground veil
  for (let i = 0; i < n * 0.25; i++) {
    const a = 0.7 + gauss(r) * 0.25
    const rad = 14 + r() * 26
    b.dust(Math.cos(a) * rad + 10, Math.sin(a) * rad + 4, 6 + gauss(r) * 4, [0.03, 0.02, 0.025], 10 + r() * 14, r() * 6.28, 0.55)
    b.dust(gauss(r) * 55, gauss(r) * 40 - 20, 20 + gauss(r) * 6, [0.06, 0.035, 0.03], 18 + r() * 20, r() * 6.28, 0.35)
  }
  // Trapezium: θ¹ Ori A–D, then the young ONC cluster
  const trap = [[1.2, 0.8, 0], [-0.8, 1.5, 0.4], [0.3, -1.1, -0.2], [-1.4, -0.4, 0.3]]
  trap.forEach(([x, y, z]) => b.star(x, y, z - 4, [0.8, 0.88, 1], 3.5))
  scatterStars(b, r, 380, 40)
}

function crab(b: Builder, r: Rng, n: number, pal: number[][]) {
  const [fil, fil2, sync, sync2] = pal
  // elongated SE–NW ellipsoid, tilted in the view
  const AX = [1.45, 1.0, 1.05]
  const tilt = 0.55
  const place = (x: number, y: number, z: number): [number, number, number] => {
    const X = x * AX[0], Y = y * AX[1], Z = z * AX[2]
    return [X * Math.cos(tilt) - Y * Math.sin(tilt), X * Math.sin(tilt) + Y * Math.cos(tilt), Z]
  }
  const R = 36
  // synchrotron nebula: faint bluish-white volume concentrated toward the pulsar
  for (let i = 0; i < n * 0.28; i++) {
    const [x, y, z] = sphereDir(r)
    const rr = R * 0.85 * Math.pow(r(), 0.8)
    const p = place(x * rr, y * rr, z * rr)
    const core = 1 - rr / (R * 0.85)
    b.emit(p[0], p[1], p[2], mix3(sync2, sync, core), 8 + r() * 12, r() * 6.28, 0.05 + core * 0.12)
  }
  // filament network: many thin, wandering strands through the outer 45 % of the volume
  const strands = Math.floor((n * 0.62) / 30)
  for (let w = 0; w < strands; w++) {
    let [x, y, z] = sphereDir(r)
    let rad = 0.55 + 0.45 * Math.sqrt(r())
    let [dx, dy, dz] = sphereDir(r)
    const col = r() < 0.55 ? fil : r() < 0.7 ? mix3(fil, [1, 0.95, 0.85], 0.4) : fil2
    for (let k = 0; k < 30; k++) {
      const [gx, gy, gz] = sphereDir(r)
      dx += gx * 0.5; dy += gy * 0.5; dz += gz * 0.5
      const l = Math.hypot(dx, dy, dz)
      x += (dx / l) * 0.035; y += (dy / l) * 0.035; z += (dz / l) * 0.035
      rad = Math.min(1, Math.max(0.5, rad + gauss(r) * 0.01))
      const m = Math.hypot(x, y, z)
      const p = place((x / m) * rad * R, (y / m) * rad * R, (z / m) * rad * R)
      b.emit(p[0], p[1], p[2], col, 1.6 + r() * 2.6, r() * 6.28, 0.55 + r() * 0.35)
    }
  }
  b.star(0, 0, 0, [0.85, 0.9, 1], 2.4) // Crab Pulsar (PSR B0531+21)
  scatterStars(b, r, 120, 120)
}

function eagle(b: Builder, r: Rng, n: number, pal: number[][]) {
  const [teal, gold, rim, dustC] = pal
  // background H II wall: gold near the pillars, teal (O III) toward the edges
  for (let i = 0; i < n * 0.4; i++) {
    const x = gauss(r) * 60, y = gauss(r) * 48 + 5
    const z = -34 + gauss(r) * 10
    const t = Math.min(1, Math.hypot(x * 0.8, y) / 75)
    b.emit(x, y, z, mix3(gold, teal, Math.min(1, t * 1.3 + gauss(r) * 0.12)), 12 + r() * 22, r() * 6.28, 0.2 + (1 - t) * 0.16)
  }
  // Pillars of Creation: three leaning, tapering dust columns along gently curved spines.
  // [base x, base y, z, height, base radius, lean]
  const pillars = [[-17, -52, 0, 64, 9, 5], [3, -50, 5, 44, 6.5, -3], [20, -52, -3, 30, 5.5, 4]]
  for (const [px, py, pz, h, w, lean] of pillars) {
    const per = Math.floor(n * 0.14)
    for (let i = 0; i < per; i++) {
      const t = Math.pow(r(), 0.85)
      const spineX = px + lean * t * t + Math.sin(t * 5 + px) * 1.5
      const radius = w * (1 - t * 0.55) * (0.7 + 0.45 * Math.sqrt(r()))
      const a = r() * Math.PI * 2
      const x = spineX + Math.cos(a) * radius
      const y = py + t * h + gauss(r) * 0.6
      const z = pz + Math.sin(a) * radius * 0.8
      // darker toward the core of the column, sRGB palette → linear-ish darkening
      const shade = (0.12 + 0.22 * r()) * (0.6 + 0.4 * (radius / w))
      b.dust(x, y, z, [dustC[0] * shade, dustC[1] * shade, dustC[2] * shade], 3.2 + r() * 4.5, r() * 6.28, 0.97)
      // photo-evaporating skin on the side facing the NGC 6611 cluster (upper right, toward viewer)
      const facing = Math.cos(a - 0.9)
      if (facing > 0.35 && r() < 0.7) b.emit(x + Math.cos(a) * 0.9, y, z + Math.sin(a) * 0.9, mix3(rim, gold, r() * 0.5), 1.6 + r() * 2.4, r() * 6.28, 0.9 + facing * 0.6)
    }
    // glowing, evaporating caps and wisps streaming off the tips
    for (let i = 0; i < 260; i++) {
      const t = r()
      b.emit(px + lean + gauss(r) * w * 0.5, py + h + t * 7, pz + gauss(r) * w * 0.4, mix3(gold, rim, r()), 2 + r() * 3.5, r() * 6.28, 1.2 * (1 - t))
    }
  }
  // foreground dust veil (partial occlusion gives depth)
  for (let i = 0; i < n * 0.05; i++) b.dust(gauss(r) * 70, -60 + gauss(r) * 10, 25 + gauss(r) * 8, [dustC[0] * 0.18, dustC[1] * 0.18, dustC[2] * 0.18], 14 + r() * 16, r() * 6.28, 0.3)
  // NGC 6611 cluster above and to the right, illuminating the pillars
  for (let i = 0; i < 120; i++) b.star(34 + gauss(r) * 12, 34 + gauss(r) * 10, 14 + gauss(r) * 8, STAR_HOT, 0.8 + Math.pow(r(), 5) * 3.2)
  scatterStars(b, r, 250, 90)
}

function carina(b: Builder, r: Rng, n: number, pal: number[][]) {
  const [ha, gold, oiii, dustBase] = pal
  const dustC = [dustBase[0] * 0.28, dustBase[1] * 0.25, dustBase[2] * 0.25]
  const lobes = Array.from({ length: 7 }, () => [gauss(r) * 40, gauss(r) * 22, gauss(r) * 20, 18 + r() * 22])
  for (let i = 0; i < n * 0.6; i++) {
    const L = lobes[Math.floor(r() * lobes.length)]
    const x = L[0] + gauss(r) * L[3], y = L[1] + gauss(r) * L[3] * 0.7, z = L[2] + gauss(r) * L[3] * 0.5
    const t = r()
    b.emit(x, y, z, t < 0.45 ? ha : t < 0.8 ? gold : oiii, 12 + r() * 22, r() * 6.28, 0.1 + r() * 0.14)
  }
  // V-shaped dust lane
  for (let i = 0; i < n * 0.22; i++) {
    const t = gauss(r) * 50
    const arm = r() < 0.5 ? 1 : -1
    b.dust(t, Math.abs(t) * 0.55 * arm * 0.5 - 8 + gauss(r) * 5, 12 + gauss(r) * 6, dustC, 6 + r() * 10, r() * 6.28, 0.75)
  }
  // Mystic Mountain style pillar
  for (let i = 0; i < n * 0.06; i++) {
    const t = r()
    b.dust(-40 + gauss(r) * 3, -45 + t * 30, 5 + gauss(r) * 3, dustC, 4 + r() * 5, r() * 6.28, 1)
    if (t > 0.9) b.emit(-40 + gauss(r) * 2, -15 + r() * 2, 5, gold, 3, r() * 6.28, 1.4)
  }
  // Eta Carinae + Homunculus bipolar lobes
  b.star(4, 6, 0, [1, 0.92, 0.8], 7)
  for (let i = 0; i < 700; i++) {
    const s = r() < 0.5 ? -1 : 1
    const [x, y, z] = sphereDir(r)
    const rr = 3.2 * Math.cbrt(r())
    b.emit(4 + x * rr * 0.7, 6 + s * (2.4 + Math.abs(y) * rr), z * rr * 0.7, [0.95, 0.75, 0.55], 1.2, r() * 6.28, 1.4)
  }
  for (let i = 0; i < 200; i++) b.star(-20 + gauss(r) * 18, 10 + gauss(r) * 10, gauss(r) * 10, STAR_HOT, 0.8 + Math.pow(r(), 5) * 3.2)
  scatterStars(b, r, 400, 100)
}

function fantasy(b: Builder, r: Rng, n: number, pal: number[][]) {
  const arms = 3 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * arms)
    const t = r()
    const a = (k / arms) * Math.PI * 2 + t * 3.5
    const rad = t * 65
    b.emit(Math.cos(a) * rad + gauss(r) * 8, gauss(r) * 10 * (1 - t * 0.5), Math.sin(a) * rad + gauss(r) * 8, mix3(pal[0], pal[1 + (k % 2)], t), 10 + r() * 20, r() * 6.28, 0.5 + (1 - t) * 0.7)
  }
  scatterStars(b, r, 200, 80)
}

export function buildNebula(v: NebulaVisual, count: number): NebulaBuffers {
  const r = mulberry32(v.seed)
  const pal = v.palette.map(hex)
  while (pal.length < 4) pal.push(pal[0])
  const b = new Builder()
  if (v.shape === 'orion') orion(b, r, count, pal)
  else if (v.shape === 'crab') crab(b, r, count, pal)
  else if (v.shape === 'eagle') eagle(b, r, count, pal)
  else if (v.shape === 'carina') carina(b, r, count, pal)
  else fantasy(b, r, count, pal)
  return b.build()
}
