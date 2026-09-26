import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { registry, type SceneRef } from '../../core/registry/CelestialRegistry'
import { positionInScene } from '../../core/coords/SceneScaleManager'
import { GalaxyRenderer } from './GalaxyRenderer'
import { CelestialMarker } from '../common/CelestialMarker'
import { BackgroundSky } from '../common/BackgroundSky'
import { GlowPoint } from '../common/GlowPoint'
import { useQuality } from '../useQuality'
import { signalSceneReady } from '../../core/navigation/Navigator'
import { useRegistryVersion } from '../useRegistry'
import { SYSTEMS_PER_GALAXY, generateBlackHole, generateSystem } from '../../core/procedural/generator'
import type { CelestialObject } from '../../core/registry/types'
import { retain, release } from '../../core/registry/SceneStreamingManager'

const NEBULA_TINT: Record<string, string> = { m42: '#ff8fb0', m1: '#8fd0ff', m16: '#ffd08a', 'carina-nebula': '#ff9d7a' }

function Jet({ length = 60 }: { length?: number }) {
  const { geo, mat } = useMemo(() => {
    const n = 6000
    const p = new Float32Array(n * 3)
    let s = 3
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) {
      const t = Math.pow(r(), 0.7)
      const w = 0.25 + t * 1.6
      const knot = 1 + 0.6 * Math.max(0, Math.sin(t * 40))
      p.set([(r() - 0.5) * w * knot, t * length, (r() - 0.5) * w * knot], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
    const mat = new THREE.PointsMaterial({ size: 0.35, color: '#8fb6ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
    return { geo, mat }
  }, [length])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  return <points geometry={geo} material={mat} rotation={[0.25, 0, 0.35]} />
}

export function GalaxyScene({ scene }: { scene: SceneRef }) {
  const q = useQuality()
  useRegistryVersion()
  const host = registry.get(scene.hostId)!
  const g = host.visual.galaxy!
  const isMW = host.id === 'milky-way'
  const fantasy = host.sourceType === 'fantasy'

  // Fantasy galaxies: generate their star systems (seeded) while this scene is active, release on exit.
  useEffect(() => {
    if (!fantasy || !host.seed) return
    const objs: CelestialObject[] = [generateBlackHole(host.seed, host)]
    for (let i = 0; i < SYSTEMS_PER_GALAXY; i++) objs.push(...generateSystem(host.seed, i, host))
    registry.upsert(objs)
    const holder = `galaxy-scene:${host.id}`
    retain(holder, objs.map((o) => o.id))
    return () => release(holder)
  }, [fantasy, host])

  const children = registry.childrenOf(host.id).filter((c) => c.type !== 'star' && c.type !== 'constellation')
  const onReady = useMemo(() => () => signalSceneReady(scene.id), [scene.id])

  return (
    <group>
      <BackgroundSky band={false} starCount={Math.floor(q.backgroundStars * 0.4)} intensity={0.7} starScale={0.8} />
      <group rotation={[0, 0, 0]}>
        <GalaxyRenderer galaxy={g} unitsPerKpc={10} stars={q.galaxyStars} haze={q.galaxyHaze} starSize={g.morphology === 'elliptical' ? 0.14 : 0.1} intensity={g.morphology === 'elliptical' ? 0.8 : 1} onReady={onReady} nearFade={2.5} />
      </group>
      {host.id === 'm87' && <Jet length={g.radiusKpc * 10 * 0.6} />}
      {children.map((c) => {
        const pos = positionInScene(c, scene)
        if (c.type === 'star-system') {
          const nearSun = c.sourceType === 'real' && c.id !== 'sol'
          return (
            <CelestialMarker key={c.id} obj={c} position={pos} pickRadius={nearSun ? 0.25 : c.id === 'sol' ? 1.2 : 1.6} labelMaxDistance={c.id === 'sol' ? 1200 : nearSun ? 6 : 140} labelMinDistance={0.05}>
              <GlowPoint color={c.visual.color ?? '#ffe6b0'} size={c.id === 'sol' ? 0.5 : 0.8} minPx={c.id === 'sol' ? 7 : nearSun ? 3 : 4} intensity={c.id === 'sol' ? 1.6 : 1} spikes={c.id === 'sol' ? 0.6 : 0} />
            </CelestialMarker>
          )
        }
        if (c.type === 'nebula') {
          return (
            <CelestialMarker key={c.id} obj={c} position={pos} pickRadius={0.9} labelMaxDistance={160}>
              <GlowPoint color={NEBULA_TINT[c.id] ?? '#ff9fc0'} size={1.4} minPx={5} intensity={0.9} />
            </CelestialMarker>
          )
        }
        if (c.type === 'black-hole') {
          return (
            <CelestialMarker key={c.id} obj={c} position={pos} pickRadius={1.5} labelMaxDistance={900}>
              <GlowPoint color="#ffd7a8" size={0.6} minPx={3} intensity={0.6} />
            </CelestialMarker>
          )
        }
        return null
      })}
      {isMW && <SolarNeighborhoodRing />}
    </group>
  )
}

/** Faint ring marking the Sun's galactic orbit radius (8.178 kpc) for orientation. */
function SolarNeighborhoodRing() {
  const { geo, mat } = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * 81.78, 0.2, Math.sin(a) * 81.78))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color: '#a9b8ff', transparent: true, opacity: 0.07, depthWrite: false })
    return { geo, mat }
  }, [])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  useFrame(({ camera }) => {
    mat.opacity = THREE.MathUtils.clamp(camera.position.length() / 3000, 0.02, 0.08)
  })
  return <lineLoop geometry={geo} material={mat} />
}
