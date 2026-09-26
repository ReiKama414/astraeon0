import * as THREE from 'three'
import type { CelestialObject, SceneKind } from '../registry/types'
import { registry, type SceneRef } from '../registry/CelestialRegistry'
import { equatorialToGalactic, equatorialToGalactocentricKpc, sphericalToCartesian, zUpToThree, type Vec3 } from './UniverseCoordinateSystem'
import { keplerPosition } from '../orbits/kepler'

/**
 * SceneScaleManager
 * Each scene kind has its own local reference frame and unit. Float64 catalogue positions are
 * converted here — relative to the scene's host — into float32-safe scene coordinates.
 */
export interface SceneScale {
  kind: SceneKind
  unitLabel: string
  presentation: boolean
  minDistance: number
  maxDistance: number
  defaultDistance: number
  defaultElevationDeg: number
  near: number
  far: number
}

export const AU_UNITS = 100 // system scene: 1 AU = 100 units (distances linear)
export const EARTH_RADIUS_UNITS = 1 // presentation radius of Earth

export const SCALES: Record<SceneKind, SceneScale> = {
  universe: { kind: 'universe', unitLabel: '1 unit = 10 kpc (32,600 ly)', presentation: false, minDistance: 4, maxDistance: 60000, defaultDistance: 2200, defaultElevationDeg: 24, near: 0.05, far: 4e5 },
  galaxy: { kind: 'galaxy', unitLabel: '1 unit = 100 pc (326 ly)', presentation: false, minDistance: 0.6, maxDistance: 1400, defaultDistance: 360, defaultElevationDeg: 38, near: 0.01, far: 2e4 },
  system: { kind: 'system', unitLabel: 'Distances: 1 AU = 100 units · Body sizes: presentation scale', presentation: true, minDistance: 0.3, maxDistance: 9000, defaultDistance: 900, defaultElevationDeg: 30, near: 0.002, far: 1e5 },
  nebula: { kind: 'nebula', unitLabel: 'Nebula scaled to fit view', presentation: true, minDistance: 8, maxDistance: 900, defaultDistance: 230, defaultElevationDeg: 10, near: 0.1, far: 1e4 },
  'black-hole': { kind: 'black-hole', unitLabel: '1 unit = 1 Schwarzschild radius (visual simulation)', presentation: false, minDistance: 3.2, maxDistance: 400, defaultDistance: 38, defaultElevationDeg: 8, near: 0.05, far: 5e3 },
  sky: { kind: 'sky', unitLabel: 'Celestial sphere (directions only)', presentation: true, minDistance: 0.01, maxDistance: 3200, defaultDistance: 0.01, defaultElevationDeg: 0, near: 0.01, far: 1e5 },
  'fantasy-universe': { kind: 'fantasy-universe', unitLabel: 'Fictional sector — arbitrary units', presentation: true, minDistance: 3, maxDistance: 6000, defaultDistance: 900, defaultElevationDeg: 30, near: 0.05, far: 5e4 },
}

/** North celestial pole expressed in galactic three.js axes. */
const NCP_THREE = new THREE.Vector3(...zUpToThree(equatorialToGalactic([0, 0, 1])))
const SUN_THREE_KPC = new THREE.Vector3(...zUpToThree([-8.178, 0, 0.0208]))

function galactocentricKpc(o: CelestialObject): Vec3 | null {
  const p = o.position
  if (p.kind === 'galactocentric') return [p.xKpc, p.yKpc, p.zKpc]
  if (p.kind === 'equatorial') return equatorialToGalactocentricKpc(p.raDeg, p.decDeg, p.distancePc)
  return null
}

/** Presentation radius for bodies in a system scene. */
export function presentationRadius(o: CelestialObject): number {
  const rk = o.physical.radiusKm ?? 3000
  if (o.visual.renderer === 'sun') {
    // stars: compressed hard so they never swallow inner orbits
    return Math.max(2.2, Math.min(14, 11 * Math.pow(rk / 695700, 0.4)))
  }
  if (o.type === 'comet') return 0.18
  // small bodies keep a minimum visible size (presentation scale)
  return Math.max(o.type === 'asteroid' ? 0.08 : 0.05, EARTH_RADIUS_UNITS * Math.pow(rk / 6371, 0.55))
}

/** Compressed moon orbit radius: keeps satellites near their planet but outside it. */
export function presentationMoonDistance(parent: CelestialObject, aKm: number): number {
  const Rp = presentationRadius(parent)
  const ratio = aKm / (parent.physical.radiusKm ?? 6371)
  return Rp * (1.8 + 1.5 * Math.log(Math.max(1.5, ratio)))
}

/** Semi-major axis in system-scene units (exoplanet systems are stretched so that planets separate). */
export function systemAUScale(hostId: string): number {
  const host = registry.get(hostId)
  if (!host || hostId === 'sol') return AU_UNITS
  // compact M-dwarf systems get a larger scale so orbits clear the star's presentation radius
  const planets = registry.childrenOf(hostId).filter((c) => c.position.kind === 'orbit' && c.visual.renderer === 'planet')
  const minA = Math.min(...planets.map((p) => (p.position.kind === 'orbit' ? p.position.orbit.a : 1)), 1)
  return Math.max(AU_UNITS, 26 / Math.max(minA, 1e-3))
}

const tmpV = new THREE.Vector3()

/**
 * Static position of an object within the given scene (time-independent objects).
 * Orbiting bodies are positioned per-frame by their renderer; this returns their J2000-epoch spot as fallback.
 */
export function positionInScene(o: CelestialObject, scene: SceneRef, jd = 2451545, out = new THREE.Vector3()): THREE.Vector3 {
  const p = o.position
  if (o.id === scene.hostId) return out.set(0, 0, 0)
  switch (scene.kind) {
    case 'universe': {
      if (p.kind === 'local') return out.set(p.x, p.y, p.z)
      const g = galactocentricKpc(o)
      if (g) return out.set(...zUpToThree(g)).multiplyScalar(0.1)
      const parent = registry.get(o.parentId)
      return parent ? positionInScene(parent, scene, jd, out) : out.set(0, 0, 0)
    }
    case 'galaxy': {
      if (p.kind === 'local') return out.set(p.x, p.y, p.z)
      if (scene.hostId === 'milky-way') {
        const g = galactocentricKpc(o)
        if (g) return out.set(...zUpToThree(g)).multiplyScalar(10)
      }
      return out.set(0, 0, 0)
    }
    case 'system': {
      if (p.kind === 'orbit') {
        const v = keplerPosition(p.orbit, jd)
        return out.set(...zUpToThree(v)).multiplyScalar(systemAUScale(scene.hostId))
      }
      return out.set(0, 0, 0)
    }
    case 'sky': {
      if (p.kind === 'equatorial') return out.set(...zUpToThree(sphericalToCartesian(p.raDeg, p.decDeg, 1000)))
      return out.set(0, 0, 0)
    }
    case 'fantasy-universe': {
      if (p.kind === 'local') return out.set(p.x, p.y, p.z)
      return out.set(0, 0, 0)
    }
    default:
      return out.set(0, 0, 0)
  }
}

/** Disk orientation for an external galaxy as seen from the Sun (inclination + position angle). */
export function galaxyOrientation(o: CelestialObject): THREE.Quaternion {
  const g = o.visual.galaxy
  const q = new THREE.Quaternion()
  if (!g) return q
  if (o.id === 'milky-way' || o.sourceType !== 'real') {
    return q.setFromEuler(new THREE.Euler((g.inclination * Math.PI) / 360, (g.positionAngle * Math.PI) / 180, 0))
  }
  const pos = positionInScene(o, { id: 'universe', kind: 'universe', hostId: 'universe' }, undefined, tmpV.clone()).multiplyScalar(10)
  const los = pos.sub(SUN_THREE_KPC).normalize()
  const north = NCP_THREE.clone().sub(los.clone().multiplyScalar(NCP_THREE.dot(los))).normalize()
  const east = new THREE.Vector3().crossVectors(north, los).normalize()
  const pa = (g.positionAngle * Math.PI) / 180
  const major = north.multiplyScalar(Math.cos(pa)).add(east.multiplyScalar(Math.sin(pa))).normalize()
  const normal = los.clone().negate().applyAxisAngle(major, (g.inclination * Math.PI) / 180)
  return q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.normalize())
}

/** Visual radius of an object in the given scene (used for focus distance & picking). */
export function sceneRadius(o: CelestialObject, scene: SceneRef): number {
  if (o.visual.sceneRadius && o.id !== scene.hostId) return o.visual.sceneRadius
  switch (scene.kind) {
    case 'universe':
      if (o.visual.galaxy) return o.visual.galaxy.radiusKpc * 0.1
      return 1
    case 'galaxy':
      if (o.id === scene.hostId) return (o.visual.galaxy?.radiusKpc ?? 15) * 10
      if (o.type === 'black-hole') return 0.6
      if (o.type === 'nebula') return 0.8
      return 0.6
    case 'system':
      if (o.id === scene.hostId) return 400
      return presentationRadius(o)
    case 'nebula':
      return 60
    case 'black-hole':
      return 5
    case 'sky':
      return 12
    case 'fantasy-universe':
      if (o.visual.galaxy) return o.visual.galaxy.radiusKpc
      return 100
  }
}
