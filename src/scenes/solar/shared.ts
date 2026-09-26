import * as THREE from 'three'

/** Shared geometries (reused across all bodies, never disposed while the app runs). */
const spheres = new Map<number, THREE.SphereGeometry>()
export function sphereGeo(segments: number) {
  let g = spheres.get(segments)
  if (!g) {
    g = new THREE.SphereGeometry(1, segments, Math.max(8, Math.round(segments / 2)))
    spheres.set(segments, g)
  }
  return g
}

const rings = new Map<string, THREE.RingGeometry>()
export function ringGeo(inner: number, outer: number) {
  const k = `${inner.toFixed(4)}:${outer.toFixed(4)}`
  let g = rings.get(k)
  if (!g) {
    g = new THREE.RingGeometry(inner, outer, 256, 1)
    rings.set(k, g)
  }
  return g
}

export const quadGeo = new THREE.PlaneGeometry(2, 2)
