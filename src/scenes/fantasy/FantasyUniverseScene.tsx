import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { registry, type SceneRef } from '../../core/registry/CelestialRegistry'
import { chunkGalaxySeeds, chunkNebulaSeed, generateGalaxy, generateNebula, FANTASY_CHUNK_SIZE } from '../../core/procedural/generator'
import { galaxyOrientation, positionInScene } from '../../core/coords/SceneScaleManager'
import { retain, release } from '../../core/registry/SceneStreamingManager'
import { GalaxyRenderer } from '../galaxy/GalaxyRenderer'
import { CelestialMarker } from '../common/CelestialMarker'
import { DreamSky } from '../common/DreamSky'
import { NebulaRenderer } from '../nebula/NebulaScene'
import { rig } from '../common/cameraRig'
import { useQuality } from '../useQuality'
import { signalSceneReady } from '../../core/navigation/Navigator'
import type { CelestialObject } from '../../core/registry/types'

const LOAD_RADIUS = 2
const KEEP_RADIUS = 3

/**
 * Infinite fictional sector. Space is divided into chunks; only chunks around the camera target
 * are generated (seed-deterministic) and registered, distant chunks are released.
 */
export function FantasyUniverseScene({ scene }: { scene: SceneRef }) {
  const q = useQuality()
  const [chunks, setChunks] = useState<Map<string, CelestialObject[]>>(new Map())

  useEffect(() => {
    signalSceneReady(scene.id)
    return () => {
      release('fantasy-chunks')
    }
  }, [scene.id])

  const lastCheck = useMemo(() => ({ t: 0, key: '' }), [])
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastCheck.t < 0.4) return
    lastCheck.t = clock.elapsedTime
    const cx = Math.floor(rig.target.x / FANTASY_CHUNK_SIZE)
    const cz = Math.floor(rig.target.z / FANTASY_CHUNK_SIZE)
    const key = `${cx},${cz}`
    if (key === lastCheck.key) return
    lastCheck.key = key
    setChunks((prev) => {
      const next = new Map<string, CelestialObject[]>()
      prev.forEach((objs, k) => {
        const [x, z] = k.split(',').map(Number)
        if (Math.abs(x - cx) <= KEEP_RADIUS && Math.abs(z - cz) <= KEEP_RADIUS) next.set(k, objs)
      })
      for (let x = cx - LOAD_RADIUS; x <= cx + LOAD_RADIUS; x++)
        for (let z = cz - LOAD_RADIUS; z <= cz + LOAD_RADIUS; z++) {
          const k = `${x},${z}`
          if (next.has(k)) continue
          const neb = chunkNebulaSeed(x, 0, z)
          next.set(k, [...chunkGalaxySeeds(x, 0, z).map((s) => generateGalaxy(s)), ...(neb !== null ? [generateNebula(neb)] : [])])
        }
      const all = [...next.values()].flat()
      registry.upsert(all)
      retain('fantasy-chunks', all.map((o) => o.id))
      return next
    })
  })

  const streamed = useMemo(() => [...chunks.values()].flat(), [chunks])
  // objects discovered via seeds outside the loaded grid (favorites, "Discover New World")
  const extra = registry.childrenOf('fantasy-universe').filter((g) => !streamed.some((x) => x.id === g.id))
  const all = [...streamed, ...extra]
  const list = all.filter((o) => o.visual.galaxy)
  const nebulae = all.filter((o) => o.visual.nebula)

  return (
    <group>
      <DreamSky palette={['#9f8cff', '#ff8fc8', '#7fe8e0']} seed={7} starCount={Math.floor(q.backgroundStars * 0.6)} />
      {nebulae.map((n) => (
        <CelestialMarker key={n.id} obj={n} position={positionInScene(n, scene)} pickRadius={110} labelMaxDistance={2400} labelMinDistance={90}>
          <group scale={1.5} rotation={[0.62, 0.3, 0.08]}>
            <NebulaRenderer visual={n.visual.nebula!} sprites={Math.floor(q.nebulaSprites * 0.22)} />
          </group>
        </CelestialMarker>
      ))}
      {list.map((g) => (
        <CelestialMarker key={g.id} obj={g} position={positionInScene(g, scene)} pickRadius={g.visual.galaxy!.radiusKpc * 3.2} labelMaxDistance={2200} labelMinDistance={g.visual.galaxy!.radiusKpc * 4}>
          <group quaternion={galaxyOrientation(g)}>
            <GalaxyRenderer galaxy={g.visual.galaxy!} unitsPerKpc={3} stars={Math.floor(q.farGalaxyStars * 1.1)} haze={600} starSize={0.34} intensity={1.15} nearFade={g.visual.galaxy!.radiusKpc} />
          </group>
        </CelestialMarker>
      ))}
    </group>
  )
}
