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
import { DreamSky } from '../common/DreamSky'
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
import { GlowLine } from '../common/GlowLine'

function OrbitLine({ obj, hostId }: { obj: CelestialObject; hostId: string; parentRadius?: number }) {
  const showOrbits = useApp((s) => s.showOrbits)
  const selected = useApp((s) => s.selectedId === obj.id || s.hoveredId === obj.id)
  const pts = useMemo(() => {
    const p = obj.position
    if (p.kind !== 'orbit') return null
    const parent = registry.get(obj.parentId)
    const isMoon = parent && parent.id !== hostId && parent.type !== 'star-system'
    let out: THREE.Vector3[]
    if (isMoon) {
      const d = presentationMoonDistance(parent!, p.orbit.a)
      if (p.orbit.plane === 'parent-equator') {
        const q = poleQuaternion(parent!.visual.planet)
        const dirSign = (p.orbit.periodDays ?? 1) < 0 ? -1 : 1
        out = Array.from({ length: 160 }, (_, i) => {
          const a = (i / 160) * Math.PI * 2 * dirSign
          return new THREE.Vector3(Math.cos(a) * d, 0, -Math.sin(a) * d).applyQuaternion(q)
        })
      } else {
        // real (inclined / retrograde) orbital plane, radius compressed to presentation distance
        out = sampleOrbit(p.orbit, simClock.jd, 160).map((v) => new THREE.Vector3(...zUpToThree(v)).normalize().multiplyScalar(d))
        out.pop()
      }
    } else {
      const s = systemAUScale(hostId)
      out = sampleOrbit(p.orbit, simClock.jd, obj.type === 'comet' ? 720 : 360).map((v) => new THREE.Vector3(...zUpToThree(v)).multiplyScalar(s))
      out.pop()
    }
    return out
  }, [obj, hostId])
  const paths = useMemo(() => (pts ? [pts] : []), [pts])
  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  if (!pts || !showOrbits) return null
  const real = obj.sourceType === 'real'
  const color = !real ? '#e6b8d9' : obj.type === 'comet' ? '#a9dcff' : obj.type === 'moon' ? '#c9d2ee' : obj.type === 'dwarf-planet' || obj.type === 'asteroid' ? '#c8bde6' : '#d9dcf2'
  // head = index of the orbit sample nearest to the body's current position
  const head = () => {
    relativePosition(obj, hostId, simClock.jd, tmpPos)
    let best = 0
    let bd = Infinity
    for (let i = 0; i < pts.length; i++) {
      const d = pts[i].distanceToSquared(tmpPos)
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best / pts.length
  }
  const fade = () => {
    const base = selected ? 2.2 : 1
    // moon orbits only matter around the planet being inspected
    if (obj.type === 'moon') return useApp.getState().focusId === obj.parentId || useApp.getState().focusId === obj.id ? base : 0.25 * base
    // quieter orbits while inspecting a body up close
    return base * THREE.MathUtils.clamp((rig.distance - 3) / 30, 0.08, 1)
  }
  return <GlowLine paths={paths} mode="trail" color={color} width={obj.type === 'moon' ? 2.2 : 3} opacity={obj.type === 'moon' ? 0.2 : 0.34} trailLength={obj.type === 'comet' ? 9 : obj.type === 'moon' ? 7 : 4.5} head={head} fade={fade} />
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
      {host.sourceType === 'real' ? <BackgroundSky frame="ecliptic" band starCount={q.backgroundStars} intensity={1} /> : <DreamSky palette={['#9f8cff', '#ff9fd0', '#8fe8e0']} seed={host.seed ?? 3} starCount={q.backgroundStars} />}
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

