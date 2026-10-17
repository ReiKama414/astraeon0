import type { CelestialObject, CelestialType, SceneKind } from './types'
import { SOLAR_SYSTEM } from '../data/solarSystem'
import { DEEP_SPACE } from '../data/deepSpace'
import { SKY_OBJECTS } from '../data/stars'
import { SMALL_BODIES } from '../data/smallBodies'
import { MOONS } from '../data/moons'
import { DEEP_SPACE_2 } from '../data/deepSpace2'
import { FANTASY_ROOT, regenerateFromId } from '../procedural/generator'

export interface SceneRef {
  id: string
  kind: SceneKind
  hostId: string
}

/**
 * CelestialRegistry — the single source of truth for every celestial object.
 * Pure data: renderers query it but never own it. New objects (catalogue imports,
 * procedural chunks) are added with `upsert`; scenes react through `subscribe`.
 */
class Registry {
  private map = new Map<string, CelestialObject>()
  private children = new Map<string, Set<string>>()
  private listeners = new Set<() => void>()
  private pinned = new Set<string>()
  version = 0

  constructor(seed: CelestialObject[]) {
    seed.forEach((o) => this.insert(o))
  }

  private insert(o: CelestialObject) {
    const prev = this.map.get(o.id)
    if (prev?.sourceType === 'real' && o.sourceType !== 'real') {
      // procedural data must never overwrite real catalogue data
      console.warn(`[registry] refused to overwrite real object ${o.id} with ${o.sourceType} data`)
      return
    }
    if (prev && prev.parentId !== o.parentId && prev.parentId) this.children.get(prev.parentId)?.delete(o.id)
    this.map.set(o.id, o)
    if (o.parentId) {
      if (!this.children.has(o.parentId)) this.children.set(o.parentId, new Set())
      this.children.get(o.parentId)!.add(o.id)
    }
  }

  upsert(objs: CelestialObject[]) {
    let changed = false
    for (const o of objs) {
      if (this.map.get(o.id) !== o) {
        this.insert(o)
        changed = true
      }
    }
    if (changed) this.emit()
  }

  remove(ids: string[]) {
    let changed = false
    for (const id of ids) {
      const o = this.map.get(id)
      if (!o || o.sourceType === 'real' || this.pinned.has(id)) continue
      this.map.delete(id)
      if (o.parentId) this.children.get(o.parentId)?.delete(id)
      changed = true
    }
    if (changed) this.emit()
  }

  /** Keep a procedural object alive across chunk unloads (e.g. current travel target). */
  pin(id: string, on = true) {
    if (on) this.pinned.add(id)
    else this.pinned.delete(id)
  }

  get(id: string | null | undefined): CelestialObject | undefined {
    if (!id) return undefined
    return this.map.get(id)
  }

  /** Like get, but regenerates procedural objects from their seed-encoded ID when absent. */
  resolve(id: string): CelestialObject | undefined {
    const o = this.map.get(id)
    if (o) return o
    const regen = regenerateFromId(id)
    if (regen) {
      this.upsert(regen)
      return this.map.get(id)
    }
    return undefined
  }

  childrenOf(id: string): CelestialObject[] {
    const s = this.children.get(id)
    if (!s) return []
    const out: CelestialObject[] = []
    s.forEach((cid) => {
      const c = this.map.get(cid)
      if (c) out.push(c)
    })
    return out
  }

  all(): CelestialObject[] {
    return [...this.map.values()]
  }

  byType(...types: CelestialType[]) {
    return this.all().filter((o) => types.includes(o.type))
  }

  ancestors(id: string): CelestialObject[] {
    const out: CelestialObject[] = []
    let cur = this.map.get(id)
    let guard = 0
    while (cur && guard++ < 32) {
      out.push(cur)
      cur = cur.parentId ? this.map.get(cur.parentId) : undefined
    }
    return out
  }

  /** The scene in which the object is explored. Objects that host their own scene resolve to it. */
  sceneFor(id: string): SceneRef {
    for (const a of this.ancestors(id)) {
      if (a.visual.hostsScene) return { id: sceneId(a.visual.hostsScene, a.id), kind: a.visual.hostsScene, hostId: a.id }
    }
    return { id: 'universe', kind: 'universe', hostId: 'universe' }
  }

  /** The scene that shows this object as a marker/portal (i.e. its parent's scene). */
  parentSceneFor(id: string): SceneRef {
    const o = this.map.get(id)
    if (!o?.parentId) return { id: 'universe', kind: 'universe', hostId: 'universe' }
    return this.sceneFor(o.parentId)
  }

  sceneById(sid: string): SceneRef {
    if (sid === 'universe') return { id: 'universe', kind: 'universe', hostId: 'universe' }
    const [kind, ...rest] = sid.split(':')
    return { id: sid, kind: kind as SceneKind, hostId: rest.join(':') }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emitScheduled = false
  private emit() {
    if (this.emitScheduled) return
    this.emitScheduled = true
    queueMicrotask(() => {
      this.emitScheduled = false
      this.version++
      this.listeners.forEach((l) => l())
    })
  }
}

export function sceneId(kind: SceneKind, hostId: string) {
  return kind === 'universe' ? 'universe' : `${kind}:${hostId}`
}

const FANTASY_ROOT_OBJ: CelestialObject = {
  id: FANTASY_ROOT,
  name: 'The Veil — Fictional Sector',
  nameZh: '幻域．虛構星區',
  type: 'galaxy-group',
  sourceType: 'fantasy',
  parentId: 'universe',
  position: { kind: 'galactocentric', xKpc: -60000, yKpc: 42000, zKpc: 30000 },
  physical: { extra: { Generation: 'Chunk-based, seed-deterministic' } },
  visual: { renderer: 'none', hostsScene: 'fantasy-universe', label: true, sceneRadius: 120 },
  discoveryStatus: 'fictional',
  description: 'An endless, procedurally generated region of fictional galaxies. Nothing here exists in the real universe; every object is reproducible from its seed.',
  descriptionZh: '無盡的程序化幻想星系區域。此處一切皆不存在於真實宇宙，每個天體都可由其種子重新生成。',
  dataSource: [{ name: 'ASTRALIS procedural generator', license: 'Fictional — generated content' }],
  updatedAt: 'procedural',
}

export const registry = new Registry([...DEEP_SPACE, ...DEEP_SPACE_2, ...SOLAR_SYSTEM, ...SMALL_BODIES, ...MOONS, ...SKY_OBJECTS, FANTASY_ROOT_OBJ])
