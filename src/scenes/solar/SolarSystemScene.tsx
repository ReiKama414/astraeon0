import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { registry, type SceneRef } from '../../core/registry/CelestialRegistry'
import type { CelestialObject } from '../../core/registry/types'
import { presentationRadius, systemAUScale, presentationMoonDistance } from '../../core/coords/SceneScaleManager'
import { sampleOrbit } from '../../core/orbits/kepler'
import { zUpToThree } from '../../core/coords/UniverseCoordinateSystem'
import { CelestialMarker } from '../common/CelestialMarker'
import { BackgroundSky } from '../common/BackgroundSky'
import { StarBody } from './Star'
import { PlanetSurface, Atmosphere } from './Planet'
import { EarthSurface } from './Earth'
import { relativePosition, poleQuaternion } from './bodyMath'
import { simClock } from '../../core/time/SimulationClock'
import { useApp } from '../../store/useAppStore'
import { useQuality } from '../useQuality'
import { signalSceneReady } from '../../core/navigation/Navigator'
import { useRegistryVersion } from '../useRegistry'
import { AsteroidBelt } from './AsteroidBelt'
import { rig } from '../common/cameraRig'
import { Comet } from './Comet'

function OrbitLine({ obj, hostId, parentRadius }: { obj: CelestialObject; hostId: string; parentRadius?: number }) {
  const showOrbits = useApp((s) => s.showOrbits)
  const selected = useApp((s) => s.selectedId === obj.id || s.hoveredId === obj.id)
  const { geo, mat } = useMemo(() => {
    const p = obj.position
    if (p.kind !== 'orbit') return { geo: null, mat: null }
    const parent = registry.get(obj.parentId)
    const isMoon = parent && parent.id !== hostId && parent.type !== 'star-system'
    let pts: THREE.Vector3[]
    if (isMoon) {
      const d = presentationMoonDistance(parent!, p.orbit.a)
      if (p.orbit.plane === 'parent-equator') {
        const q = poleQuaternion(parent!.visual.planet)
        pts = Array.from({ length: 129 }, (_, i) => {
          const a = (i / 128) * Math.PI * 2
          return new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d).applyQuaternion(q)
        })
      } else {
        // real (inclined / retrograde) orbital plane, radius compressed to presentation distance
        pts = sampleOrbit(p.orbit, simClock.jd, 128).map((v) => new THREE.Vector3(...zUpToThree(v)).normalize().multiplyScalar(d))
      }
    } else {
      const s = systemAUScale(hostId)
      pts = sampleOrbit(p.orbit, simClock.jd, obj.type === 'comet' ? 512 : 256).map((v) => new THREE.Vector3(...zUpToThree(v)).multiplyScalar(s))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const col = obj.sourceType === 'real' ? (obj.type === 'comet' ? '#8fd6ff' : obj.type === 'dwarf-planet' ? '#b0a6d8' : '#8fa4ff') : '#d89cff'
    const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false })
    return { geo, mat }
  }, [obj, hostId, parentRadius])
  useEffect(() => () => (geo?.dispose(), mat?.dispose()), [geo, mat])
  useFrame(({ camera }) => {
    if (!mat) return
    const target = selected ? 0.55 : obj.type === 'moon' ? 0.12 : 0.2
    // fade orbits that would clutter a close-up
    // fade orbits when inspecting a body up close
    const far = THREE.MathUtils.clamp((rig.distance - 4) / 40, 0.04, 1) * THREE.MathUtils.clamp(camera.position.length() / 60, 0.25, 1)
    mat.opacity += (target * (obj.type === 'moon' ? 1 : far) - mat.opacity) * 0.15
  })
  if (!geo || !mat || !showOrbits) return null
  return <lineLoop geometry={geo} material={mat} />
}

/** One orbiting body: positions itself every frame, renders surface + atmosphere + its moons. */
function Body({ obj, hostId, sunPos }: { obj: CelestialObject; hostId: string; sunPos: THREE.Vector3 }) {
  const center = useRef<THREE.Group>(null)
  const radius = presentationRadius(obj)
  const moons = registry.childrenOf(obj.id).filter((c) => c.position.kind === 'orbit' && c.visual.renderer === 'planet')
  const onFrame = (g: THREE.Group) => {
    relativePosition(obj, hostId, simClock.jd, g.position)
  }
  const v = obj.visual.planet
  return (
    <>
      <CelestialMarker obj={obj} pickRadius={Math.max(radius * 1.3, 0.35)} labelMaxDistance={obj.type === 'moon' ? radius * 120 : 6000} labelMinDistance={radius * 2.2} onFrame={onFrame}>
        <group ref={center}>
          {obj.visual.renderer === 'earth' ? <EarthSurface obj={obj} radius={radius} sunPos={sunPos} centerRef={center} /> : <PlanetSurface obj={obj} radius={radius} sunPos={sunPos} centerRef={center} />}
          {v?.atmosphere && <Atmosphere radius={radius} visual={v.atmosphere} sunPos={sunPos} centerRef={center} />}
        </group>
        {moons.map((m) => (
          <group key={m.id}>
            <OrbitLine obj={m} hostId={hostId} parentRadius={radius} />
            <Body obj={m} hostId={hostId} sunPos={sunPos} />
          </group>
        ))}
      </CelestialMarker>
    </>
  )
}

export function SolarSystemScene({ scene }: { scene: SceneRef }) {
  const q = useQuality()
  useRegistryVersion()
  const host = registry.get(scene.hostId)!
  const kids = registry.childrenOf(host.id)
  const stars = kids.filter((k) => k.visual.renderer === 'sun')
  const bodies = kids.filter((k) => k.visual.renderer === 'planet' || k.visual.renderer === 'earth')
  const belt = kids.find((k) => k.visual.renderer === 'asteroid-belt')
  const comets = kids.filter((k) => k.visual.renderer === 'comet')
  const sunPos = useMemo(() => new THREE.Vector3(), [])
  const primary = useRef<THREE.Group>(null)

  useEffect(() => {
    const t = setTimeout(() => signalSceneReady(scene.id), 250)
    return () => clearTimeout(t)
  }, [scene.id])

  useFrame(() => {
    primary.current?.getWorldPosition(sunPos)
  })

  return (
    <group>
      <BackgroundSky frame={host.sourceType === 'real' ? 'ecliptic' : 'galactic'} band starCount={q.backgroundStars} intensity={1} />
      <ambientLight intensity={0.018} color="#8fa0ff" />
      {stars.map((s, i) => {
        const r = presentationRadius(s)
        const binary = s.position.kind === 'orbit'
        return (
          <CelestialMarker key={s.id} obj={s} pickRadius={r * 1.1} labelMaxDistance={20000} labelMinDistance={r * 3} onFrame={binary ? (g) => relativePosition(s, host.id, simClock.jd, g.position) : undefined}>
            <group ref={i === 0 ? primary : undefined}>
              <StarBody obj={s} radius={binary ? r * 0.8 : r} />
            </group>
          </CelestialMarker>
        )
      })}
      {bodies.map((b) => (
        <group key={b.id}>
          <OrbitLine obj={b} hostId={host.id} />
          <Body obj={b} hostId={host.id} sunPos={sunPos} />
        </group>
      ))}
      {belt && <AsteroidBelt obj={belt} count={q.asteroidCount} />}
      {comets.map((c) => (
        <group key={c.id}>
          <OrbitLine obj={c} hostId={host.id} />
          <Comet obj={c} hostId={host.id} />
        </group>
      ))}
    </group>
  )
}

