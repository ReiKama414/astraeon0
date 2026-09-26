import type { GalaxyVisual } from '../core/registry/types'
import type { GalaxyBuffers } from './galaxyGen'

/** Single shared worker + result cache (LRU) so revisited scenes don't regenerate. */
let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()
const cache = new Map<string, unknown>()
const MAX_CACHE = 10

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./galaxy.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.error) p.reject(e.data.error)
      else p.resolve(e.data.result)
    }
  }
  return worker
}

function call<T>(kind: string, args: unknown, key: string): Promise<T> {
  if (cache.has(key)) {
    const v = cache.get(key)
    cache.delete(key)
    cache.set(key, v)
    return Promise.resolve(v as T)
  }
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (v) => {
        cache.set(key, v)
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string)
        resolve(v as T)
      },
      reject,
    })
    getWorker().postMessage({ id, kind, args })
  })
}

export function requestGalaxy(g: GalaxyVisual, stars: number, haze: number, unitsPerKpc: number) {
  return call<GalaxyBuffers>('galaxy', { g, stars, haze, unitsPerKpc }, `g:${g.seed}:${stars}:${haze}:${unitsPerKpc}:${g.morphology}`)
}

export function requestCosmicWeb(count: number, seed: number, extent: number) {
  return call<{ position: Float32Array; color: Float32Array; size: Float32Array }>('cosmic-web', { count, seed, extent }, `w:${count}:${seed}:${extent}`)
}
