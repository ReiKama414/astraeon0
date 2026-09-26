import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { CelestialObject } from '../../core/registry/types'
import { liveObjects } from './cameraRig'
import { useApp } from '../../store/useAppStore'
import { travelTo } from '../../core/navigation/Navigator'
import { registerLabel, unregisterLabel } from './labels'
import { isMobile } from '../../core/quality'

const pickMat = new THREE.MeshBasicMaterial({ visible: false })
const pickGeo = new THREE.SphereGeometry(1, 12, 8)

export function selectObject(id: string) {
  useApp.getState().set({ selectedId: id, infoOpen: !isMobile() })
}

interface Props {
  obj: CelestialObject
  position?: THREE.Vector3 | [number, number, number]
  quaternion?: THREE.Quaternion
  pickRadius: number
  /** label hidden beyond this camera distance */
  labelMaxDistance?: number
  labelMinDistance?: number
  label?: boolean
  labelClass?: string
  onFrame?: (g: THREE.Group, dt: number) => void
  children?: ReactNode
}

/**
 * Wraps any rendered celestial body: registers its live Object3D for camera tracking,
 * provides picking (click = select, double-click = travel) and a distance-aware label.
 */
export function CelestialMarker({ obj, position, quaternion, pickRadius, labelMaxDistance = Infinity, labelMinDistance = 0, label = true, labelClass = '', onFrame, children }: Props) {
  const group = useRef<THREE.Group>(null)

  useEffect(() => {
    const g = group.current
    if (!g) return
    liveObjects.set(obj.id, g)
    return () => {
      if (liveObjects.get(obj.id) === g) liveObjects.delete(obj.id)
    }
  }, [obj.id])

  useEffect(() => {
    const g = group.current
    if (!g || !label) return
    registerLabel(obj.id, { obj, object: g, className: labelClass, maxDistance: labelMaxDistance, minDistance: labelMinDistance })
    return () => unregisterLabel(obj.id, g)
  }, [obj, label, labelClass, labelMaxDistance, labelMinDistance])

  useFrame((_, dt) => {
    const g = group.current
    if (g && onFrame) onFrame(g, dt)
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    selectObject(obj.id)
  }
  const onDouble = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    travelTo(obj.id)
  }
  const pos = Array.isArray(position) ? position : position ? ([position.x, position.y, position.z] as [number, number, number]) : undefined

  return (
    <group ref={group} position={pos} quaternion={quaternion}>
      {children}
      <mesh
        geometry={pickGeo}
        material={pickMat}
        scale={pickRadius}
        onClick={onClick}
        onDoubleClick={onDouble}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          useApp.getState().set({ hoveredId: obj.id })
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
          if (useApp.getState().hoveredId === obj.id) useApp.getState().set({ hoveredId: null })
        }}
      />
    </group>
  )
}
