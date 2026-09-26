import { create } from 'zustand'
import * as THREE from 'three'
import { registry } from './registry/CelestialRegistry'
import { retain } from './registry/SceneStreamingManager'
import { rig, rigQuat } from '../scenes/common/cameraRig'
import { travelTo } from './navigation/Navigator'
import type { SourceType } from './registry/types'

export interface Favorite {
  id: string
  name: string
  type: string
  sourceType: SourceType
  seed?: number
  /** camera pose relative to the target: distance + orientation quaternion */
  cameraDistance: number
  cameraQuat: [number, number, number, number]
  cameraOffset: [number, number, number]
  savedAt: number
}

/** Tiny IndexedDB key-value wrapper with localStorage fallback. */
const DB = 'astralis'
const STORE = 'favorites'
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function dbAll(): Promise<Favorite[]> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      r.onsuccess = () => resolve(r.result as Favorite[])
      r.onerror = () => reject(r.error)
    })
  } catch {
    try {
      return JSON.parse(localStorage.getItem('astralis-favorites') ?? '[]')
    } catch {
      return []
    }
  }
}
async function dbPut(f: Favorite) {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(f)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    const all = (await dbAll()).filter((x) => x.id !== f.id)
    localStorage.setItem('astralis-favorites', JSON.stringify([...all, f]))
  }
}
async function dbDelete(id: string) {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    const all = (await dbAll()).filter((x) => x.id !== id)
    localStorage.setItem('astralis-favorites', JSON.stringify(all))
  }
}

interface FavState {
  items: Favorite[]
  loaded: boolean
  load: () => Promise<void>
  toggle: (id: string) => Promise<boolean>
  remove: (id: string) => Promise<void>
  has: (id: string) => boolean
}

function syncRetention(items: Favorite[]) {
  retain('favorites', items.filter((f) => f.sourceType !== 'real').map((f) => f.id))
}

export const useFavorites = create<FavState>((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    const items = (await dbAll()).sort((a, b) => b.savedAt - a.savedAt)
    syncRetention(items)
    set({ items, loaded: true })
  },
  has: (id) => get().items.some((f) => f.id === id),
  toggle: async (id) => {
    if (get().has(id)) {
      await get().remove(id)
      return false
    }
    const o = registry.resolve(id)
    if (!o) return false
    const q = rigQuat()
    const cam = new THREE.Vector3(0, 0, 1).applyQuaternion(q).multiplyScalar(rig.distance)
    const fav: Favorite = {
      id,
      name: o.name,
      type: o.type,
      sourceType: o.sourceType,
      seed: o.seed,
      cameraDistance: rig.distance,
      cameraQuat: [q.x, q.y, q.z, q.w],
      cameraOffset: [cam.x, cam.y, cam.z],
      savedAt: Date.now(),
    }
    await dbPut(fav)
    const items = [fav, ...get().items]
    syncRetention(items)
    set({ items })
    return true
  },
  remove: async (id) => {
    await dbDelete(id)
    const items = get().items.filter((f) => f.id !== id)
    syncRetention(items)
    set({ items })
  },
}))

/** Revisit a favorite: procedural objects are regenerated from the seed encoded in their ID. */
export function openFavorite(f: Favorite) {
  const o = registry.resolve(f.id)
  if (!o) return
  const q = new THREE.Quaternion(...f.cameraQuat)
  return travelTo(f.id, { distance: f.cameraDistance, quat: q })
}
