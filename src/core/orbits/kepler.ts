import type { OrbitalElements } from '../registry/types'
import { DEG, J2000_JD, type Vec3 } from '../coords/UniverseCoordinateSystem'

/** Robust Kepler solver: M normalised to [0, 2π), start at π for high e, Newton with bisection fallback. */
export function solveKepler(M: number, e: number): number {
  const TWO_PI = Math.PI * 2
  let m = M % TWO_PI
  if (m < 0) m += TWO_PI
  let lo = 0
  let hi = TWO_PI
  let E = e < 0.8 ? m : Math.PI
  for (let k = 0; k < 60; k++) {
    const f = E - e * Math.sin(E) - m
    if (f > 0) hi = E
    else lo = E
    let next = E - f / (1 - e * Math.cos(E))
    if (!(next > lo && next < hi)) next = (lo + hi) / 2
    if (Math.abs(next - E) < 1e-12) return next
    E = next
  }
  return E
}

function wrap180(deg: number) {
  let x = deg % 360
  if (x > 180) x -= 360
  if (x < -180) x += 360
  return x
}

/**
 * Position from Keplerian elements (JPL "Approximate Positions of the Planets", Standish).
 * Returns coordinates in the reference plane of the elements, in the elements' length unit.
 */
export function keplerPosition(el: OrbitalElements, jd: number): Vec3 {
  const T = (jd - J2000_JD) / 36525
  const a = el.a + (el.da ?? 0) * T
  const e = el.e + (el.de ?? 0) * T
  const I = (el.i + (el.di ?? 0) * T) * DEG
  let L: number
  if (el.dL !== undefined) L = el.L + el.dL * T
  else if (el.periodDays) L = el.L + (360 * (jd - (el.epochJD ?? J2000_JD))) / el.periodDays
  else L = el.L
  const varpi = el.varpi + (el.dvarpi ?? 0) * T
  const Omega = el.Omega + (el.dOmega ?? 0) * T
  const omega = (varpi - Omega) * DEG
  const M = wrap180(L - varpi) * DEG
  const E = solveKepler(M, e)
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const O = Omega * DEG
  const cw = Math.cos(omega), sw = Math.sin(omega)
  const cO = Math.cos(O), sO = Math.sin(O)
  const cI = Math.cos(I), sI = Math.sin(I)
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ]
}

/** Sample the full orbit path (reference plane) at the given epoch */
export function sampleOrbit(el: OrbitalElements, jd: number, segments = 256): Vec3[] {
  const T = (jd - J2000_JD) / 36525
  const a = el.a + (el.da ?? 0) * T
  const e = el.e + (el.de ?? 0) * T
  const I = (el.i + (el.di ?? 0) * T) * DEG
  const varpi = el.varpi + (el.dvarpi ?? 0) * T
  const Omega = el.Omega + (el.dOmega ?? 0) * T
  const omega = (varpi - Omega) * DEG
  const O = Omega * DEG
  const cw = Math.cos(omega), sw = Math.sin(omega)
  const cO = Math.cos(O), sO = Math.sin(O)
  const cI = Math.cos(I), sI = Math.sin(I)
  const pts: Vec3[] = []
  for (let k = 0; k <= segments; k++) {
    // denser sampling near perihelion for eccentric orbits
    const E = -Math.PI + (2 * Math.PI * k) / segments
    const xp = a * (Math.cos(E) - e)
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
    pts.push([
      (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
      (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
      sw * sI * xp + cw * sI * yp,
    ])
  }
  return pts
}
