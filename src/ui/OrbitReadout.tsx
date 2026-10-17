import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useApp } from '../store/useAppStore'
import { registry } from '../core/registry/CelestialRegistry'
import { rig } from '../scenes/common/cameraRig'
import { sceneRadius } from '../core/coords/SceneScaleManager'
import { poleQuaternion, spinAngle } from '../scenes/solar/bodyMath'
import { simClock } from '../core/time/SimulationClock'
import { displayName } from './i18n'

interface Reading {
  name: string
  altKm: number
  lat: number
  lon: number
}

const Y = new THREE.Vector3(0, 1, 0)

/** Altitude above the followed body and the sub-camera latitude/longitude (body-fixed, IAU frame). */
export function OrbitReadout() {
  const lang = useApp((s) => s.lang)
  const sceneId = useApp((s) => s.sceneId)
  const [r, setR] = useState<Reading | null>(null)
  useEffect(() => {
    const id = setInterval(() => {
      const scene = registry.sceneById(sceneId)
      const o = rig.followId ? registry.get(rig.followId) : undefined
      if (scene.kind !== 'system' || !o?.visual.planet || !o.physical.radiusKm) return setR(null)
      const R = sceneRadius(o, scene)
      if (rig.distance > R * 6) return setR(null)
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.quat)
      const bodyQ = poleQuaternion(o.visual.planet).multiply(new THREE.Quaternion().setFromAxisAngle(Y, spinAngle(o.visual.planet, simClock.jd)))
      const local = dir.applyQuaternion(bodyQ.invert())
      const lat = (Math.asin(THREE.MathUtils.clamp(local.y, -1, 1)) * 180) / Math.PI
      const lon = (Math.atan2(-local.z, local.x) * 180) / Math.PI
      setR({ name: displayName(o, lang), altKm: ((rig.distance - R) / R) * o.physical.radiusKm, lat, lon })
    }, 200)
    return () => clearInterval(id)
  }, [sceneId, lang])
  if (!r) return null
  const f = (x: number, pos: string, neg: string) => `${Math.abs(x).toFixed(2)}° ${x >= 0 ? pos : neg}`
  return (
    <div className="content-in pointer-events-none absolute bottom-[96px] right-6 hidden text-right md:block">
      <div className="eyebrow">{lang === 'zh' ? `${r.name}．軌道` : `${r.name} · orbit`}</div>
      <div className="mt-1 font-display font-semibold text-[26px] tabular-nums leading-none text-ink/90">
        {r.altKm < 10000 ? Math.round(r.altKm).toLocaleString() : `${(r.altKm / 1000).toFixed(1)}k`}
        <span className="ml-1 font-sans text-[12px] text-muted">km</span>
      </div>
      <div className="mt-1 font-mono text-[11px] tabular-nums text-muted">
        {f(r.lat, 'N', 'S')} · {f(r.lon, 'E', 'W')}
      </div>
    </div>
  )
}
