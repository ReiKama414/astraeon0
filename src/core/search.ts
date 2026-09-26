import { registry } from './registry/CelestialRegistry'
import type { CelestialObject, CelestialType } from './registry/types'
import { typeLabel } from '../ui/i18n'

export interface SearchHit {
  obj: CelestialObject
  score: number
  parentName: string
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_*'’.]/g, '')
}

const TYPE_WORDS: Record<string, CelestialType[]> = {
  galaxy: ['galaxy'], galaxies: ['galaxy'], 星系: ['galaxy'],
  planet: ['planet', 'exoplanet', 'dwarf-planet'], planets: ['planet', 'exoplanet', 'dwarf-planet'], 行星: ['planet', 'exoplanet', 'dwarf-planet'],
  moon: ['moon'], moons: ['moon'], 衛星: ['moon'],
  star: ['star'], stars: ['star'], 恆星: ['star'],
  nebula: ['nebula'], nebulae: ['nebula'], 星雲: ['nebula'],
  blackhole: ['black-hole'], 黑洞: ['black-hole'],
  exoplanet: ['exoplanet'], 系外行星: ['exoplanet'],
  constellation: ['constellation'], 星座: ['constellation'],
  comet: ['comet'], 彗星: ['comet'],
}

/** Local in-memory index over the registry (names EN/ZH, aliases, catalogue IDs, type words, real/fantasy). */
export function searchLocal(query: string, filter: 'all' | 'real' | 'fictional' = 'all', limit = 24): SearchHit[] {
  const q = norm(query)
  const typeFilter = TYPE_WORDS[q]
  const wantFiction = q === 'fantasy' || q === 'fictional' || q === '幻想' || q === '虛構'
  const hits: SearchHit[] = []
  for (const o of registry.all()) {
    if (o.type === 'universe' && q.length < 3) continue
    if (filter === 'real' && o.sourceType !== 'real') continue
    if (filter === 'fictional' && o.sourceType === 'real') continue
    let score = 0
    if (!q) score = o.sourceType === 'real' ? 1 : 0.5
    else if (typeFilter) score = typeFilter.includes(o.type) ? 5 : 0
    else if (wantFiction) score = o.sourceType !== 'real' ? 5 : 0
    else {
      const fields = [o.name, o.nameZh ?? '', ...(o.aliases ?? []), o.id, typeLabel(o.type, 'en'), typeLabel(o.type, 'zh')]
      for (const [i, f] of fields.entries()) {
        const n = norm(f)
        if (!n) continue
        const w = i === 0 || i === 1 ? 1 : i < fields.length - 2 ? 0.9 : 0.35
        if (n === q) score = Math.max(score, 10 * w)
        else if (n.startsWith(q)) score = Math.max(score, 7 * w)
        else if (n.includes(q)) score = Math.max(score, 4 * w)
      }
    }
    if (score <= 0) continue
    // prefer notable objects
    if (['planet', 'galaxy', 'black-hole', 'nebula'].includes(o.type)) score += 0.3
    const parent = registry.get(o.parentId)
    hits.push({ obj: o, score, parentName: parent ? parent.name : '' })
  }
  return hits.sort((a, b) => b.score - a.score || a.obj.name.localeCompare(b.obj.name)).slice(0, limit)
}
