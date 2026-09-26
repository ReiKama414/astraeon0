import type { CelestialObject, DataSourceRef } from '../registry/types'
import { dmsToDeg, hmsToDeg, PC_IN_LY } from '../coords/UniverseCoordinateSystem'

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

const CONSTELLATIONS: { id: string; name: string; zh: string; abbr: string; lines: [string, string][]; desc: string; descZh: string }[] = [
  {
    id: 'orion', name: 'Orion', zh: '獵戶座', abbr: 'Ori',
    lines: [['betelgeuse', 'bellatrix'], ['meissa', 'betelgeuse'], ['meissa', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'], ['mintaka', 'alnilam'], ['alnilam', 'alnitak'], ['alnitak', 'saiph'], ['mintaka', 'rigel']],
    desc: 'The Hunter — one of the most recognisable constellations, straddling the celestial equator. Its belt stars and the Orion Nebula lie in the Orion molecular cloud complex.',
    descZh: '獵人座——橫跨天球赤道、最易辨認的星座之一。其腰帶三星與獵戶座大星雲位於獵戶座分子雲複合體中。',
  },
  {
    id: 'ursa-major', name: 'Ursa Major', zh: '大熊座', abbr: 'UMa',
    lines: [['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'], ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']],
    desc: 'The Great Bear. Its seven brightest stars form the Big Dipper (Northern Dipper, 北斗七星); five of them belong to the Ursa Major Moving Group.',
    descZh: '大熊座，其七顆亮星組成北斗七星，其中五顆屬於大熊座移動星群。',
  },
  {
    id: 'cassiopeia', name: 'Cassiopeia', zh: '仙后座', abbr: 'Cas',
    lines: [['caph', 'schedar'], ['schedar', 'navi'], ['navi', 'ruchbah'], ['ruchbah', 'segin']],
    desc: 'The Queen, whose five brightest stars trace a distinctive "W" near the north celestial pole.',
    descZh: '皇后座，五顆亮星在北天極附近排成醒目的「W」形。',
  },
  {
    id: 'scorpius', name: 'Scorpius', zh: '天蠍座', abbr: 'Sco',
    lines: [['acrab', 'dschubba'], ['dschubba', 'fang'], ['dschubba', 'alniyat'], ['alniyat', 'antares'], ['antares', 'paikauhale'], ['paikauhale', 'larawag'], ['larawag', 'mu1-sco'], ['mu1-sco', 'zeta2-sco'], ['zeta2-sco', 'eta-sco'], ['eta-sco', 'sargas'], ['sargas', 'iota1-sco'], ['iota1-sco', 'kappa-sco'], ['kappa-sco', 'shaula'], ['shaula', 'lesath']],
    desc: 'The Scorpion, a zodiac constellation lying toward the Galactic Center, with the red supergiant Antares as its heart.',
    descZh: '天蠍座，位於銀河中心方向的黃道星座，紅超巨星心宿二是它的心臟。',
  },
  {
    id: 'cygnus', name: 'Cygnus', zh: '天鵝座', abbr: 'Cyg',
    lines: [['deneb', 'sadr'], ['sadr', 'eta-cyg'], ['eta-cyg', 'albireo'], ['fawaris', 'sadr'], ['sadr', 'gienah-cyg'], ['gienah-cyg', 'zeta-cyg']],
    desc: 'The Swan, flying along the Milky Way. Its brightest stars form the Northern Cross; Deneb is one of the most luminous stars known.',
    descZh: '天鵝座沿著銀河飛翔，亮星組成北十字，天津四是已知光度最高的恆星之一。',
  },
]

function bvToColor(bv: number): string {
  // Ballesteros (2012) B−V → temperature, then approximate blackbody RGB
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
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

export function bvToTemperature(bv: number) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
}

export const SKY_OBJECTS: CelestialObject[] = [
  {
    id: 'celestial-sphere',
    name: 'Night Sky from Earth',
    nameZh: '地球星空',
    type: 'constellation',
    sourceType: 'real',
    parentId: 'earth',
    position: { kind: 'origin' },
    physical: {},
    visual: { renderer: 'none', hostsScene: 'sky' },
    discoveryStatus: 'confirmed',
    description: 'The celestial sphere as seen from Earth. Constellations are patterns defined from our viewpoint — their stars are usually at very different distances and are not physically related.',
    descriptionZh: '從地球看到的天球。星座是從我們視角定義的圖案，其中的恆星通常距離差異很大，並非真實的物理群聚。',
    dataSource: [HIP, { name: 'IAU constellation boundaries & names', license: 'Public' }],
    updatedAt: U,
  },
  ...CONSTELLATIONS.map((c): CelestialObject => ({
    id: c.id,
    name: c.name,
    nameZh: c.zh,
    aliases: [c.abbr],
    type: 'constellation',
    sourceType: 'real',
    parentId: 'celestial-sphere',
    position: { kind: 'origin' },
    physical: { extra: { 'Stick figure': 'Asterism lines are a viewpoint-dependent pattern', 'IAU abbreviation': c.abbr } },
    visual: { renderer: 'constellation' },
    discoveryStatus: 'confirmed',
    description: c.desc,
    descriptionZh: c.descZh,
    dataSource: [HIP],
    updatedAt: U,
    constellation: { lines: c.lines, abbr: c.abbr },
  })),
  ...STAR_ROWS.map(([id, name, zh, con, h, m, s, d, dm, ds, vmag, bv, ly, sp]): CelestialObject => ({
    id,
    name,
    nameZh: zh,
    type: 'star',
    sourceType: 'real',
    parentId: con || 'celestial-sphere',
    position: { kind: 'equatorial', raDeg: hmsToDeg(h, m, s), decDeg: dmsToDeg(d, dm, ds), distancePc: ly ? ly / PC_IN_LY : 0 },
    physical: { apparentMagnitude: vmag, distanceLy: ly ?? undefined, spectralType: sp, temperatureK: Math.round(bvToTemperature(bv) / 10) * 10, extra: { 'B−V colour index': bv.toFixed(2), ...(ly ? {} : { Distance: 'Poorly constrained' }) } },
    visual: { renderer: 'star', starColor: bvToColor(bv), magnitude: vmag },
    discoveryStatus: 'confirmed',
    description: `${name} (${sp}), apparent magnitude ${vmag.toFixed(2)}${con ? `, in ${CONSTELLATIONS.find((c) => c.id === con)?.name}` : ''}.`,
    descriptionZh: `${zh}（${sp}），視星等 ${vmag.toFixed(2)}${con ? `，位於${CONSTELLATIONS.find((c) => c.id === con)?.zh}` : ''}。`,
    dataSource: [HIP],
    updatedAt: U,
  })),
]
