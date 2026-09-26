import { registry } from './CelestialRegistry'

/**
 * SceneStreamingManager — tracks which procedural objects are needed right now.
 * Holders (fantasy chunks, the active galaxy scene, favorites) retain IDs; after every scene
 * change `collect()` releases procedural objects nobody holds and that are not on the active path.
 * Real catalogue data is never collected.
 */
const holders = new Map<string, Set<string>>()

export function retain(holder: string, ids: string[]) {
  holders.set(holder, new Set(ids))
}
export function release(holder: string) {
  holders.delete(holder)
}

export function collect(activeSceneId: string) {
  const keep = new Set<string>()
  holders.forEach((s) => s.forEach((id) => keep.add(id)))
  const scene = registry.sceneById(activeSceneId)
  registry.ancestors(scene.hostId).forEach((a) => keep.add(a.id))
  const drop: string[] = []
  for (const o of registry.all()) {
    if (o.sourceType === 'real' || keep.has(o.id) || o.id === 'fantasy-universe') continue
    if (registry.sceneFor(o.id).id === activeSceneId) continue
    drop.push(o.id)
  }
  if (drop.length) registry.remove(drop)
  return drop.length
}

export function procCount() {
  return registry.all().filter((o) => o.sourceType !== 'real').length
}
