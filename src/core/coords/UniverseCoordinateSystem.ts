/**
 * UniverseCoordinateSystem
 * All catalogue data is kept in float64 (JS number) in physical units of its native frame.
 * Scene renderers never receive these values directly: SceneScaleManager converts them into a
 * scene-local float32 frame whose origin sits at the scene's host object.
 */

export const DEG = Math.PI / 180
export const PC_IN_LY = 3.261563777
export const AU_KM = 149_597_870.7
export const LY_KM = 9.4607304725808e12
export const PC_KM = 3.0856775814913673e13
export const SUN_GC_DISTANCE_KPC = 8.178 // GRAVITY Collaboration 2019
export const SUN_Z_KPC = 0.0208 // Bennett & Bovy 2019
export const OBLIQUITY_J2000 = 23.4392911 * DEG
export const J2000_JD = 2451545.0

export type Vec3 = [number, number, number]

/** ICRS -> Galactic rotation matrix (Hipparcos, J2000) */
const T_EQ_GAL = [
  [-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
]

export function hmsToDeg(h: number, m = 0, s = 0) {
  return (h + m / 60 + s / 3600) * 15
}
export function dmsToDeg(d: number, m = 0, s = 0) {
  const sign = d < 0 || Object.is(d, -0) ? -1 : 1
  return sign * (Math.abs(d) + m / 60 + s / 3600)
}

export function sphericalToCartesian(raDeg: number, decDeg: number, r: number): Vec3 {
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  return [r * Math.cos(dec) * Math.cos(ra), r * Math.cos(dec) * Math.sin(ra), r * Math.sin(dec)]
}

export function equatorialToGalactic(v: Vec3): Vec3 {
  const m = T_EQ_GAL
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
}

/** Heliocentric galactic (x→GC, y→l=90°, z→NGP) in kpc to galactocentric kpc (GC at origin). */
export function helioGalacticToGalactocentric(v: Vec3): Vec3 {
  return [v[0] - SUN_GC_DISTANCE_KPC, v[1], v[2] + SUN_Z_KPC]
}

/** RA/Dec/distance(pc) -> galactocentric kpc */
export function equatorialToGalactocentricKpc(raDeg: number, decDeg: number, distancePc: number): Vec3 {
  const eq = sphericalToCartesian(raDeg, decDeg, distancePc / 1000)
  return helioGalacticToGalactocentric(equatorialToGalactic(eq))
}

/** Equatorial -> ecliptic (J2000) cartesian */
export function equatorialToEcliptic(v: Vec3): Vec3 {
  const c = Math.cos(OBLIQUITY_J2000)
  const s = Math.sin(OBLIQUITY_J2000)
  return [v[0], c * v[1] + s * v[2], -s * v[1] + c * v[2]]
}

/**
 * Right-handed physical frame (z = "north") -> three.js (y = up).
 * Used for galactic (z→NGP), ecliptic (z→ecliptic north) and equatorial frames alike.
 */
export function zUpToThree(v: Vec3): Vec3 {
  return [v[0], v[2], -v[1]]
}

export function jdFromDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}
export function dateFromJd(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000)
}

export function formatDistanceLy(ly: number | undefined): string {
  if (ly === undefined) return 'Unknown'
  if (ly < 0.01) return `${(ly * 63241.077).toFixed(2)} AU`
  if (ly < 1e3) return `${ly.toPrecision(4)} ly`
  if (ly < 1e6) return `${(ly / 1e3).toPrecision(4)} thousand ly`
  if (ly < 1e9) return `${(ly / 1e6).toPrecision(4)} million ly`
  return `${(ly / 1e9).toPrecision(4)} billion ly`
}
