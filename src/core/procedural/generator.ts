import type { CelestialObject, PlanetVisual, GalaxyVisual } from '../registry/types'
import { hashSeed, mulberry32, pick, range, type Rng } from './rng'
import { kelvinToRgb } from '../data/stars'

/**
 * Procedural (fictional) universe generator.
 * IDs encode their seeds so any procedural object can be regenerated from its ID alone:
 *   fx-gal-<g>            fantasy galaxy (g = base36 seed)
 *   fx-sys-<g>-<i>        star system i inside galaxy g
 *   fx-star-<g>-<i>-<k>   star k of system (binary systems have k = 0,1)
 *   fx-pl-<g>-<i>-<j>     planet j of system i
 *   fx-bh-<g>             central fantasy black hole of galaxy g
 */

const U = 'procedural'
export const FANTASY_ROOT = 'fantasy-universe'
export const FANTASY_CHUNK_SIZE = 600
export const SYSTEMS_PER_GALAXY = 36

const SYL_A = ['Ae', 'Vel', 'Ny', 'Ka', 'Or', 'Ith', 'Sel', 'Zer', 'Myr', 'Tal', 'Eos', 'Lum', 'Cae', 'Vor', 'Ish', 'Aru', 'Del', 'Xan', 'Io', 'Rha', 'Sy', 'Nox', 'Ela', 'Quo']
const SYL_B = ['ra', 'len', 'thos', 'mir', 'ven', 'dra', 'lys', 'rion', 'nae', 'tar', 'quel', 'shi', 'vara', 'dun', 'phe', 'lia', 'mor', 'cen', 'the', 'gal']
const SYL_C = ['', '', 'is', 'on', 'ae', 'ix', 'um', 'a', 'eth', 'or', 'yx']

export function fantasyName(r: Rng) {
  return pick(r, SYL_A) + pick(r, SYL_B) + pick(r, SYL_C)
}

const s36 = (n: number) => (n >>> 0).toString(36)
const p36 = (s: string) => parseInt(s, 36) >>> 0

function hsl(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  const hx = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')
  return `#${hx(f(0))}${hx(f(8))}${hx(f(4))}`
}
const kelvinHex = (k: number) => {
  const [r, g, b] = kelvinToRgb(k)
  const hx = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${hx(r)}${hx(g)}${hx(b)}`
}

const FICTIONAL_SRC = [{ name: 'ASTRALIS procedural generator (seed-based)', license: 'Fictional — generated content' }]

/**
 * Galaxy seeds pack their chunk coordinates, so a galaxy's position is a pure function of its seed:
 * bits 0–9 cx+512, 10–19 cz+512, 20–23 cy+8, 24–25 slot, 26–31 salt.
 */
export function packGalaxySeed(cx: number, cy: number, cz: number, slot: number, salt: number) {
  return (((cx + 512) & 1023) | (((cz + 512) & 1023) << 10) | (((cy + 8) & 15) << 20) | ((slot & 3) << 24) | ((salt & 63) << 26)) >>> 0
}
export function unpackGalaxySeed(seed: number) {
  return { cx: (seed & 1023) - 512, cz: ((seed >>> 10) & 1023) - 512, cy: ((seed >>> 20) & 15) - 8, slot: (seed >>> 24) & 3 }
}

export function galaxyPositionFromSeed(seed: number): [number, number, number] {
  const { cx, cy, cz, slot } = unpackGalaxySeed(seed)
  const r = mulberry32(hashSeed(seed, 5150))
  const ox = (slot + 0.2 + r() * 0.6) / 3
  return [(cx + ox) * FANTASY_CHUNK_SIZE, (cy + range(r, 0.3, 0.7)) * FANTASY_CHUNK_SIZE * 0.5, (cz + range(r, 0.15, 0.85)) * FANTASY_CHUNK_SIZE]
}

/** Galaxies in a fantasy-universe chunk. */
export function chunkGalaxySeeds(cx: number, cy: number, cz: number, universeSeed = 7): number[] {
  const r = mulberry32(hashSeed(cx, cy, cz, universeSeed))
  const n = r() < 0.3 ? 0 : r() < 0.65 ? 1 : 2
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(packGalaxySeed(cx, cy, cz, i, hashSeed(cx, cy, cz, i, universeSeed) & 63))
  return out
}

/** Random galaxy seed near the origin of the fantasy universe (used by "Discover New World"). */
export function randomNearbyGalaxySeed(rand: number) {
  const r = mulberry32(rand)
  return packGalaxySeed(Math.floor(range(r, -5, 5)), 0, Math.floor(range(r, -5, 5)), 2, Math.floor(r() * 64))
}

export function generateGalaxy(seed: number): CelestialObject {
  const pos = galaxyPositionFromSeed(seed)
  const r = mulberry32(hashSeed(seed, 1))
  const morph = pick(r, ['spiral', 'spiral', 'barred-spiral', 'barred-spiral', 'elliptical', 'irregular'] as const)
  const hue = r()
  const g: GalaxyVisual = {
    morphology: morph,
    arms: morph === 'elliptical' ? 0 : Math.floor(range(r, 2, 6)),
    armTightness: range(r, 0.14, 0.34),
    barLength: morph === 'barred-spiral' ? range(r, 0.2, 0.4) : undefined,
    bulgeRatio: morph === 'elliptical' ? 1 : range(r, 0.05, 0.3),
    diskThickness: morph === 'elliptical' ? 1 : range(r, 0.015, 0.05),
    ellipticity: range(r, 0, 0.4),
    coreColor: hsl((hue + 0.08) % 1, 0.8, 0.8),
    armColor: hsl(hue, range(r, 0.5, 0.9), 0.75),
    dustColor: '#140c10',
    hiiColor: hsl((hue + 0.5) % 1, 0.9, 0.7),
    inclination: range(r, 0, 70),
    positionAngle: range(r, 0, 180),
    seed,
    radiusKpc: range(r, 8, 28),
  }
  const name = `${fantasyName(r)} ${pick(r, ['Galaxy', 'Spiral', 'Expanse', 'Reach', 'Veil'])}`
  return {
    id: `fx-gal-${s36(seed)}`,
    name,
    type: 'galaxy',
    sourceType: 'fantasy',
    parentId: FANTASY_ROOT,
    position: { kind: 'local', x: pos[0], y: pos[1], z: pos[2] },
    physical: { morphology: `${morph} (fictional)`, extra: { Seed: String(seed) } },
    visual: { renderer: 'galaxy', hostsScene: 'galaxy', label: true, galaxy: g },
    discoveryStatus: 'fictional',
    description: `A procedurally generated ${morph.replace('-', ' ')} galaxy. It does not exist in the real universe.`,
    descriptionZh: '程序化生成的幻想星系，並不存在於真實宇宙中。',
    dataSource: FICTIONAL_SRC,
    updatedAt: U,
    seed,
  }
}

export function systemSeed(galSeed: number, index: number) {
  return hashSeed(galSeed, index, 4242)
}

/** Local placement of system i in galaxy scene (100 pc units). */
export function systemPlacement(g: GalaxyVisual, index: number): [number, number, number] {
  const r = mulberry32(hashSeed(g.seed, index, 17))
  const R = g.radiusKpc * 10
  const rad = R * (0.18 + 0.72 * Math.sqrt(r()))
  let ang = r() * Math.PI * 2
  if (g.arms > 0) {
    const arm = Math.floor(r() * g.arms)
    ang = (arm / g.arms) * Math.PI * 2 + Math.log(rad / (R * 0.1) + 1) / g.armTightness * 0.35 + (r() - 0.5) * 0.3
  }
  return [Math.cos(ang) * rad, (r() - 0.5) * R * 0.02, Math.sin(ang) * rad]
}

export function generateSystem(galSeed: number, index: number, galaxy?: CelestialObject): CelestialObject[] {
  const seed = systemSeed(galSeed, index)
  const r = mulberry32(seed)
  const binary = r() < 0.22
  const sysId = `fx-sys-${s36(galSeed)}-${index}`
  const name = fantasyName(r)
  const pos = galaxy?.visual.galaxy ? systemPlacement(galaxy.visual.galaxy, index) : [0, 0, 0]
  const out: CelestialObject[] = []
  const stars: { t: number; rad: number }[] = []
  const nStars = binary ? 2 : 1
  for (let k = 0; k < nStars; k++) {
    const t = k === 0 ? pick(r, [3200, 4200, 5200, 5800, 6600, 8000, 11000, 16000]) : range(r, 3000, 7000)
    const rad = t > 9000 ? range(r, 1.6, 3) : t < 4000 ? range(r, 0.3, 0.6) : range(r, 0.8, 1.3)
    stars.push({ t, rad })
  }
  const color0 = kelvinHex(stars[0].t)
  out.push({
    id: sysId,
    name: `${name} System`,
    type: 'star-system',
    sourceType: 'fantasy',
    parentId: `fx-gal-${s36(galSeed)}`,
    position: { kind: 'local', x: pos[0], y: pos[1], z: pos[2] },
    physical: { starCount: binary ? '2 (binary)' : '1', extra: { Seed: String(seed) } },
    visual: { renderer: 'star', hostsScene: 'system', color: color0, sceneRadius: 0.8, label: true },
    discoveryStatus: 'fictional',
    description: binary ? 'A fictional binary star system generated from a stable seed.' : 'A fictional star system generated from a stable seed.',
    descriptionZh: binary ? '由固定種子生成的幻想雙星系統。' : '由固定種子生成的幻想恆星系統。',
    dataSource: FICTIONAL_SRC,
    updatedAt: U,
    seed,
  })
  stars.forEach((s, k) => {
    out.push({
      id: `fx-star-${s36(galSeed)}-${index}-${k}`,
      name: `${name} ${k === 0 ? 'A' : 'B'}`,
      type: 'star',
      sourceType: 'fantasy',
      parentId: sysId,
      position: binary ? { kind: 'orbit', orbit: { a: 0.12 + k * 0.1, e: 0, i: 0, L: k * 180, varpi: 0, Omega: 0, periodDays: 18 } } : { kind: 'origin' },
      physical: { temperatureK: Math.round(s.t), radiusKm: s.rad * 695700, extra: { Seed: String(seed) } },
      visual: { renderer: 'sun', color: kelvinHex(s.t), planet: { surface: 'sun', palette: [kelvinHex(s.t * 1.2), kelvinHex(s.t), kelvinHex(s.t * 0.7)], seed: seed + k } },
      discoveryStatus: 'fictional',
      description: 'A fictional star.',
      descriptionZh: '幻想恆星。',
      dataSource: FICTIONAL_SRC,
      updatedAt: U,
      seed,
    })
  })
  const nPlanets = Math.floor(range(r, 2, 8))
  let a = binary ? 0.9 : range(r, 0.25, 0.5)
  for (let j = 0; j < nPlanets; j++) {
    out.push(generatePlanet(galSeed, index, j, a, stars[0].t))
    a *= range(r, 1.45, 1.9)
  }
  return out
}

const SURFACES = ['rocky', 'gas', 'ice', 'ocean', 'lava', 'ice-giant', 'gas'] as const

export function generatePlanet(galSeed: number, sysIndex: number, j: number, aAU: number, starTemp: number): CelestialObject {
  const seed = hashSeed(galSeed, sysIndex, j, 777)
  const r = mulberry32(seed)
  // temperature-driven surface selection keeps worlds plausible
  const eqT = starTemp * Math.sqrt(0.00465 / (2 * aAU)) * 0.9
  let surface: PlanetVisual['surface']
  if (eqT > 900) surface = 'lava'
  else if (aAU > 2.5) surface = pick(r, ['gas', 'ice-giant', 'ice', 'gas'] as const)
  else if (eqT < 200) surface = pick(r, ['ice', 'ice-giant', 'rocky'] as const)
  else surface = pick(r, SURFACES)
  const hue = r()
  const big = surface === 'gas' || surface === 'ice-giant'
  const radiusEarth = big ? range(r, 3.5, 13) : range(r, 0.4, 2.2)
  const palette = paletteFor(surface, hue, r)
  const ringed = (big && r() < 0.45) || (!big && r() < 0.08)
  const visual: PlanetVisual = {
    surface,
    palette,
    seed,
    bands: big ? Math.floor(range(r, 6, 18)) : undefined,
    storm: big && r() < 0.5 ? { lat: range(r, -40, 40), lon: range(r, 0, 360), size: range(r, 0.04, 0.12), color: hsl((hue + 0.05) % 1, 0.6, 0.45) } : undefined,
    clouds: surface === 'ocean' || (surface === 'rocky' && r() < 0.4) ? { opacity: range(r, 0.4, 0.9), speed: range(r, 0.5, 2) } : undefined,
    atmosphere: surface === 'lava' && r() < 0.5 ? undefined : { color: hsl((hue + range(r, -0.1, 0.1) + 1) % 1, 0.7, 0.65), density: range(r, 0.3, 1.3), thickness: range(r, 0.02, 0.05) },
    rings: ringed ? { inner: range(r, 1.3, 1.6), outer: range(r, 1.9, 2.8), palette: [hsl(hue, 0.3, 0.75), hsl((hue + 0.1) % 1, 0.25, 0.55), hsl(hue, 0.2, 0.4)], opacity: range(r, 0.4, 0.95), kind: 'fantasy', tiltDeg: range(r, -25, 25) } : undefined,
    craters: surface === 'rocky' || surface === 'ice' ? range(r, 0, 1) : 0,
    polarCaps: surface === 'rocky' || surface === 'ocean' ? range(r, 0, 0.25) : 0,
    poleRA: range(r, 0, 360),
    poleDec: range(r, 30, 90),
    W0: range(r, 0, 360),
    Wdot: range(r, 150, 900) * (r() < 0.1 ? -1 : 1),
  }
  const name = fantasyName(r)
  const period = 365.25 * Math.sqrt(aAU ** 3)
  return {
    id: `fx-pl-${s36(galSeed)}-${sysIndex}-${j}`,
    name,
    type: 'fantasy-planet',
    sourceType: 'fantasy',
    parentId: `fx-sys-${s36(galSeed)}-${sysIndex}`,
    position: { kind: 'orbit', orbit: { a: aAU, e: range(r, 0, 0.08), i: range(r, -3, 3), L: range(r, 0, 360), varpi: range(r, 0, 360), Omega: range(r, 0, 360), periodDays: period } },
    physical: {
      radiusEarth,
      radiusKm: radiusEarth * 6371,
      temperatureK: Math.round(eqT),
      orbitalPeriodDays: period,
      distanceAU: aAU,
      rotationPeriodHours: 360 / Math.abs(visual.Wdot ?? 360) * 24,
      extra: { Class: surfaceLabel(surface) + (ringed ? ', ringed' : ''), Seed: String(seed) },
    },
    visual: { renderer: 'planet', planet: visual },
    discoveryStatus: 'fictional',
    description: `A fictional ${surfaceLabel(surface).toLowerCase()}${ringed ? ' with rings' : ''}, generated deterministically from seed ${seed}.`,
    descriptionZh: `由種子 ${seed} 決定性生成的幻想${surfaceLabelZh(surface)}${ringed ? '（具行星環）' : ''}。`,
    dataSource: FICTIONAL_SRC,
    updatedAt: U,
    seed,
  }
}

function surfaceLabel(s: PlanetVisual['surface']) {
  return ({ rocky: 'Rocky world', gas: 'Gas giant', 'ice-giant': 'Ice giant', ice: 'Ice world', ocean: 'Ocean world', lava: 'Lava world' } as Record<string, string>)[s] ?? 'World'
}
function surfaceLabelZh(s: PlanetVisual['surface']) {
  return ({ rocky: '岩石行星', gas: '氣態巨行星', 'ice-giant': '冰巨行星', ice: '冰凍行星', ocean: '海洋行星', lava: '熔岩行星' } as Record<string, string>)[s] ?? '行星'
}

function paletteFor(s: PlanetVisual['surface'], hue: number, r: Rng): string[] {
  const j = () => range(r, -0.05, 0.05)
  switch (s) {
    case 'gas':
      return [hsl(hue, 0.45, 0.8), hsl((hue + 0.05 + j() + 1) % 1, 0.5, 0.55), hsl((hue + 0.1) % 1, 0.45, 0.38), hsl(hue, 0.2, 0.9), hsl((hue + 0.95) % 1, 0.5, 0.5)]
    case 'ice-giant':
      return [hsl(hue, 0.5, 0.65), hsl((hue + 0.03) % 1, 0.55, 0.52), hsl(hue, 0.35, 0.78), hsl((hue + 0.97) % 1, 0.6, 0.4)]
    case 'ocean':
      return [hsl(0.58 + j(), 0.7, 0.28), hsl((hue * 0.3 + 0.25) % 1, 0.45, 0.35), hsl(0.1, 0.35, 0.65), '#f4f7fa']
    case 'lava':
      return [hsl(0.02, 0.2, 0.1), hsl(0.05 + j(), 1, 0.55), hsl(0.02, 0.15, 0.05), hsl(0.1, 1, 0.7)]
    case 'ice':
      return [hsl((0.55 + hue * 0.2) % 1, 0.3, 0.85), hsl(0.58, 0.35, 0.65), '#f5fbff', hsl(0.6, 0.25, 0.5)]
    default:
      return [hsl(hue, 0.35, 0.5), hsl((hue + 0.05) % 1, 0.4, 0.35), hsl((hue + 0.1) % 1, 0.3, 0.65), hsl(hue, 0.25, 0.25)]
  }
}

export function generateBlackHole(galSeed: number, galaxy: CelestialObject): CelestialObject {
  const r = mulberry32(hashSeed(galSeed, 666))
  const mass = Math.pow(10, range(r, 5.5, 9.8))
  return {
    id: `fx-bh-${s36(galSeed)}`,
    name: `${fantasyName(r)} Singularity`,
    type: 'black-hole',
    sourceType: 'fantasy',
    parentId: galaxy.id,
    position: { kind: 'origin' },
    physical: { massSolar: mass, extra: { Seed: String(galSeed) } },
    visual: {
      renderer: 'black-hole',
      hostsScene: 'black-hole',
      label: true,
      blackHole: { spin: range(r, 0.3, 0.99), diskInner: range(r, 2.4, 3.6), diskOuter: range(r, 8, 16), diskInclinationDeg: range(r, 10, 85), diskTemperatureK: range(r, 3000, 16000), diskBrightness: range(r, 0.7, 1.3), jet: r() < 0.4, environment: 'fantasy', seed: galSeed },
    },
    discoveryStatus: 'fictional',
    description: 'A fictional supermassive black hole at the heart of a procedurally generated galaxy.',
    descriptionZh: '位於程序化幻想星系核心的虛構超大質量黑洞。',
    dataSource: FICTIONAL_SRC,
    updatedAt: U,
    seed: galSeed,
  }
}

/** Regenerate any procedural object (and its siblings) purely from its ID. */
export function regenerateFromId(id: string): CelestialObject[] | null {
  const m = id.match(/^fx-(gal|sys|star|pl|bh)-([0-9a-z]+)(?:-(\d+))?(?:-(\d+))?$/)
  if (!m) return null
  const g = p36(m[2])
  const gal = generateGalaxy(g)
  if (m[1] === 'gal') return [gal]
  if (m[1] === 'bh') return [gal, generateBlackHole(g, gal)]
  const i = Number(m[3])
  if (!Number.isFinite(i)) return null
  return [gal, ...generateSystem(g, i, gal)]
}

export const fantasyIds = { galaxy: (seed: number) => `fx-gal-${s36(seed)}`, system: (g: number, i: number) => `fx-sys-${s36(g)}-${i}`, planet: (g: number, i: number, j: number) => `fx-pl-${s36(g)}-${i}-${j}` }
