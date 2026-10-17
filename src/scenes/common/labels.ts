import * as THREE from 'three'
import type { CelestialObject } from '../../core/registry/types'

/**
 * Label registry: markers register a label entry; a single DOM layer (LabelLayer) renders them and
 * the in-canvas LabelProjector writes screen transforms each frame (no per-label React roots).
 */
export interface LabelEntry {
  obj: CelestialObject
  object: THREE.Object3D
  className: string
  maxDistance: number
  minDistance: number
  el?: HTMLDivElement | null
}

export const labelEntries = new Map<string, LabelEntry>()
const listeners = new Set<() => void>()
let version = 0

export function registerLabel(key: string, e: LabelEntry) {
  labelEntries.set(key, e)
  version++
  listeners.forEach((l) => l())
}
export function unregisterLabel(key: string, object: THREE.Object3D) {
  if (labelEntries.get(key)?.object !== object) return
  labelEntries.delete(key)
  version++
  listeners.forEach((l) => l())
}
export function subscribeLabels(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export function labelsVersion() {
  return version
}

const v = new THREE.Vector3()
const camPos = new THREE.Vector3()

export function projectLabels(camera: THREE.Camera, width: number, height: number) {
  camera.getWorldPosition(camPos)
  labelEntries.forEach((e) => {
    const el = e.el
    if (!el) return
    e.object.getWorldPosition(v)
    const d = v.distanceTo(camPos)
    v.project(camera)
    const visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 && d < e.maxDistance && d > e.minDistance
    if (!visible) {
      if (el.style.opacity !== '0') {
        el.style.opacity = '0'
        el.style.filter = 'blur(3px)'
        el.style.pointerEvents = 'none'
      }
      return
    }
    const x = (v.x * 0.5 + 0.5) * width
    const y = (-v.y * 0.5 + 0.5) * height
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    if (el.style.opacity !== '1') {
      el.style.opacity = '1'
      el.style.filter = 'none'
      el.style.pointerEvents = 'auto'
    }
  })
}
