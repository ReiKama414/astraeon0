import { registry } from './registry/CelestialRegistry'
import { randomNearbyGalaxySeed, generateSystem, generateGalaxy, SYSTEMS_PER_GALAXY, fantasyIds } from './procedural/generator'
import { randomSeed } from './procedural/rng'
import { travelTo } from './navigation/Navigator'
import { toast } from '../store/useAppStore'

/** Explore a random known object (real catalogue) — occasionally a procedural galaxy. */
export function exploreRandom() {
  const r = Math.random()
  if (r < 0.15) {
    const g = generateGalaxy(randomNearbyGalaxySeed(randomSeed()))
    registry.upsert([g])
    return travelTo(g.id)
  }
  const pool = registry.all().filter((o) => o.sourceType === 'real' && ['galaxy', 'planet', 'exoplanet', 'black-hole', 'nebula', 'moon', 'dwarf-planet', 'comet', 'constellation'].includes(o.type))
  const o = pool[Math.floor(Math.random() * pool.length)]
  return travelTo(o.id)
}

/** Generate a brand-new fictional world from a fresh seed; the same ID always regenerates identically. */
export function discoverNewWorld() {
  const gSeed = randomNearbyGalaxySeed(randomSeed())
  const sysIndex = Math.floor(Math.random() * SYSTEMS_PER_GALAXY)
  const gal = generateGalaxy(gSeed)
  const objs = generateSystem(gSeed, sysIndex, gal)
  const planets = objs.filter((o) => o.type === 'fantasy-planet')
  const planet = planets[Math.floor(Math.random() * planets.length)]
  registry.upsert([gal, ...objs])
  toast(`${planet.name} — seed ${planet.seed}`)
  return travelTo(planet.id ?? fantasyIds.planet(gSeed, sysIndex, 0))
}
