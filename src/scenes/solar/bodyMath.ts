import * as THREE from 'three'
import type { CelestialObject, PlanetVisual } from '../../core/registry/types'
import { J2000_JD, OBLIQUITY_J2000, DEG, zUpToThree } from '../../core/coords/UniverseCoordinateSystem'
import { keplerPosition } from '../../core/orbits/kepler'
import { presentationMoonDistance, systemAUScale } from '../../core/coords/SceneScaleManager'
import { registry } from '../../core/registry/CelestialRegistry'

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)

/** Body-fixed → scene (ecliptic, y-up) orientation of the rotation pole (IAU α0, δ0), without spin. */
export function poleQuaternion(v: PlanetVisual | undefined, out = new THREE.Quaternion()): THREE.Quaternion {
  const a0 = (v?.poleRA ?? 270) * DEG
  const d0 = (v?.poleDec ?? 66.56) * DEG
  const q1 = new THREE.Quaternion().setFromAxisAngle(X, -OBLIQUITY_J2000)
  const q2 = new THREE.Quaternion().setFromAxisAngle(Y, a0 + Math.PI / 2)
  const q3 = new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2 - d0)
  return out.copy(q1).multiply(q2).multiply(q3)
}

/** Prime-meridian angle W(t) in radians (IAU). */
export function spinAngle(v: PlanetVisual | undefined, jd: number) {
  const d = jd - J2000_JD
  return (((v?.W0 ?? 0) + (v?.Wdot ?? 360) * d) % 360) * DEG
}

const tmp = new THREE.Vector3()
const qTmp = new THREE.Quaternion()

/** Position of a body relative to its parent, in system-scene units (presentation distances for moons). */
export function relativePosition(o: CelestialObject, hostId: string, jd: number, out: THREE.Vector3): THREE.Vector3 {
  const p = o.position
  if (p.kind !== 'orbit') return out.set(0, 0, 0)
  const parent = registry.get(o.parentId)
  const isMoon = parent && parent.id !== hostId && parent.type !== 'star-system'
  if (!isMoon) {
    const v = keplerPosition(p.orbit, jd)
    return out.set(...zUpToThree(v)).multiplyScalar(systemAUScale(hostId))
  }
  const dist = presentationMoonDistance(parent!, p.orbit.a)
  if (p.orbit.plane === 'parent-equator') {
    const L = (p.orbit.L + (360 * (jd - (p.orbit.epochJD ?? J2000_JD))) / (p.orbit.periodDays ?? 1)) * DEG
    const incl = (p.orbit.i ?? 0) * DEG
    tmp.set(Math.cos(L), 0, -Math.sin(L)).applyAxisAngle(X, incl)
    return out.copy(tmp).applyQuaternion(poleQuaternion(parent!.visual.planet, qTmp)).multiplyScalar(dist)
  }
  const v = keplerPosition(p.orbit, jd)
  return out.set(...zUpToThree(v)).normalize().multiplyScalar(dist)
}
