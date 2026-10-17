import type { CelestialObject, DataSourceRef, PlanetVisual } from '../registry/types'

/**
 * Additional major moons — JPL Horizons osculating elements relative to their planet
 * (ecliptic J2000, epoch 2026-09-26 TDB); radius & mass from NASA/JPL planetary satellite physical parameters.
 */
const HOR: DataSourceRef = { name: 'JPL Horizons (osculating elements, epoch 2026-09-26)', url: 'https://ssd.jpl.nasa.gov/horizons/', license: 'Public domain (NASA/JPL)' }
const SAT: DataSourceRef = { name: 'JPL Planetary Satellite Physical Parameters', url: 'https://ssd.jpl.nasa.gov/sats/phys_par/', license: 'Public domain (NASA/JPL)' }
const EPOCH = 2461309.5

type Row = [id: string, name: string, zh: string, parent: string, a: number, e: number, i: number, Om: number, varpi: number, L: number, P: number, radiusKm: number, massKg: number, surface: PlanetVisual['surface'], palette: string[], craters: number, discovery: string, en: string, zhDesc: string]

const ROWS: Row[] = [
  ['phobos', 'Phobos', '火衛一', 'mars', 9378.1, 0.015315, 25.6639, 82.275, 357.5736, 22.6868, 0.319135, 11.08, 1.0659e16, 'moon', ['#6e625a', '#8a7c70', '#4d443e', '#a39585'], 1.4, 'Asaph Hall, 1877', 'The larger moon of Mars, spiralling inward about 2 m per century; it will break apart into a ring in ~50 million years.', '火星較大的衛星，每世紀向內螺旋約 2 公尺，約 5000 萬年後將瓦解成環。'],
  ['deimos', 'Deimos', '火衛二', 'mars', 23459.3, 0.000307, 24.1245, 81.512, 126.9964, 163.7859, 1.262623, 6.2, 1.4762e15, 'moon', ['#8a7d70', '#a3968a', '#6b6056', '#bcb0a2'], 0.6, 'Asaph Hall, 1877', 'The smaller, outer moon of Mars, smoothed by a thick regolith blanket.', '火星較小的外側衛星，表面覆蓋厚厚的風化層而顯得平滑。'],
  ['mimas', 'Mimas', '土衛一', 'saturn', 186029.2, 0.021325, 27.9903, 172.8819, 322.7109, 273.1257, 0.947413, 198.2, 3.75e19, 'moon', ['#bdb7b0', '#a39d96', '#d6d1ca', '#86817b'], 1.3, 'William Herschel, 1789', 'Dominated by the 139 km Herschel crater, giving it a famous "Death Star" look.', '表面被直徑 139 公里的赫歇爾撞擊坑主宰，外觀神似「死星」。'],
  ['enceladus', 'Enceladus', '土衛二', 'saturn', 238413.2, 0.006028, 28.0436, 169.5286, 9.6646, 37.0732, 1.374558, 252.1, 1.08e20, 'ice', ['#f4f7fa', '#dfe8ef', '#ffffff', '#b7c7d4'], 0.2, 'William Herschel, 1789', 'The most reflective body in the Solar System. Geysers at its south pole vent a global subsurface ocean into space.', '太陽系反照率最高的天體，南極噴泉將地下全球海洋的水噴入太空。'],
  ['tethys', 'Tethys', '土衛三', 'saturn', 294975.1, 0.001057, 28.1082, 171.8409, 119.6028, 110.0275, 1.891671, 531.1, 6.17e20, 'moon', ['#dcd8d2', '#c3bfb9', '#ece9e4', '#a29e98'], 0.9, 'Giovanni Cassini, 1684', 'An icy moon scarred by the vast Ithaca Chasma canyon system.', '冰質衛星，表面有巨大的伊薩卡峽谷。'],
  ['dione', 'Dione', '土衛四', 'saturn', 377646.6, 0.001952, 28.0255, 169.5486, 96.5256, 199.34, 2.740286, 561.4, 1.095e21, 'moon', ['#cdc8c2', '#b3aea8', '#e2ded9', '#94908a'], 0.9, 'Giovanni Cassini, 1684', 'Bright ice cliffs ("wispy terrain") streak its trailing hemisphere.', '尾隨半球上有明亮的冰崖（「纖維狀地形」）。'],
  ['rhea', 'Rhea', '土衛五', 'saturn', 527208.0, 0.001173, 28.2726, 169.9717, 345.0892, 355.2432, 4.520016, 763.8, 2.307e21, 'moon', ['#c9c4be', '#adaaa4', '#dedad5', '#8e8a85'], 1.1, 'Giovanni Cassini, 1672', "Saturn's second-largest moon, a heavily cratered ball of ice and rock.", '土星第二大的衛星，由冰與岩石組成，佈滿撞擊坑。'],
  ['iapetus', 'Iapetus', '土衛八', 'saturn', 3564689.7, 0.028304, 16.9784, 138.8723, 9.4938, 248.204, 79.469358, 734.5, 1.806e21, 'moon', ['#e2ddd4', '#3a2c22', '#f2eee8', '#1e1712'], 0.8, 'Giovanni Cassini, 1671', 'A two-toned moon — one hemisphere dark as coal, the other bright as snow — with a 20 km-high equatorial ridge.', '雙色衛星——一半黑如煤炭、一半白如積雪，赤道上有高達 20 公里的山脊。'],
  ['miranda', 'Miranda', '天衛五', 'uranus', 129870.2, 0.001553, 98.0652, 163.1919, 219.029, 173.3213, 1.413979, 235.8, 6.4e19, 'ice', ['#bfc3c6', '#9ea3a7', '#d8dcdf', '#7a7f83'], 0.4, 'Gerard Kuiper, 1948', 'A patchwork of wildly different terrains, including Verona Rupes, possibly the tallest cliff in the Solar System (~20 km).', '由截然不同的地形拼湊而成，包括可能是太陽系最高懸崖的維羅納斷崖（約 20 公里）。'],
  ['ariel', 'Ariel', '天衛一', 'uranus', 190945.0, 0.000463, 97.7179, 167.6658, 52.2721, 84.4302, 2.520798, 578.9, 1.251e21, 'moon', ['#c4c6c8', '#a6a9ac', '#dadcde', '#85888b'], 0.6, 'William Lassell, 1851', 'The brightest and possibly youngest-surfaced of the major Uranian moons.', '天王星主要衛星中最亮、表面可能最年輕的一顆。'],
  ['umbriel', 'Umbriel', '天衛二', 'uranus', 266014.8, 0.003495, 97.7143, 167.7252, 221.6365, 125.0437, 4.145093, 584.7, 1.275e21, 'moon', ['#5e5d5c', '#747371', '#4a4948', '#8e8c8a'], 1.1, 'William Lassell, 1851', 'The darkest of the large Uranian moons, with a mysterious bright ring (Wunda) at its equator.', '天王星大型衛星中最暗的一顆，赤道附近有神秘的明亮環狀地形（溫達）。'],
  ['titania', 'Titania', '天衛三', 'uranus', 436223.1, 0.002025, 97.7622, 167.6436, 87.3192, 299.9952, 8.70429, 788.4, 3.4e21, 'moon', ['#b9b3ad', '#9b958f', '#d0cbc5', '#7c7671'], 0.9, 'William Herschel, 1787', "Uranus's largest moon, cut by enormous fault canyons.", '天王星最大的衛星，表面有巨大的斷層峽谷。'],
  ['oberon', 'Oberon', '天衛四', 'uranus', 583556.4, 0.00246, 97.9057, 167.7083, 342.1217, 252.9153, 13.467749, 761.4, 3.076e21, 'moon', ['#a79e97', '#8b837c', '#bfb7b0', '#6c655f'], 1.1, 'William Herschel, 1787', 'The outermost major moon of Uranus, old and heavily cratered.', '天王星最外側的主要衛星，古老且佈滿撞擊坑。'],
  ['charon', 'Charon', '冥衛一', 'pluto', 19595.8, 0.000161, 112.8878, 227.3931, 40.0778, 100.5739, 6.387222, 606, 1.586e21, 'ice', ['#a9a7a6', '#8e8b89', '#c4c2c0', '#6f5a4e'], 0.4, 'James Christy, 1978', "Half Pluto's size, it forms a binary with Pluto; its north pole is stained red (Mordor Macula).", '大小約為冥王星一半，與冥王星構成雙星系統；北極有紅色的魔多斑。'],
]

export const MOONS: CelestialObject[] = ROWS.map(([id, name, zh, parent, a, e, i, Om, varpi, L, P, radiusKm, massKg, surface, palette, craters, discovery, en, zhDesc], k) => ({
  id,
  name,
  nameZh: zh,
  type: 'moon',
  sourceType: 'real',
  parentId: parent,
  position: { kind: 'orbit', orbit: { a, e, i, Omega: Om, varpi, L, periodDays: P, epochJD: EPOCH, plane: 'ecliptic' } },
  physical: { radiusKm, massKg, orbitalPeriodDays: P },
  visual: { renderer: 'planet', planet: { surface, palette, seed: 1200 + k, craters, roughness: 0.95 } },
  discoveryStatus: 'confirmed',
  description: en,
  descriptionZh: zhDesc,
  discovery,
  dataSource: [HOR, SAT],
  updatedAt: '2026-09-26',
}))
