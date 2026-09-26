import * as THREE from 'three'
import gsap from 'gsap'
import { registry, type SceneRef } from '../registry/CelestialRegistry'
import { SCALES, positionInScene, sceneRadius } from '../coords/SceneScaleManager'
import { useApp } from '../../store/useAppStore'
import { rig, rigQuat, objectWorldPosition, setYawPitchFromQuat, type TravelState } from '../../scenes/common/cameraRig'
import { simClock } from '../time/SimulationClock'
import type { CelestialObject } from '../registry/types'
import { isMobile } from '../quality'

/**
 * Navigator — orchestrates auto travel, quick jumps and cinematic cross-scale transitions.
 * In-scene travel is integrated per frame by CameraController (so it can track moving targets);
 * cross-scene jumps mask the change of reference frame with a warp/fade.
 */

let readyResolvers: { id: string; resolve: () => void }[] = []
const readyScenes = new Set<string>()
export function signalSceneReady(sceneId: string) {
  readyScenes.add(sceneId)
  readyResolvers = readyResolvers.filter((r) => {
    if (r.id === sceneId) {
      r.resolve()
      return false
    }
    return true
  })
}
export function clearSceneReady(sceneId: string) {
  readyScenes.delete(sceneId)
}
function waitSceneReady(sceneId: string, timeout = 4000) {
  if (readyScenes.has(sceneId)) return Promise.resolve()
  return new Promise<void>((resolve) => {
    readyResolvers.push({ id: sceneId, resolve })
    setTimeout(resolve, timeout)
  })
}

const FOCUS_MULT: Partial<Record<string, number>> = {
  planet: 3.4, 'dwarf-planet': 3.6, moon: 3.6, exoplanet: 3.8, 'fantasy-planet': 3.6, star: 4.2, galaxy: 3.2, nebula: 3.2, 'black-hole': 7, comet: 30, 'star-system': 4, 'galaxy-group': 3, 'asteroid-belt': 1,
}

export function focusDistanceFor(o: CelestialObject, scene: SceneRef): number {
  if (o.id === scene.hostId) return SCALES[scene.kind].defaultDistance
  if (o.id === 'asteroid-belt') return 520
  if (scene.kind === 'sky') return Math.max(0.01, currentPosition(o.id, scene).length())
  const r = sceneRadius(o, scene)
  const rings = o.visual.planet?.rings ? Math.max(1, o.visual.planet.rings.outer * 0.8) : 1
  // portrait screens have a narrow horizontal field of view: back off so the subject fits
  const aspect = typeof window !== 'undefined' ? window.innerWidth / Math.max(1, window.innerHeight) : 1.6
  const portrait = aspect < 1 ? Math.pow(1 / aspect, rings > 1 ? 0.95 : 0.6) : 1
  return r * (o.visual.focusDistance ?? FOCUS_MULT[o.type] ?? 4) * rings * portrait
}

export function minDistanceFor(o: CelestialObject | undefined, scene: SceneRef): number {
  const base = SCALES[scene.kind].minDistance
  if (!o || o.id === scene.hostId) return base
  if (scene.kind === 'system') return Math.max(sceneRadius(o, scene) * 1.05, 0.05)
  if (scene.kind === 'sky') return base
  return Math.max(base * 0.2, sceneRadius(o, scene) * 0.5)
}

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()

/** Where the object currently is in the active scene. */
export function currentPosition(id: string, scene: SceneRef, out = new THREE.Vector3()) {
  if (objectWorldPosition(id, out)) return out
  const o = registry.get(id)
  if (!o) return out.set(0, 0, 0)
  return positionInScene(o, scene, simClock.jd, out)
}

/** A pleasant viewing orientation: from the lit side for planets, gently elevated otherwise. */
export function viewQuatFor(o: CelestialObject, scene: SceneRef, target: THREE.Vector3): THREE.Quaternion {
  const s = SCALES[scene.kind]
  if (o.visual.blackHole && scene.kind === 'black-hole') {
    // view the disk at the catalogued inclination (angle between line of sight and disk normal)
    return rigQuat(rig.yaw + 0.4, -((90 - o.visual.blackHole.diskInclinationDeg) * Math.PI) / 180)
  }
  if (o.id === scene.hostId) return rigQuat(rig.yaw, -(s.defaultElevationDeg * Math.PI) / 180)
  if (scene.kind === 'system' && target.lengthSq() > 1e-6) {
    const toSun = tmpA.copy(target).negate().normalize()
    toSun.applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.05)
    toSun.y += 0.28
    toSun.normalize()
    return rigQuat(Math.atan2(toSun.x, toSun.z), -Math.asin(THREE.MathUtils.clamp(toSun.y, -1, 1)))
  }
  if (scene.kind === 'sky') {
    const d = tmpA.copy(target).normalize()
    // look outward at the constellation from the center of the sphere
    return rigQuat(Math.atan2(-d.x, -d.z), Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)))
  }
  const elev = o.type === 'galaxy' ? 0.5 : o.type === 'black-hole' ? 0.12 : 0.3
  return rigQuat(rig.yaw + 0.3, -elev)
}

function activeScene(): SceneRef {
  return registry.sceneById(useApp.getState().sceneId)
}

function startInSceneTravel(id: string | null, toTarget: THREE.Vector3, toDist: number, toQuat: THREE.Quaternion, durationScale = 1): Promise<void> {
  return new Promise((resolve) => {
    const fromTarget = rig.target.clone().add(rig.panOffset)
    rig.panOffset.set(0, 0, 0)
    const separation = fromTarget.distanceTo(toTarget)
    const ratio = Math.max(rig.distance, toDist) / Math.max(1e-3, Math.min(rig.distance, toDist))
    const sepRel = separation / Math.max(rig.distance, toDist)
    const duration = THREE.MathUtils.clamp(1.4 + 0.55 * Math.log10(ratio) + 0.5 * Math.log10(1 + sepRel), 1.6, 5.5) * durationScale
    const t: TravelState = {
      fromTarget,
      fromDist: rig.distance,
      fromQuat: rigQuat(),
      toId: id,
      toTarget: toTarget.clone(),
      toDist,
      toQuat,
      t: 0,
      duration,
      hop: Math.min(3, sepRel * 0.35),
      onDone: resolve,
    }
    rig.followId = id
    rig.zoomPressure = 0
    rig.travel = t
  })
}

let transitionToken = 0

/** Fly to any celestial object, switching scale/scene with a cinematic warp when needed. */
export async function travelTo(id: string, opts: { quick?: boolean; distance?: number; quat?: THREE.Quaternion } = {}): Promise<void> {
  const o = registry.resolve(id)
  if (!o) return
  const app = useApp.getState()
  const dest = registry.sceneFor(id)
  const token = ++transitionToken
  app.set({ selectedId: id, focusId: id, infoOpen: !isMobile() })
  if (dest.id === app.sceneId) {
    if (rig.warp > 0 || rig.fade > 0) gsap.to(rig, { warp: 0, fade: 0, duration: 0.8, ease: 'power2.out' })
    app.set({ transitioning: false })
    const target = currentPosition(id, dest, new THREE.Vector3())
    const dist = opts.distance ?? focusDistanceFor(o, dest)
    rig.minDistance = minDistanceFor(o, dest)
    const q = opts.quat ?? viewQuatFor(o, dest, target)
    if (opts.quick) {
      jumpCamera(id, target, dist, q)
      return
    }
    return startInSceneTravel(id, target, dist, q)
  }
  // --- cross-scene transition ---
  const cur = activeScene()
  app.set({ transitioning: true })
  // 1. If the destination scene's host is visible in the current scene, head toward it first.
  const portal = findPortal(dest, cur)
  const outTl = gsap.timeline()
  if (portal && !opts.quick) {
    const pObj = registry.get(portal)!
    const pPos = currentPosition(portal, cur, new THREE.Vector3())
    rig.minDistance = 0.001
    const approach = startInSceneTravel(portal, pPos, sceneRadius(pObj, cur) * 1.6, viewQuatFor(pObj, cur, pPos), 0.7)
    outTl.to(rig, { warp: 0.55, duration: 1.2, ease: 'power2.in', delay: 0.5 })
    await approach
    if (token !== transitionToken) return
    await gsap.to(rig, { warp: 1, fade: 0.55, distance: rig.distance * 0.35, duration: 0.55, ease: 'power3.in' })
  } else {
    rig.travel = null
    await gsap.to(rig, { warp: 1, fade: 0.6, distance: rig.distance * (opts.quick ? 1.5 : 3.5), duration: opts.quick ? 0.45 : 1.1, ease: 'power2.in' })
  }
  if (token !== transitionToken) return
  // 2. Swap scene at warp peak.
  rig.travel = null
  rig.followId = null
  rig.panOffset.set(0, 0, 0)
  clearSceneReady(dest.id)
  useApp.getState().set({ sceneId: dest.id, hoveredId: null })
  await waitSceneReady(dest.id)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  if (token !== transitionToken) return
  const scale = SCALES[dest.kind]
  const target = currentPosition(id, dest, new THREE.Vector3())
  const finalDist = opts.distance ?? focusDistanceFor(o, dest)
  const q = opts.quat ?? viewQuatFor(o, dest, target)
  rig.maxDistance = scale.maxDistance
  rig.minDistance = minDistanceFor(o, dest)
  rig.target.copy(target)
  rig.followId = id
  const arrivalDist = dest.kind === 'sky' ? finalDist : Math.min(scale.maxDistance * 0.9, finalDist * (dest.kind === 'system' && o.id !== dest.hostId ? 14 : 5))
  rig.distance = arrivalDist
  setYawPitchFromQuat(q)
  // 3. Fly in while the warp decays.
  gsap.to(rig, { warp: 0, fade: 0, duration: 1.6, ease: 'power2.out' })
  await startInSceneTravel(id, target, finalDist, q, 0.85)
  if (token === transitionToken) useApp.getState().set({ transitioning: false })
}

/** Instant (but still smooth, very short) repositioning used by favorites & quick jump. */
export function jumpCamera(id: string | null, target: THREE.Vector3, dist: number, q: THREE.Quaternion) {
  rig.travel = null
  rig.followId = id
  rig.panOffset.set(0, 0, 0)
  rig.target.copy(target)
  rig.distance = dist
  setYawPitchFromQuat(q)
  rig.yawVel = rig.pitchVel = rig.zoomVel = 0
}

/** The object in `cur` that acts as a doorway into `dest` (e.g. Milky Way galaxy inside the universe view). */
function findPortal(dest: SceneRef, cur: SceneRef): string | null {
  // walk dest host ancestors; the first one that is shown in the current scene is the portal
  for (const a of registry.ancestors(dest.hostId)) {
    if (a.id === cur.hostId) return null
    const ps = registry.parentSceneFor(a.id)
    if (ps.id === cur.id) return a.id
  }
  return null
}

/** Enter the scene hosted by an object (zoom-driven or via UI). */
export function enter(id: string) {
  return travelTo(id)
}

/** Go up one level in the scale hierarchy, arriving at the current host. */
export async function goUp() {
  const app = useApp.getState()
  const cur = activeScene()
  if (cur.id === 'universe') {
    resetView()
    return
  }
  const host = registry.get(cur.hostId)
  if (!host) return
  const parent = registry.parentSceneFor(host.id)
  const token = ++transitionToken
  app.set({ transitioning: true })
  rig.travel = null
  await gsap.to(rig, { warp: 1, fade: 0.55, distance: Math.min(rig.maxDistance, rig.distance * 2.2), duration: 0.9, ease: 'power2.in' })
  if (token !== transitionToken) return
  clearSceneReady(parent.id)
  useApp.getState().set({ sceneId: parent.id, selectedId: host.id, focusId: host.id, hoveredId: null })
  await waitSceneReady(parent.id)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  if (token !== transitionToken) return
  const target = currentPosition(host.id, parent, new THREE.Vector3())
  const scale = SCALES[parent.kind]
  const r = sceneRadius(host, parent)
  rig.maxDistance = scale.maxDistance
  rig.minDistance = minDistanceFor(host, parent)
  rig.target.copy(target)
  rig.followId = host.id
  rig.distance = r * 0.9
  const q = viewQuatFor(host, parent, target)
  setYawPitchFromQuat(q)
  gsap.to(rig, { warp: 0, fade: 0, duration: 1.4, ease: 'power2.out' })
  await startInSceneTravel(host.id, target, focusDistanceFor(host, parent) * 1.6, q, 0.8)
  if (token === transitionToken) useApp.getState().set({ transitioning: false })
}

export function resetView() {
  const app = useApp.getState()
  const cur = activeScene()
  const host = registry.get(cur.hostId)
  if (!host) return
  app.set({ focusId: host.id })
  rig.minDistance = SCALES[cur.kind].minDistance
  return startInSceneTravel(host.id, tmpB.set(0, 0, 0).clone(), SCALES[cur.kind].defaultDistance, rigQuat(rig.yaw, -(SCALES[cur.kind].defaultElevationDeg * Math.PI) / 180))
}

export function returnToUniverse() {
  return travelTo('universe')
}

export function cancelAllTravel() {
  transitionToken++
  rig.travel = null
  gsap.killTweensOf(rig)
  gsap.to(rig, { warp: 0, fade: 0, duration: 0.6 })
  useApp.getState().set({ transitioning: false })
}
