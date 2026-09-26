import { mulberry32, gauss } from '../core/procedural/rng'

/**
 * Simulated large-scale structure (NOT a catalogue): cluster nodes connected by filaments,
 * surrounding voids. Used purely as the visual backdrop of the Observable Universe view.
 */
export function generateCosmicWeb(count: number, seed: number, extent: number) {
  const rnd = mulberry32(seed)
  const nodes: [number, number, number, number][] = []
  const N = 90
  for (let i = 0; i < N; i++) {
    let x: number, y: number, z: number
    do {
      x = (rnd() * 2 - 1) * extent
      y = (rnd() * 2 - 1) * extent * 0.8
      z = (rnd() * 2 - 1) * extent
    } while (Math.hypot(x, y, z) < extent * 0.08)
    nodes.push([x, y, z, 0.4 + rnd() * 1.2])
  }
  // filaments: each node to its 3 nearest neighbours
  const edges: [number, number][] = []
  for (let i = 0; i < N; i++) {
    const d = nodes.map((n, j) => [j, Math.hypot(n[0] - nodes[i][0], n[1] - nodes[i][1], n[2] - nodes[i][2])] as [number, number]).sort((a, b) => a[1] - b[1])
    for (let k = 1; k <= 3; k++) if (i < d[k][0]) edges.push([i, d[k][0]])
  }
  const position = new Float32Array(count * 3)
  const color = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const void0 = extent * 0.035
  let i = 0
  while (i < count) {
    const u = rnd()
    let x: number, y: number, z: number
    let clusterish = 0
    if (u < 0.55) {
      const [a, b] = edges[Math.floor(rnd() * edges.length)]
      const t = rnd()
      const A = nodes[a], B = nodes[b]
      const w = extent * 0.012 * (0.5 + Math.sin(t * Math.PI))
      // gently curved filament
      const bend = Math.sin(t * Math.PI) * extent * 0.05
      x = A[0] + (B[0] - A[0]) * t + gauss(rnd) * w + bend * 0.3
      y = A[1] + (B[1] - A[1]) * t + gauss(rnd) * w - bend * 0.2
      z = A[2] + (B[2] - A[2]) * t + gauss(rnd) * w + bend * 0.1
    } else if (u < 0.85) {
      const n = nodes[Math.floor(rnd() * N)]
      const s = extent * 0.02 * n[3]
      const r = s * Math.pow(rnd(), 1.6)
      const ct = rnd() * 2 - 1
      const ph = rnd() * Math.PI * 2
      const st = Math.sqrt(1 - ct * ct)
      x = n[0] + r * st * Math.cos(ph)
      y = n[1] + r * ct
      z = n[2] + r * st * Math.sin(ph)
      clusterish = 1
    } else {
      x = (rnd() * 2 - 1) * extent
      y = (rnd() * 2 - 1) * extent * 0.8
      z = (rnd() * 2 - 1) * extent
    }
    if (Math.hypot(x, y, z) < void0) continue
    position[i * 3] = x
    position[i * 3 + 1] = y
    position[i * 3 + 2] = z
    const red = clusterish ? 0.65 + rnd() * 0.35 : rnd() * 0.6
    color[i * 3] = 0.75 + red * 0.25
    color[i * 3 + 1] = 0.72 + (1 - red) * 0.1
    color[i * 3 + 2] = 0.95 - red * 0.35
    size[i] = 0.6 + Math.pow(rnd(), 4) * 2.4 + (clusterish ? 0.3 : 0)
    i++
  }
  return { position, color, size }
}
