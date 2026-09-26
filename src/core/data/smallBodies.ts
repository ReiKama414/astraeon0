import type { CelestialObject, CelestialType, DataSourceRef, PlanetVisual } from '../registry/types'

/**
 * Asteroids & dwarf planets — osculating elements from the JPL Small-Body Database (queried 2026-09,
 * full precision). L = mean anomaly + longitude of perihelion at the element epoch.
 */
const SBDB: DataSourceRef = { name: 'JPL Small-Body Database (SBDB API)', url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html', license: 'Public domain (NASA/JPL)' }
const G = 6.6743e-20 // km³ kg⁻¹ s⁻²
const U = '2026-09-25'

type Row = {
  id: string
  name: string
  zh: string
  alias: string[]
  type: CelestialType
  el: [a: number, e: number, i: number, Om: number, varpi: number, L: number, per: number, epoch: number]
  radiusKm?: number
  gm?: number
  massKg?: number
  rot?: number
  density?: number
  surface: PlanetVisual['surface']
  palette: string[]
  desc: string
  descZh: string
  discovery: string
  extra?: Record<string, string>
  src?: DataSourceRef[]
}

const ROWS: Row[] = [
  { id: 'ceres', name: 'Ceres', zh: '穀神星', alias: ['1 Ceres'], type: 'dwarf-planet', el: [2.765553, 0.079692, 10.58803, 80.24863, 153.54284, 67.96219, 1679.853, 2461200.5], radiusKm: 469.7, gm: 62.6284, rot: 9.07417, density: 2162, surface: 'moon', palette: ['#6f6a66', '#8a847e', '#4f4b48', '#d8d4cc'], desc: 'The largest object in the asteroid belt and the only dwarf planet in the inner Solar System. Dawn found bright salt deposits in Occator crater.', descZh: '小行星帶中最大的天體，也是內太陽系唯一的矮行星。黎明號在歐卡托撞擊坑發現明亮的鹽類沉積。', discovery: 'Giuseppe Piazzi, 1801' },
  { id: 'vesta', name: 'Vesta', zh: '灶神星', alias: ['4 Vesta'], type: 'asteroid', el: [2.361366, 0.090204, 7.14393, 103.70129, 255.16994, 336.3601, 1325.389, 2461200.5], radiusKm: 261.4, gm: 17.2882844, rot: 5.3421276, density: 3460, surface: 'moon', palette: ['#8c8580', '#a79e94', '#5f5954', '#c9c0b4'], desc: 'A differentiated protoplanet with a giant south-polar impact basin, Rheasilvia, whose central peak is ~22 km high.', descZh: '已分異的原行星，南極有巨大的雷亞希爾維亞撞擊盆地，中央峰高約 22 公里。', discovery: 'Heinrich Olbers, 1807' },
  { id: 'pallas', name: 'Pallas', zh: '智神星', alias: ['2 Pallas'], type: 'asteroid', el: [2.769559, 0.2307, 34.93279, 172.88662, 123.85654, 18.10619, 1683.505, 2461200.5], radiusKm: 256.5, gm: 13.63, rot: 7.8132214, density: 2890, surface: 'moon', palette: ['#7a7672', '#948f89', '#55514d', '#bdb7ae'], desc: 'The third-largest asteroid, on a steeply inclined (35°) orbit.', descZh: '第三大的小行星，軌道傾角高達 35°。', discovery: 'Heinrich Olbers, 1802' },
  { id: 'hygiea', name: 'Hygiea', zh: '健神星', alias: ['10 Hygiea'], type: 'asteroid', el: [3.150974, 0.106709, 3.82953, 283.11989, 235.54413, 127.57856, 2042.987, 2461200.5], radiusKm: 203.6, gm: 7, rot: 13.828, surface: 'moon', palette: ['#4e4b49', '#625e5b', '#393735', '#8a857f'], desc: 'A dark carbonaceous asteroid that appears nearly spherical — a candidate dwarf planet.', descZh: '近乎球形的暗色碳質小行星，被視為矮行星候選。', discovery: 'Annibale de Gasparis, 1849' },
  { id: 'eris', name: 'Eris', zh: '鬩神星', alias: ['136199 Eris', '2003 UB313'], type: 'dwarf-planet', el: [67.933947, 0.438239, 43.92583, 36.00477, 186.79969, 38.57413, 204516.663, 2461200.5], radiusKm: 1163, massKg: 1.6466e22, rot: 25.9, surface: 'ice', palette: ['#e8e4df', '#c9c2bb', '#fbf9f6', '#a79f98'], desc: 'The most massive known dwarf planet, slightly heavier than Pluto; its discovery led to the 2006 IAU definition of "planet".', descZh: '已知質量最大的矮行星，比冥王星略重；它的發現促成 2006 年 IAU 對「行星」的重新定義。', discovery: 'Brown, Trujillo & Rabinowitz, 2005', extra: { Moon: 'Dysnomia' }, src: [SBDB, { name: 'Holler et al. 2021 (mass); Sicardy et al. 2011 (radius)', license: 'Published scientific data' }] },
  { id: 'makemake', name: 'Makemake', zh: '鳥神星', alias: ['136472 Makemake', '2005 FY9'], type: 'dwarf-planet', el: [45.570933, 0.158889, 29.02786, 79.29483, 16.38711, 186.3251, 112364.807, 2461200.5], radiusKm: 715, rot: 22.8266, surface: 'ice', palette: ['#c98f6a', '#a86f50', '#e2b89a', '#7e5540'], desc: 'A reddish Kuiper Belt dwarf planet covered in methane ice.', descZh: '覆蓋甲烷冰、呈淡紅色的柯伊伯帶矮行星。', discovery: 'Brown, Trujillo & Rabinowitz, 2005', src: [SBDB, { name: 'Ortiz et al. 2012 (occultation size)', license: 'Published scientific data' }] },
  { id: 'haumea', name: 'Haumea', zh: '妊神星', alias: ['136108 Haumea', '2003 EL61'], type: 'dwarf-planet', el: [43.06029, 0.194443, 28.20847, 121.78606, 2.4766, 225.68702, 103208.117, 2461200.5], radiusKm: 798, rot: 3.9154, surface: 'ice', palette: ['#eef0f2', '#cfd4d8', '#ffffff', '#aab0b6'], desc: 'A fast-spinning (3.9 h), elongated dwarf planet with a ring and two moons. Radius shown is the mean of its ~2322 × 1704 × 1026 km ellipsoid.', descZh: '快速自轉（3.9 小時）的長橢球形矮行星，擁有一道環與兩顆衛星。半徑為其約 2322 × 1704 × 1026 公里橢球的平均值。', discovery: 'Brown et al. / Ortiz et al., 2004–2005', extra: { Shape: '~2322 × 1704 × 1026 km (Ortiz et al. 2017)' }, src: [SBDB, { name: 'Ortiz et al. 2017, Nature 550', license: 'Published scientific data' }] },
  { id: 'bennu', name: 'Bennu', zh: '貝努', alias: ['101955 Bennu', '1999 RQ36'], type: 'asteroid', el: [1.126391, 0.203745, 6.03494, 2.06087, 68.28393, 169.98788, 436.649, 2455562.5], radiusKm: 0.24222, gm: 4.8904e-9, rot: 4.296061, density: 1194, surface: 'moon', palette: ['#3d3a38', '#55514e', '#2a2826', '#77726d'], desc: 'A near-Earth rubble-pile asteroid sampled by NASA\'s OSIRIS-REx, which returned 121.6 g of material to Earth in 2023.', descZh: '近地碎石堆小行星，NASA 的 OSIRIS-REx 於 2023 年帶回 121.6 公克樣本。', discovery: 'LINEAR, 1999' },
]

export const SMALL_BODIES: CelestialObject[] = ROWS.map((r, k) => {
  const [a, e, i, Om, varpi, L, per, epoch] = r.el
  const massKg = r.massKg ?? (r.gm ? r.gm / G : undefined)
  return {
    id: r.id,
    name: r.name,
    nameZh: r.zh,
    aliases: r.alias,
    type: r.type,
    sourceType: 'real',
    parentId: 'sol',
    position: { kind: 'orbit', orbit: { a, e, i, Omega: Om, varpi, L, periodDays: per, epochJD: epoch } },
    physical: {
      radiusKm: r.radiusKm,
      massKg,
      rotationPeriodHours: r.rot,
      density: r.density,
      orbitalPeriodDays: per,
      distanceAU: a,
      extra: { 'Orbit epoch': `JD ${epoch}`, ...(r.extra ?? {}) },
    },
    visual: { renderer: 'planet', planet: { surface: r.surface, palette: r.palette, seed: 900 + k, craters: r.surface === 'moon' ? 1.1 : 0.2, roughness: 0.95 } },
    discoveryStatus: 'confirmed',
    description: r.desc,
    descriptionZh: r.descZh,
    discovery: r.discovery,
    dataSource: r.src ?? [SBDB],
    updatedAt: U,
  }
})
