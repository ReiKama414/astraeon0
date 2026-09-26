import * as THREE from 'three'

/**
 * Non-React camera state shared by CameraController (input + per-frame update),
 * the Navigator (auto travel / scene transitions) and the postprocessing warp effect.
 */
export interface TravelState {
  fromTarget: THREE.Vector3
  fromDist: number
  fromQuat: THREE.Quaternion
  toId: string | null
  toTarget: THREE.Vector3
  toDist: number
  toQuat: THREE.Quaternion
  t: number
  duration: number
  hop: number
  onDone?: () => void
}

export const liveObjects = new Map<string, THREE.Object3D>()

export const rig = {
  target: new THREE.Vector3(),
  panOffset: new THREE.Vector3(),
  distance: 260,
  yaw: 0.6,
  pitch: -0.45,
  yawVel: 0,
  pitchVel: 0,
  zoomVel: 0,
  followId: null as string | null,
  minDistance: 1,
  maxDistance: 1e5,
  travel: null as TravelState | null,
  warp: 0,
  fade: 0,
  flight: false,
  flightVel: new THREE.Vector3(),
  /** accumulated zoom intent beyond limits (for zoom-driven scene transitions) */
  zoomPressure: 0,
  lastInput: 0,
  autoRotate: 0,
  quat: new THREE.Quaternion(),
}

const euler = new THREE.Euler(0, 0, 0, 'YXZ')
export function rigQuat(yaw = rig.yaw, pitch = rig.pitch, out = new THREE.Quaternion()) {
  euler.set(pitch, yaw, 0, 'YXZ')
  return out.setFromEuler(euler)
}
export function setYawPitchFromQuat(q: THREE.Quaternion) {
  euler.setFromQuaternion(q, 'YXZ')
  rig.yaw = euler.y
  rig.pitch = euler.x
}

const tmp = new THREE.Vector3()
export function objectWorldPosition(id: string, out: THREE.Vector3): boolean {
  const o = liveObjects.get(id)
  if (!o) return false
  o.getWorldPosition(out)
  return true
}

export function cameraPositionFor(target: THREE.Vector3, dist: number, q: THREE.Quaternion, out = new THREE.Vector3()) {
  return out.copy(tmp.set(0, 0, 1).applyQuaternion(q).multiplyScalar(dist)).add(target)
}

export function cancelTravel() {
  if (rig.travel) {
    rig.travel = null
  }
}
