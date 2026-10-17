import type { CelestialObject, DataSourceRef } from '../registry/types'
import { dmsToDeg, hmsToDeg, PC_IN_LY } from '../coords/UniverseCoordinateSystem'
import skyJson from './generated/sky.json'
import { CONSTELLATION_INFO } from './constellationInfo'

const U = '2025-01-15'
const HIP: DataSourceRef = { name: 'Hipparcos / SIMBAD (CDS) — positions J2000, V magnitudes, B−V', url: 'https://simbad.u-strasbg.fr/', license: 'Free use with acknowledgement' }

/** [id, name, zh, constellation, RA h m s, Dec d m s, Vmag, B−V, distance ly (null = poorly constrained), spectral] */
type Row = [string, string, string, string, number, number, number, number, number, number, number, number, number | null, string]

export const STAR_ROWS: Row[] = [
  // Orion
  ['betelgeuse', 'Betelgeuse', '參宿四', 'orion', 5, 55, 10.31, 7, 24, 25.4, 0.5, 1.85, 548, 'M1–M2 Ia–ab'],
  ['rigel', 'Rigel', '參宿七', 'orion', 5, 14, 32.27, -8, 12, 5.9, 0.13, -0.03, 860, 'B8 Ia'],
  ['bellatrix', 'Bellatrix', '參宿五', 'orion', 5, 25, 7.86, 6, 20, 58.9, 1.64, -0.22, 250, 'B2 III'],
  ['mintaka', 'Mintaka', '參宿三', 'orion', 5, 32, 0.4, -0, 17, 56.7, 2.23, -0.18, 1200, 'O9.5 II'],
  ['alnilam', 'Alnilam', '參宿二', 'orion', 5, 36, 12.81, -1, 12, 6.9, 1.69, -0.18, null, 'B0 Ia'],
  ['alnitak', 'Alnitak', '參宿一', 'orion', 5, 40, 45.53, -1, 56, 33.3, 1.77, -0.21, 1260, 'O9.7 Ib'],
  ['saiph', 'Saiph', '參宿六', 'orion', 5, 47, 45.39, -9, 40, 10.6, 2.09, -0.17, 650, 'B0.5 Ia'],
  ['meissa', 'Meissa', '觜宿一', 'orion', 5, 35, 8.28, 9, 56, 3.0, 3.39, -0.16, 1100, 'O8 III'],
  // Ursa Major
  ['dubhe', 'Dubhe', '天樞', 'ursa-major', 11, 3, 43.67, 61, 45, 3.7, 1.79, 1.07, 123, 'K0 III'],
  ['merak', 'Merak', '天璇', 'ursa-major', 11, 1, 50.48, 56, 22, 56.7, 2.37, -0.02, 79.7, 'A1 IV'],
  ['phecda', 'Phecda', '天璣', 'ursa-major', 11, 53, 49.85, 53, 41, 41.1, 2.44, 0.0, 83.2, 'A0 Ve'],
  ['megrez', 'Megrez', '天權', 'ursa-major', 12, 15, 25.56, 57, 1, 57.4, 3.31, 0.08, 58.4, 'A3 V'],
  ['alioth', 'Alioth', '玉衡', 'ursa-major', 12, 54, 1.75, 55, 57, 35.4, 1.77, -0.02, 82.6, 'A1 III–IVp'],
  ['mizar', 'Mizar', '開陽', 'ursa-major', 13, 23, 55.54, 54, 55, 31.3, 2.23, 0.02, 82.9, 'A2 V'],
  ['alkaid', 'Alkaid', '搖光', 'ursa-major', 13, 47, 32.44, 49, 18, 47.8, 1.86, -0.19, 104, 'B3 V'],
  // Cassiopeia
  ['schedar', 'Schedar', '王良四', 'cassiopeia', 0, 40, 30.44, 56, 32, 14.4, 2.24, 1.17, 228, 'K0 IIIa'],
  ['caph', 'Caph', '王良一', 'cassiopeia', 0, 9, 10.69, 59, 8, 59.2, 2.28, 0.34, 54.7, 'F2 III'],
  ['navi', 'Gamma Cassiopeiae', '策', 'cassiopeia', 0, 56, 42.53, 60, 43, 0.3, 2.47, -0.15, 550, 'B0.5 IVe'],
  ['ruchbah', 'Ruchbah', '閣道三', 'cassiopeia', 1, 25, 48.95, 60, 14, 7.0, 2.68, 0.13, 99.4, 'A5 IV'],
  ['segin', 'Segin', '閣道二', 'cassiopeia', 1, 54, 23.73, 63, 40, 12.4, 3.37, -0.15, 410, 'B3 III'],
  // Scorpius
  ['antares', 'Antares', '心宿二', 'scorpius', 16, 29, 24.46, -26, 25, 55.2, 1.06, 1.83, 550, 'M1.5 Iab'],
  ['acrab', 'Acrab', '房宿四', 'scorpius', 16, 5, 26.23, -19, 48, 19.6, 2.62, -0.07, 400, 'B1 V'],
  ['dschubba', 'Dschubba', '房宿三', 'scorpius', 16, 0, 20.01, -22, 37, 18.1, 2.29, -0.12, 490, 'B0.3 IV'],
  ['fang', 'Fang (π Sco)', '房宿一', 'scorpius', 15, 58, 51.11, -26, 6, 50.8, 2.89, -0.19, 590, 'B1 V'],
  ['alniyat', 'Alniyat (σ Sco)', '心宿一', 'scorpius', 16, 21, 11.32, -25, 35, 34.1, 2.88, 0.13, 700, 'B1 III'],
  ['paikauhale', 'Paikauhale (τ Sco)', '心宿三', 'scorpius', 16, 35, 52.95, -28, 12, 57.7, 2.82, -0.25, 470, 'B0 V'],
  ['larawag', 'Larawag (ε Sco)', '尾宿二', 'scorpius', 16, 50, 9.81, -34, 17, 35.6, 2.29, 1.15, 63.7, 'K1 III'],
  ['mu1-sco', 'μ¹ Scorpii', '尾宿一', 'scorpius', 16, 51, 52.23, -38, 2, 50.6, 3.08, -0.2, 500, 'B1.5 V'],
  ['zeta2-sco', 'ζ² Scorpii', '尾宿三', 'scorpius', 16, 54, 35.0, -42, 21, 41.0, 3.62, 1.37, 130, 'K4 III'],
  ['eta-sco', 'η Scorpii', '尾宿五', 'scorpius', 17, 12, 9.2, -43, 14, 21.0, 3.33, 0.41, 72, 'F2 IV'],
  ['sargas', 'Sargas (θ Sco)', '尾宿五', 'scorpius', 17, 37, 19.13, -42, 59, 52.2, 1.86, 0.4, 300, 'F1 II'],
  ['iota1-sco', 'ι¹ Scorpii', '尾宿七', 'scorpius', 17, 47, 35.08, -40, 7, 37.2, 2.99, 0.51, null, 'F2 Ia'],
  ['kappa-sco', 'κ Scorpii', '尾宿六', 'scorpius', 17, 42, 29.28, -39, 1, 47.9, 2.39, -0.22, 480, 'B1.5 III'],
  ['shaula', 'Shaula', '尾宿八', 'scorpius', 17, 33, 36.52, -37, 6, 13.8, 1.62, -0.22, 570, 'B2 IV'],
  ['lesath', 'Lesath', '尾宿九', 'scorpius', 17, 30, 45.84, -37, 17, 44.9, 2.7, -0.22, 580, 'B2 IV'],
  // Cygnus
  ['deneb', 'Deneb', '天津四', 'cygnus', 20, 41, 25.91, 45, 16, 49.2, 1.25, 0.09, 2600, 'A2 Ia'],
  ['sadr', 'Sadr', '天津一', 'cygnus', 20, 22, 13.7, 40, 15, 24.0, 2.23, 0.67, 1800, 'F8 Iab'],
  ['albireo', 'Albireo', '輦道增七', 'cygnus', 19, 30, 43.28, 27, 57, 34.8, 3.18, 1.13, 430, 'K3 II + B8 V'],
  ['gienah-cyg', 'Aljanah (ε Cyg)', '天津九', 'cygnus', 20, 46, 12.68, 33, 58, 12.9, 2.48, 1.03, 72.7, 'K0 III'],
  ['fawaris', 'Fawaris (δ Cyg)', '天津二', 'cygnus', 19, 44, 58.48, 45, 7, 50.9, 2.87, -0.03, 165, 'B9.5 III'],
  ['eta-cyg', 'η Cygni', '輦道二', 'cygnus', 19, 56, 18.37, 35, 5, 0.3, 3.89, 1.02, 139, 'K0 III'],
  ['zeta-cyg', 'ζ Cygni', '天津八', 'cygnus', 21, 12, 56.19, 30, 13, 37.5, 3.21, 0.99, 143, 'G8 III'],
  // Bright field stars
  ['sirius', 'Sirius', '天狼星', '', 6, 45, 8.92, -16, 42, 58.0, -1.46, 0.0, 8.6, 'A1 V'],
  ['canopus', 'Canopus', '老人星', '', 6, 23, 57.11, -52, 41, 44.4, -0.74, 0.15, 310, 'A9 II'],
  ['arcturus', 'Arcturus', '大角星', '', 14, 15, 39.67, 19, 10, 56.7, -0.05, 1.23, 36.7, 'K1.5 III'],
  ['vega', 'Vega', '織女一', '', 18, 36, 56.34, 38, 47, 1.3, 0.03, 0.0, 25.0, 'A0 V'],
  ['capella', 'Capella', '五車二', '', 5, 16, 41.36, 45, 59, 52.8, 0.08, 0.8, 42.9, 'G3 III + G0 III'],
  ['procyon', 'Procyon', '南河三', '', 7, 39, 18.12, 5, 13, 30.0, 0.34, 0.42, 11.46, 'F5 IV–V'],
  ['altair', 'Altair', '牛郎星', '', 19, 50, 47.0, 8, 52, 6.0, 0.77, 0.22, 16.7, 'A7 V'],
  ['aldebaran', 'Aldebaran', '畢宿五', '', 4, 35, 55.24, 16, 30, 33.5, 0.86, 1.54, 65.3, 'K5 III'],
  ['spica', 'Spica', '角宿一', '', 13, 25, 11.58, -11, 9, 40.8, 0.97, -0.23, 250, 'B1 V'],
  ['pollux', 'Pollux', '北河三', '', 7, 45, 18.95, 28, 1, 34.3, 1.14, 1.0, 33.8, 'K0 III'],
  ['fomalhaut', 'Fomalhaut', '北落師門', '', 22, 57, 39.05, -29, 37, 20.1, 1.16, 0.09, 25.1, 'A3 V'],
  ['polaris', 'Polaris', '北極星', '', 2, 31, 49.09, 89, 15, 50.8, 1.98, 0.6, 433, 'F7 Ib'],
  ['regulus', 'Regulus', '軒轅十四', '', 10, 8, 22.31, 11, 58, 2.0, 1.4, -0.11, 79.3, 'B8 IVn'],
  ['alpha-cen', 'Alpha Centauri', '南門二', '', 14, 39, 36.49, -60, 50, 2.3, -0.27, 0.71, 4.37, 'G2 V + K1 V'],
  ['achernar', 'Achernar', '水委一', '', 1, 37, 42.85, -57, 14, 12.3, 0.46, -0.16, 139, 'B6 Vep'],
  ['hadar', 'Hadar', '馬腹一', '', 14, 3, 49.41, -60, 22, 22.9, 0.61, -0.23, 390, 'B1 III'],
  ['acrux', 'Acrux', '十字架二', '', 12, 26, 35.9, -63, 5, 56.7, 0.76, -0.24, 320, 'B0.5 IV'],
]

export function bvToColor(bv: number): string {
  const t = bvToTemperature(bv)
  const [r, g, b] = kelvinToRgb(t)
  const h = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function kelvinToRgb(k: number): [number, number, number] {
  const t = k / 100
  let r: number, g: number, b: number
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  return [r / 255, g / 255, b / 255].map((v) => Math.max(0, Math.min(1, v))) as [number, number, number]
}

/** Ballesteros (2012) B−V → effective temperature */
export function bvToTemperature(bv: number) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
}

// ---------------------------------------------------------------------------------------------
// Full-sky catalogue generated from d3-celestial (see scripts/build-sky-data.mjs)
// ---------------------------------------------------------------------------------------------
export interface SkyData {
  stars: [number, number, number, number, number][]
  starNames: Record<string, [string, string, string, string]>
  constellations: { id: string; en: string; zh: string; gen: string; rank: number; center: [number, number]; brightest: number | null; lines: [number, number][][] }[]
  dsos: { id: string; desig: string; alt: string; type: string; mag: number; dim: string; ra: number; dec: number }[]
}
export const SKY = skyJson as unknown as SkyData

const D3C: DataSourceRef = { name: 'd3-celestial catalogue (Hipparcos / Yale BSC, IAU figures) — Olaf Frohn', url: 'https://github.com/ofrohn/d3-celestial', license: 'BSD-3-Clause' }
const LEGACY_IDS: Record<string, string> = { Ori: 'orion', UMa: 'ursa-major', Cas: 'cassiopeia', Sco: 'scorpius', Cyg: 'cygnus' }
export const constellationId = (abbr: string) => LEGACY_IDS[abbr] ?? `con-${abbr.toLowerCase()}`

const seenCon = new Set<string>()
const CONS = SKY.constellations.filter((c) => (seenCon.has(c.id) ? false : (seenCon.add(c.id), true)))
const conByAbbr = new Map(CONS.map((c) => [c.id, c]))

// curated rows (with distances & spectral types) keyed by nearest catalogue star
const curatedByHip = new Map<number, Row>()
for (const row of STAR_ROWS) {
  const [, , , , h, m, s, d, dm, ds] = row
  const raDeg = hmsToDeg(h, m, s)
  const decDeg = dmsToDeg(d, dm, ds)
  let best: number | null = null
  let bd = 0.25
  for (const st of SKY.stars) {
    const dd = Math.hypot((((st[1] - raDeg + 540) % 360) - 180) * Math.cos((decDeg * Math.PI) / 180), st[2] - decDeg)
    if (dd < bd) {
      bd = dd
      best = st[0]
    }
  }
  if (best !== null) curatedByHip.set(best, row)
}

const MESSIER_ZH: Record<string, string> = {
  M2: '寶瓶座球狀星團', M3: '獵犬座球狀星團', M4: '天蠍座球狀星團', M6: '蝴蝶星團', M7: '托勒密星團', M8: '礁湖星雲', M11: '野鴨星團', M13: '武仙座大星團', M17: 'ω 星雲（天鵝星雲）', M20: '三裂星雲', M22: '人馬座球狀星團',
  M24: '人馬座恆星雲', M27: '啞鈴星雲', M32: 'M32 矮橢圓星系', M35: '雙子座星團', M41: '大犬座星團', M43: '德梅朗星雲', M44: '蜂巢星團', M45: '昴宿星團', M47: '船尾座星團', M49: '室女座橢圓星系', M51: '渦狀星系', M57: '環狀星雲',
  M63: '向日葵星系', M64: '黑眼星系', M65: 'M65 獅子座三重星系', M66: 'M66 獅子座三重星系', M74: '幻影星系', M76: '小啞鈴星雲', M77: '鯨魚座 A', M78: 'M78 反射星雲', M82: '雪茄星系', M83: '南風車星系', M97: '夜梟星雲', M110: 'M110 矮橢圓星系',
}
const DSO_TYPE: Record<string, [CelestialObject['type'], string, string]> = {
  gc: ['star-cluster', 'Globular cluster', '球狀星團'],
  oc: ['star-cluster', 'Open cluster', '疏散星團'],
  s: ['galaxy', 'Spiral galaxy', '螺旋星系'],
  e: ['galaxy', 'Elliptical galaxy', '橢圓星系'],
  i: ['galaxy', 'Irregular galaxy', '不規則星系'],
  pn: ['nebula', 'Planetary nebula', '行星狀星雲'],
  snr: ['nebula', 'Supernova remnant', '超新星殘骸'],
  sfr: ['nebula', 'Star-forming region', '恆星形成區'],
  rn: ['nebula', 'Reflection nebula', '反射星雲'],
  pos: ['star-cluster', 'Asterism / double star', '星群／雙星'],
}
/** Messier objects that already have a dedicated 3D scene elsewhere in the registry. */
const MESSIER_IN_3D: Record<string, string> = { M1: 'm1', M8: 'm8', M13: 'm13', M16: 'm16', M31: 'm31', M33: 'm33', M42: 'm42', M45: 'm45', M51: 'm51', M57: 'm57', M81: 'm81', M82: 'm82', M83: 'm83', M87: 'm87', M101: 'm101', M104: 'm104' }
export const messierAlias = (m: string) => MESSIER_IN_3D[m]

function conOfPoint(raDeg: number, decDeg: number): string {
  // nearest constellation figure vertex — good enough for labelling a star/DSO's constellation
  let best = ''
  let bd = Infinity
  for (const c of CONS)
    for (const pl of c.lines)
      for (const [a, d] of pl) {
        const dd = Math.hypot((((a - raDeg + 540) % 360) - 180) * Math.cos((decDeg * Math.PI) / 180), d - decDeg)
        if (dd < bd) {
          bd = dd
          best = c.id
        }
      }
  return best
}

const starObjects: CelestialObject[] = []
const starIdByHip = new Map<number, string>()
for (const [hipStr, [en, zh, bayer, con]] of Object.entries(SKY.starNames)) {
  const hip = +hipStr
  const st = SKY.stars.find((s) => s[0] === hip)
  if (!st) continue
  const cur = curatedByHip.get(hip)
  const [, raDeg, decDeg, vmag, bv] = st
  const conDef = conByAbbr.get(con)
  const displayEn = cur ? cur[1] : en || `${bayer} ${conDef?.gen ?? con}`.trim()
  const displayZh = cur ? cur[2] : zh || undefined
  const ly = cur ? cur[12] : null
  const sp = cur ? cur[13] : undefined
  const id = cur ? cur[0] : `hip-${hip}`
  starIdByHip.set(hip, id)
  const conName = conDef ? conDef.en : ''
  starObjects.push({
    id,
    name: displayEn,
    nameZh: displayZh,
    aliases: [`HIP ${hip}`, ...(bayer && conDef ? [`${bayer} ${conDef.gen}`, `${bayer} ${con}`] : [])],
    type: 'star',
    sourceType: 'real',
    parentId: conDef ? constellationId(con) : 'celestial-sphere',
    position: { kind: 'equatorial', raDeg, decDeg, distancePc: ly ? ly / PC_IN_LY : 0 },
    physical: {
      apparentMagnitude: vmag,
      distanceLy: ly ?? undefined,
      spectralType: sp,
      temperatureK: Math.round(bvToTemperature(bv) / 10) * 10,
      extra: { 'B−V colour index': bv.toFixed(2), 'Hipparcos': String(hip), ...(bayer ? { Designation: `${bayer} ${conDef?.gen ?? con}` } : {}) },
    },
    visual: { renderer: 'star', starColor: bvToColor(bv), magnitude: vmag },
    discoveryStatus: 'confirmed',
    description: `${displayEn}${sp ? ` (${sp})` : ''}, apparent magnitude ${vmag.toFixed(2)}${conName ? `, in ${conName}` : ''}.${ly ? ` About ${ly.toLocaleString('en-US')} light-years away.` : ''}`,
    descriptionZh: `${displayZh ?? displayEn}${sp ? `（${sp}）` : ''}，視星等 ${vmag.toFixed(2)}${conDef ? `，位於${conDef.zh}` : ''}。${ly ? `距離約 ${ly.toLocaleString('en-US')} 光年。` : ''}`,
    dataSource: cur ? [HIP, D3C] : [D3C],
    updatedAt: '2026-09-26',
  })
}
// curated bright field stars not in the named list (safety)
for (const row of STAR_ROWS) {
  if (starObjects.some((o) => o.id === row[0])) continue
  const [id, name, zh, , h, m, s, d, dm, ds, vmag, bv, ly, sp] = row
  starObjects.push({
    id, name, nameZh: zh, type: 'star', sourceType: 'real', parentId: 'celestial-sphere',
    position: { kind: 'equatorial', raDeg: hmsToDeg(h, m, s), decDeg: dmsToDeg(d, dm, ds), distancePc: ly ? ly / PC_IN_LY : 0 },
    physical: { apparentMagnitude: vmag, distanceLy: ly ?? undefined, spectralType: sp, temperatureK: Math.round(bvToTemperature(bv) / 10) * 10 },
    visual: { renderer: 'star', starColor: bvToColor(bv), magnitude: vmag },
    discoveryStatus: 'confirmed', description: `${name} (${sp}), apparent magnitude ${vmag.toFixed(2)}.`, descriptionZh: `${zh}（${sp}），視星等 ${vmag.toFixed(2)}。`, dataSource: [HIP], updatedAt: U,
  })
}

const constellationObjects: CelestialObject[] = CONS.map((c) => {
  const info = CONSTELLATION_INFO[c.id]
  const brightest = c.brightest ? SKY.starNames[String(c.brightest)] : undefined
  const bStar = c.brightest ? SKY.stars.find((s) => s[0] === c.brightest) : undefined
  const bName = brightest ? brightest[0] || `${brightest[2]} ${c.gen}` : undefined
  const bNameZh = brightest ? brightest[1] || bName : undefined
  const figureStars = c.lines.reduce((n, l) => n + l.length, 0)
  return {
    id: constellationId(c.id),
    name: c.en,
    nameZh: c.zh,
    aliases: [c.id, c.gen],
    type: 'constellation',
    sourceType: 'real',
    parentId: 'celestial-sphere',
    position: { kind: 'equatorial', raDeg: c.center[0], decDeg: c.center[1], distancePc: 0 },
    physical: {
      extra: {
        'IAU abbreviation': c.id,
        Genitive: c.gen,
        ...(bName ? { 'Brightest star': `${bName}${bStar ? ` (mag ${bStar[3].toFixed(2)})` : ''}` } : {}),
        ...(info?.season ? { 'Best seen': info.season[0] } : {}),
        'Stick figure': 'Viewpoint-dependent pattern — stars lie at very different distances',
      },
    },
    visual: { renderer: 'constellation' },
    discoveryStatus: 'confirmed',
    description: info?.en ?? `${c.en} (${c.gen}), one of the 88 IAU constellations.${bName ? ` Its brightest figure star is ${bName}.` : ''} Its traditional stick figure links ${figureStars} points.`,
    descriptionZh: info?.zh ?? `${c.zh}，國際天文聯合會定義的 88 個星座之一。${bNameZh ? `連線中最亮的恆星是${bNameZh}。` : ''}`,
    dataSource: [D3C, { name: 'IAU constellation names & boundaries', license: 'Public' }],
    updatedAt: '2026-09-26',
    constellation: { abbr: c.id, lines: [], polylines: c.lines },
  }
})

const dsoObjects: CelestialObject[] = SKY.dsos
  .filter((d) => !MESSIER_IN_3D[d.id])
  .map((d) => {
    const [type, tEn, tZh] = DSO_TYPE[d.type] ?? ['nebula', 'Deep-sky object', '深空天體']
    const con = conByAbbr.get(conOfPoint(d.ra, d.dec))
    const name = d.alt ? `${d.alt}` : d.id
    const zh = MESSIER_ZH[d.id] ?? `梅西耶 ${d.id.slice(1)}`
    return {
      id: d.id.toLowerCase(),
      name,
      nameZh: zh,
      aliases: [d.id, d.desig, `Messier ${d.id.slice(1)}`].filter(Boolean),
      type,
      sourceType: 'real',
      parentId: 'celestial-sphere',
      position: { kind: 'equatorial', raDeg: d.ra, decDeg: d.dec, distancePc: 0 },
      physical: { apparentMagnitude: d.mag, morphology: tEn, extra: { Catalogue: `${d.id} · ${d.desig}`, Kind: tEn, 'Apparent size': `${d.dim}′`, ...(con ? { Constellation: con.en } : {}) } },
      visual: { renderer: 'none', magnitude: d.mag },
      discoveryStatus: 'confirmed',
      description: `${d.id}${d.alt ? ` — the ${d.alt}` : ''}: a ${tEn.toLowerCase()}${con ? ` in ${con.en}` : ''}, magnitude ${d.mag}, spanning about ${d.dim} arcminutes of sky.`,
      descriptionZh: `${d.id}${MESSIER_ZH[d.id] ? `（${MESSIER_ZH[d.id]}）` : ''}：${con ? `位於${con.zh}的` : ''}${tZh}，視星等 ${d.mag}，視大小約 ${d.dim} 角分。`,
      dataSource: [D3C, { name: 'Messier catalogue (1781)', license: 'Public domain' }],
      updatedAt: '2026-09-26',
    } as CelestialObject
  })

export const SKY_OBJECTS: CelestialObject[] = [
  {
    id: 'celestial-sphere',
    name: 'Night Sky from Earth',
    nameZh: '地球星空',
    type: 'constellation',
    sourceType: 'real',
    parentId: 'earth',
    position: { kind: 'origin' },
    physical: { extra: { Stars: `${SKY.stars.length.toLocaleString()} (to magnitude 6)`, Constellations: '88 (IAU)', 'Deep-sky objects': '110 Messier objects' } },
    visual: { renderer: 'none', hostsScene: 'sky' },
    discoveryStatus: 'confirmed',
    description: 'The celestial sphere as seen from Earth: every star visible to the naked eye, the 88 IAU constellations and the Messier catalogue. Constellations are patterns defined from our viewpoint — their stars are usually at very different distances.',
    descriptionZh: '從地球看見的天球：肉眼可見的所有恆星、國際天文聯合會的 88 個星座與梅西耶天體。星座是從我們視角定義的圖案，其中的恆星距離通常相差甚遠。',
    dataSource: [D3C, HIP],
    updatedAt: '2026-09-26',
  },
  ...constellationObjects,
  ...starObjects,
  ...dsoObjects,
]

export { starIdByHip }
