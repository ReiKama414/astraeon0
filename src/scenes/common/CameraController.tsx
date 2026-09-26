import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rig, rigQuat, setYawPitchFromQuat, cameraPositionFor } from './cameraRig'
import { useApp } from '../../store/useAppStore'
import { registry } from '../../core/registry/CelestialRegistry'
import { SCALES } from '../../core/coords/SceneScaleManager'
import { currentPosition, enter, goUp } from '../../core/navigation/Navigator'

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const tmpTarget = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const right = new THREE.Vector3()
const up = new THREE.Vector3()
const fwd = new THREE.Vector3()
const keys = new Set<string>()

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

function cancelTravelByUser() {
  const app = useApp.getState()
  if (app.transitioning || !rig.travel) return
  const done = rig.travel.onDone
  // keep the current in-between pose
  rig.travel = null
  done?.()
}

/**
 * CameraController — orbit / pan / zoom / free-flight, quaternion-based travel integration,
 * inertia, collision-free zoom limits and zoom-driven scale transitions.
 */
export function CameraController() {
  const { camera, gl } = useThree()
  const sceneId = useApp((s) => s.sceneId)
  const fov = useApp((s) => s.fov)

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = fov
    cam.updateProjectionMatrix()
  }, [fov, camera])

  useEffect(() => {
    const sc = SCALES[registry.sceneById(sceneId).kind]
    rig.maxDistance = sc.maxDistance
  }, [sceneId])

  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number; button: number }>()
    let moved = 0
    let pinchDist = 0
    let pinchMid = { x: 0, y: 0 }

    const isSky = () => registry.sceneById(useApp.getState().sceneId).kind === 'sky' && useApp.getState().skyDepth < 0.02

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button })
      moved = 0
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
        pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      }
    }
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 4) {
        cancelTravelByUser()
        rig.lastInput = performance.now()
      }
      if (useApp.getState().transitioning) {
        p.x = e.clientX
        p.y = e.clientY
        return
      }
      const h = el.clientHeight || 800
      if (pointers.size === 1) {
        const pan = p.button === 2 || p.button === 1 || e.shiftKey
        if (pan && !rig.flight) {
          const cam = camera as THREE.PerspectiveCamera
          const scale = (2 * rig.distance * Math.tan((cam.fov * Math.PI) / 360)) / h
          right.setFromMatrixColumn(cam.matrixWorld, 0)
          up.setFromMatrixColumn(cam.matrixWorld, 1)
          rig.panOffset.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale)
        } else {
          const k = (isSky() ? -1 : 1) * (rig.flight ? 1.4 : 3.2) / h
          rig.yawVel = -dx * k * 60
          rig.pitchVel = -dy * k * 60
          rig.yaw += -dx * k
          rig.pitch += -dy * k
        }
      } else if (pointers.size === 2) {
        p.x = e.clientX
        p.y = e.clientY
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        if (pinchDist > 0) {
          const f = pinchDist / d
          rig.distance *= f
          rig.zoomPressure += Math.log(f) * 3
        }
        const cam = camera as THREE.PerspectiveCamera
        const scale = (2 * rig.distance * Math.tan((cam.fov * Math.PI) / 360)) / h
        right.setFromMatrixColumn(cam.matrixWorld, 0)
        up.setFromMatrixColumn(cam.matrixWorld, 1)
        if (!isSky()) rig.panOffset.addScaledVector(right, -(mid.x - pinchMid.x) * scale).addScaledVector(up, (mid.y - pinchMid.y) * scale)
        pinchDist = d
        pinchMid = mid
        return
      }
      p.x = e.clientX
      p.y = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinchDist = 0
      if (pointers.size === 1) {
        const [only] = [...pointers.values()]
        only.x = only.x // keep position; nothing else
      }
    }
    const onWheel = (e: WheelEvent) => {
      const tgt = e.target as HTMLElement | null
      // the canvas, or a 3D label floating above it; HUD panels keep their own scrolling
      if (tgt !== el && !tgt?.closest?.('.astr-label')) return
      e.preventDefault()
      if (useApp.getState().transitioning) return
      cancelTravelByUser()
      rig.lastInput = performance.now()
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      if (isSky()) {
        useApp.getState().set({ fov: THREE.MathUtils.clamp(useApp.getState().fov * Math.exp(delta * 0.001), 12, 100) })
        return
      }
      rig.zoomVel += delta * 0.0022
      rig.zoomVel = THREE.MathUtils.clamp(rig.zoomVel, -3.5, 3.5)
      // scrolling against a zoom limit builds "intent" to change scale level
      if (delta < 0 && rig.distance <= rig.minDistance * 1.08) rig.zoomPressure -= 0.4
      if (delta > 0 && rig.distance >= rig.maxDistance * 0.97) rig.zoomPressure += 0.45
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      keys.add(e.key.toLowerCase())
      if (e.key === 'Escape') cancelTravelByUser()
    }
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    const onContext = (e: Event) => e.preventDefault()
    const onBlur = () => keys.clear()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    window.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      window.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [gl, camera])

  const viewShift = useRef(0)
  useFrame(({ size }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const app = useApp.getState()
    const scene = registry.sceneById(app.sceneId)
    const cam = camera as THREE.PerspectiveCamera
    rig.flight = app.flightMode

    const tr = rig.travel
    if (tr) {
      tr.t = Math.min(1, tr.t + dt / tr.duration)
      const e = smoother(tr.t)
      if (tr.toId) currentPosition(tr.toId, scene, tr.toTarget)
      rig.target.lerpVectors(tr.fromTarget, tr.toTarget, e)
      const logD = THREE.MathUtils.lerp(Math.log(tr.fromDist), Math.log(tr.toDist), e)
      rig.distance = Math.exp(logD) * (1 + tr.hop * Math.sin(Math.PI * e))
      tmpQ.slerpQuaternions(tr.fromQuat, tr.toQuat, e)
      setYawPitchFromQuat(tmpQ)
      rig.yawVel = rig.pitchVel = rig.zoomVel = 0
      if (tr.t >= 1) {
        rig.travel = null
        tr.onDone?.()
      }
    } else {
      if (rig.followId && !rig.flight) {
        if (currentPosition(rig.followId, scene, tmpTarget)) rig.target.copy(tmpTarget)
      }
      // inertia
      const damp = Math.exp(-dt * 7)
      if (!pointerHeld()) {
        rig.yaw += rig.yawVel * dt * 0.35
        rig.pitch += rig.pitchVel * dt * 0.35
      }
      rig.yawVel *= damp
      rig.pitchVel *= damp
      // idle auto-rotation (cinematic drift) unless user recently interacted
      if (!rig.flight && performance.now() - rig.lastInput > 12000 && scene.kind !== 'sky' && !app.photoMode) rig.yaw += dt * 0.012
      if (Math.abs(rig.zoomVel) > 1e-4) {
        const before = rig.distance
        rig.distance *= Math.exp(rig.zoomVel * dt * 4)
        const clamped = THREE.MathUtils.clamp(rig.distance, rig.minDistance, rig.maxDistance)
        if (clamped !== rig.distance) rig.zoomPressure += Math.sign(rig.zoomVel) * Math.abs(rig.zoomVel) * dt * 4
        rig.distance = clamped
        if (before === rig.distance && rig.zoomVel > 0 && rig.distance >= rig.maxDistance * 0.999) rig.zoomPressure += rig.zoomVel * dt
        rig.zoomVel *= Math.exp(-dt * 6)
      } else {
        rig.zoomPressure *= Math.exp(-dt * 2)
      }
      rig.distance = THREE.MathUtils.clamp(rig.distance, rig.minDistance, rig.maxDistance)
      // zoom-driven transitions between scales
      if (!app.transitioning && !app.tour.active && performance.now() - rig.lastInput < 1500) {
        if (rig.zoomPressure > 1.2 && rig.distance >= rig.maxDistance * 0.98 && scene.id !== 'universe') {
          rig.zoomPressure = 0
          goUp()
        } else if (rig.zoomPressure < -1.0 && rig.followId && rig.followId !== scene.hostId) {
          const f = registry.get(rig.followId)
          if (f?.visual.hostsScene && rig.distance <= rig.minDistance * 1.05) {
            rig.zoomPressure = 0
            enter(f.id)
          }
        }
      }
      // free flight
      if (rig.flight) {
        const sp = rig.distance * 1.2 * (keys.has('shift') ? 4 : 1)
        fwd.set(0, 0, -1).applyQuaternion(rigQuat(rig.yaw, rig.pitch, tmpQ))
        right.set(1, 0, 0).applyQuaternion(tmpQ)
        const acc = new THREE.Vector3()
        if (keys.has('w') || keys.has('arrowup')) acc.add(fwd)
        if (keys.has('s') || keys.has('arrowdown')) acc.sub(fwd)
        if (keys.has('d') || keys.has('arrowright')) acc.add(right)
        if (keys.has('a') || keys.has('arrowleft')) acc.sub(right)
        if (keys.has('e') || keys.has(' ')) acc.y += 1
        if (keys.has('q') || keys.has('c')) acc.y -= 1
        if (acc.lengthSq() > 0) {
          rig.followId = null
          rig.lastInput = performance.now()
        }
        rig.flightVel.lerp(acc.multiplyScalar(sp), 1 - Math.exp(-dt * 4))
        rig.target.addScaledVector(rig.flightVel, dt)
      }
    }
    rig.pitch = THREE.MathUtils.clamp(rig.pitch, -1.53, 1.53)
    const q = rigQuat(rig.yaw, rig.pitch, rig.quat)
    const target = tmpTarget.copy(rig.target).add(rig.panOffset)
    cameraPositionFor(target, rig.distance, q, cam.position)
    cam.quaternion.copy(q)
    // depth range follows the viewing distance to keep precision where it matters
    const sc = SCALES[scene.kind]
    const near = THREE.MathUtils.clamp(rig.distance * 0.004, sc.near * 0.1, sc.near * 50)
    if (Math.abs(cam.near - near) / near > 0.05 || cam.far !== sc.far) {
      cam.near = near
      cam.far = sc.far
      cam.updateProjectionMatrix()
    }
    // on narrow screens keep the subject above an expanded bottom sheet
    const { width: vw, height: vh } = size
    const wantShift = vw < 768 && app.selectedId && app.infoOpen && !app.photoMode ? vh * 0.2 : 0
    viewShift.current += (wantShift - viewShift.current) * (1 - Math.exp(-dt * 6))
    if (Math.abs(viewShift.current) > 0.5) cam.setViewOffset(vw, vh, 0, viewShift.current, vw, vh)
    else if (cam.view?.enabled) cam.clearViewOffset()
    cam.updateMatrixWorld()
  }, -10)

  return null
}

let held = 0
function pointerHeld() {
  return held > 0
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => held++)
  window.addEventListener('pointerup', () => (held = Math.max(0, held - 1)))
  window.addEventListener('pointercancel', () => (held = Math.max(0, held - 1)))
}
