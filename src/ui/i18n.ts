import type { CelestialObject, CelestialType } from '../core/registry/types'

export type Lang = 'en' | 'zh'

export function displayName(o: CelestialObject, lang: Lang) {
  return lang === 'zh' && o.nameZh ? o.nameZh : o.name
}
export function displayDesc(o: CelestialObject, lang: Lang) {
  return lang === 'zh' && o.descriptionZh ? o.descriptionZh : o.description
}

const TYPE_LABEL: Record<CelestialType, [string, string]> = {
  universe: ['Universe', '宇宙'],
  'galaxy-group': ['Galaxy group', '星系群'],
  galaxy: ['Galaxy', '星系'],
  star: ['Star', '恆星'],
  'star-system': ['Star system', '恆星系統'],
  planet: ['Planet', '行星'],
  exoplanet: ['Exoplanet', '系外行星'],
  moon: ['Moon', '衛星'],
  'dwarf-planet': ['Dwarf planet', '矮行星'],
  asteroid: ['Asteroid', '小行星'],
  'asteroid-belt': ['Asteroid belt', '小行星帶'],
  comet: ['Comet', '彗星'],
  nebula: ['Nebula', '星雲'],
  'star-cluster': ['Star cluster', '星團'],
  'black-hole': ['Black hole', '黑洞'],
  constellation: ['Constellation', '星座'],
  'fantasy-planet': ['Fantasy planet', '幻想行星'],
}
export function typeLabel(t: CelestialType, lang: Lang) {
  return TYPE_LABEL[t]?.[lang === 'zh' ? 1 : 0] ?? t
}

const STR = {
  search: ['Search the universe', '搜尋宇宙'],
  explore: ['Explore', '探索'],
  travel: ['Travel', '前往'],
  enter: ['Enter', '進入'],
  favorite: ['Favorite', '收藏'],
  favorited: ['Saved', '已收藏'],
  encyclopedia: ['Encyclopedia', '百科'],
  compare: ['Compare', '比較'],
  unknown: ['Unknown', '未知'],
  real: ['Real', '真實'],
  fictional: ['Fictional', '虛構'],
  procedural: ['Procedural', '程序化'],
  back: ['Up one level', '返回上一層'],
  universe: ['Universe', '宇宙總覽'],
  reset: ['Reset view', '重設視角'],
  tour: ['Journey Through the Universe', '宇宙之旅'],
  photo: ['Photo mode', '攝影模式'],
  random: ['Explore random object', '隨機探索天體'],
  discover: ['Discover new world', '發現新世界'],
  favorites: ['Favorites', '收藏'],
  settings: ['Settings', '設定'],
  labels: ['Labels', '標籤'],
  orbits: ['Orbits', '軌道'],
  quality: ['Quality', '畫質'],
  stats: ['Performance monitor', '效能監控'],
  flight: ['Free flight', '自由飛行'],
  source: ['Data source', '資料來源'],
  simTime: ['Simulation time', '模擬時間'],
  noResults: ['No matches', '沒有結果'],
  pause: ['Pause', '暫停'],
  play: ['Play', '播放'],
  resetTime: ['Now', '現在'],
  lines: ['Constellation lines', '星座連線'],
  starNames: ['Star names', '恆星名稱'],
  depth: ['True 3D distances', '真實 3D 距離'],
} as const
export type StrKey = keyof typeof STR
export function t(k: StrKey, lang: Lang) {
  return STR[k][lang === 'zh' ? 1 : 0]
}
