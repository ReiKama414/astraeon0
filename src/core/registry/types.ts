export type CelestialType =
  | 'universe'
  | 'galaxy-group'
  | 'galaxy'
  | 'star'
  | 'star-system'
  | 'planet'
  | 'exoplanet'
  | 'moon'
  | 'dwarf-planet'
  | 'asteroid'
  | 'asteroid-belt'
  | 'comet'
  | 'nebula'
  | 'star-cluster'
  | 'black-hole'
  | 'constellation'
  | 'fantasy-planet'

export type SourceType = 'real' | 'procedural' | 'fantasy'
export type DiscoveryStatus = 'confirmed' | 'candidate' | 'simulated' | 'fictional'

/**
 * Positions are stored in float64 astronomical units of their own reference frame
 * and only converted to float32 scene-local coordinates by the SceneScaleManager.
 */
export type PositionSpec =
  | { kind: 'origin' }
  /** ICRS equatorial, heliocentric. distance in parsecs */
  | { kind: 'equatorial'; raDeg: number; decDeg: number; distancePc: number }
  /** Galactocentric cartesian (kpc), x toward Sun-opposite, z to NGP */
  | { kind: 'galactocentric'; xKpc: number; yKpc: number; zKpc: number }
  /** Keplerian orbit about parent (heliocentric ecliptic J2000 for planets) */
  | { kind: 'orbit'; orbit: OrbitalElements }
  /** Parent-local cartesian in the parent's scene units (procedural content) */
  | { kind: 'local'; x: number; y: number; z: number }

export interface OrbitalElements {
  /** semi-major axis (AU), eccentricity, inclination (deg), mean longitude (deg), longitude of perihelion (deg), longitude of ascending node (deg) at J2000 */
  a: number
  e: number
  i: number
  L: number
  varpi: number
  Omega: number
  /** rates per Julian century */
  da?: number
  de?: number
  di?: number
  dL?: number
  dvarpi?: number
  dOmega?: number
  /** reference plane: ecliptic for heliocentric, 'equatorial' = parent's equator */
  plane?: 'ecliptic' | 'parent-equator'
  /** orbital period in days used when dL not provided */
  periodDays?: number
  /** epoch JD for L when periodDays used */
  epochJD?: number
}

export interface Quantity {
  value: number
  unit: string
  /** e.g. "≥" for minimum mass, "~" for approximate */
  qualifier?: '~' | '≥' | '≤'
}

export interface PhysicalProperties {
  radiusKm?: number
  massKg?: number
  /** mass expressed in solar masses (black holes, stars, galaxies) */
  massSolar?: number
  /** mass in Earth masses (exoplanets) */
  massEarth?: Quantity
  radiusEarth?: number
  temperatureK?: number
  distanceLy?: number
  distanceAU?: number
  orbitalPeriodDays?: number
  rotationPeriodHours?: number
  axialTiltDeg?: number
  diameterLy?: number
  spectralType?: string
  apparentMagnitude?: number
  absoluteMagnitude?: number
  surfaceGravity?: number
  density?: number
  moons?: string
  starCount?: string
  morphology?: string
  eventHorizonKm?: number
  extra?: Record<string, string>
}

export type RendererKind =
  | 'none'
  | 'sun'
  | 'star'
  | 'planet'
  | 'earth'
  | 'galaxy'
  | 'black-hole'
  | 'nebula'
  | 'asteroid-belt'
  | 'comet'
  | 'constellation'

export interface PlanetVisual {
  /** optional real imagery (equirectangular, CORS-enabled); procedural maps remain the fallback */
  textureUrl?: string
  surface: 'rocky' | 'gas' | 'ice-giant' | 'venus' | 'earth' | 'ocean' | 'ice' | 'lava' | 'moon' | 'mars' | 'sun'
  palette: string[]
  seed: number
  bands?: number
  /** band turbulence for giant planets (1 = Jupiter-like) */
  turbulence?: number
  storm?: { lat: number; lon: number; size: number; color: string }
  clouds?: { opacity: number; color?: string; speed?: number }
  atmosphere?: { color: string; density: number; thickness?: number }
  rings?: { inner: number; outer: number; tiltDeg?: number; palette: string[]; opacity: number; kind: 'saturn' | 'uranus' | 'neptune' | 'fantasy' }
  craters?: number
  polarCaps?: number
  emissive?: string
  roughness?: number
  /** IAU pole & rotation (deg / deg per day) */
  poleRA?: number
  poleDec?: number
  W0?: number
  Wdot?: number
}

export interface GalaxyVisual {
  morphology: 'spiral' | 'barred-spiral' | 'elliptical' | 'irregular' | 'lenticular'
  arms: number
  armTightness: number
  barLength?: number
  bulgeRatio: number
  diskThickness: number
  ellipticity?: number
  coreColor: string
  armColor: string
  dustColor?: string
  hiiColor?: string
  /** orientation of galaxy disk (deg) in universe scene */
  inclination: number
  positionAngle: number
  seed: number
  /** radius in kpc */
  radiusKpc: number
}

export interface BlackHoleVisual {
  spin: number
  diskInner: number
  diskOuter: number
  diskInclinationDeg: number
  diskTemperatureK: number
  diskBrightness: number
  jet?: boolean
  environment: 'galactic-center' | 'elliptical-core' | 'fantasy'
  seed: number
}

export interface NebulaVisual {
  shape: 'orion' | 'crab' | 'eagle' | 'carina' | 'fantasy'
  palette: string[]
  seed: number
  sizePc: number
}

export interface VisualProperties {
  renderer: RendererKind
  color?: string
  planet?: PlanetVisual
  galaxy?: GalaxyVisual
  blackHole?: BlackHoleVisual
  nebula?: NebulaVisual
  /** radius in the host scene's units (presentation scale) */
  sceneRadius?: number
  /** preferred camera distance multiplier */
  focusDistance?: number
  /** Whether this object hosts its own explorable scene */
  hostsScene?: SceneKind
  label?: boolean
  starColor?: string
  magnitude?: number
}

export type SceneKind = 'universe' | 'galaxy' | 'system' | 'nebula' | 'black-hole' | 'sky' | 'fantasy-universe'

export interface DataSourceRef {
  name: string
  url?: string
  license?: string
}

export interface CelestialObject {
  id: string
  name: string
  nameZh?: string
  aliases?: string[]
  type: CelestialType
  sourceType: SourceType
  parentId: string | null
  position: PositionSpec
  physical: PhysicalProperties
  visual: VisualProperties
  discoveryStatus: DiscoveryStatus
  description: string
  descriptionZh?: string
  discovery?: string
  dataSource: DataSourceRef[]
  updatedAt: string
  seed?: number
  /** member star ids / line segments for constellations */
  constellation?: { lines: [string, string][]; abbr: string }
}
