import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { CelestialObject } from '../../core/registry/types'
import { earthFrag, earthVert, cloudFrag } from './planetShaders'
import { poleQuaternion, spinAngle } from './bodyMath'
import { sphereGeo } from './shared'
import { simClock } from '../../core/time/SimulationClock'
import { useQuality } from '../useQuality'
import { bakePlanet, type BakedPlanet } from './TextureBaker'
import { useNearLOD } from './Planet'
import { loadRemoteTexture, EARTH_TEXTURES } from '../../core/assets/RemoteTextures'

interface EarthTex {
  day: THREE.Texture
  night: THREE.Texture
  brc: THREE.Texture
}

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
blank.needsUpdate = true

/** Rasterise Natural Earth land polygons (world-atlas, public domain) into an equirectangular mask. */
async function buildLandMask(): Promise<THREE.Texture> {
  const [{ feature }, geo, land] = await Promise.all([import('topojson-client'), import('d3-geo'), import('world-atlas/land-110m.json')])
  const topo = (land as unknown as { default: unknown }).default ?? land
  const fc = feature(topo as never, (topo as { objects: { land: never } }).objects.land)
  const W = 2048, H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const proj = geo.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2])
  const path = geo.geoPath(proj, ctx)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  path(fc as never)
  ctx.fill()
  ctx.filter = 'blur(3px)'
  ctx.drawImage(canvas, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

let earthPromise: Promise<EarthTex> | null = null
function loadEarth(maxSize: number): Promise<EarthTex> {
  if (!earthPromise) {
    earthPromise = Promise.all([
      loadRemoteTexture(EARTH_TEXTURES.day, { srgb: true, maxWidth: maxSize }),
      loadRemoteTexture(EARTH_TEXTURES.night, { srgb: true, maxWidth: maxSize }),
      loadRemoteTexture(EARTH_TEXTURES.bumpRoughClouds, { srgb: false, maxWidth: maxSize }),
    ]).then(([day, night, brc]) => ({ day, night, brc }))
    earthPromise.catch(() => {
      earthPromise = null
    })
  }
  return earthPromise
}

/**
 * Earth: real imagery (Solar System Scope / NASA-derived maps) with day–night terminator,
 * city lights, ocean glint, cloud layer with shadows and atmospheric scattering.
 * Falls back to a procedurally baked Earth using Natural Earth coastlines when offline.
 */
export function EarthSurface({ obj, radius, sunPos, centerRef }: { obj: CelestialObject; radius: number; sunPos: THREE.Vector3; centerRef: React.RefObject<THREE.Object3D | null> }) {
  const v = obj.visual.planet!
  const q = useQuality()
  const { gl } = useThree()
  const tilt = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Mesh>(null)
  const near = useNearLOD(tilt, radius, 60, 90)
  const [tex, setTex] = useState<EarthTex | null>(null)
  const [fallback, setFallback] = useState<BakedPlanet | null>(null)

  useEffect(() => {
    let alive = true
    loadEarth(q.textureSize >= 4096 ? 4096 : q.textureSize >= 2048 ? 4096 : 2048)
      .then((t) => alive && setTex(t))
      .catch(async () => {
        if (!alive) return
        const mask = await buildLandMask().catch(() => null)
        if (!alive) return
        setFallback(bakePlanet(gl, { ...v, surface: 'earth', clouds: { opacity: 0.9 } }, Math.min(2048, q.textureSize), mask))
      })
    return () => {
      alive = false
    }
  }, [gl, v, q.textureSize])
  useEffect(() => () => fallback?.dispose(), [fallback])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: earthFrag,
        uniforms: {
          uDay: { value: blank },
          uNight: { value: blank },
          uBRC: { value: blank },
          uHasTextures: { value: 0 },
          uFallbackAlbedo: { value: blank },
          uFallbackData: { value: blank },
          uFallbackClouds: { value: blank },
          uSunWorld: { value: new THREE.Vector3() },
          uCenter: { value: new THREE.Vector3() },
          uCloudShift: { value: 0 },
          uTexel: { value: new THREE.Vector2(1 / 4096, 1 / 2048) },
        },
      }),
    [],
  )
  const cloudMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: cloudFrag,
        uniforms: { uClouds: { value: blank }, uChannel: { value: 2 }, uSunWorld: { value: new THREE.Vector3() }, uOpacity: { value: 0.95 }, uTint: { value: new THREE.Color('#ffffff') }, uShift: { value: 0 } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => (mat.dispose(), cloudMat.dispose()), [mat, cloudMat])

  useEffect(() => {
    const u = mat.uniforms
    if (tex) {
      u.uDay.value = tex.day
      u.uNight.value = tex.night
      u.uBRC.value = tex.brc
      u.uHasTextures.value = 1
      const img = tex.brc.image as { width: number; height: number }
      u.uTexel.value.set(1 / (img?.width || 4096), 1 / (img?.height || 2048))
      cloudMat.uniforms.uClouds.value = tex.brc
      cloudMat.uniforms.uChannel.value = 2
    } else if (fallback) {
      u.uFallbackAlbedo.value = fallback.albedo
      u.uFallbackData.value = fallback.data
      u.uFallbackClouds.value = fallback.clouds ?? blank
      u.uHasTextures.value = 0
      u.uTexel.value.set(2 / 2048, 2 / 1024)
      cloudMat.uniforms.uClouds.value = fallback.clouds ?? blank
      cloudMat.uniforms.uChannel.value = 0
    }
  }, [tex, fallback, mat, cloudMat])

  const pole = useMemo(() => poleQuaternion(v), [v])
  useFrame(() => {
    if (spin.current) spin.current.rotation.y = spinAngle(v, simClock.jd)
    mat.uniforms.uSunWorld.value.copy(sunPos)
    centerRef.current?.getWorldPosition(mat.uniforms.uCenter.value)
    const shift = (simClock.anim * 0.0008) % 1
    mat.uniforms.uCloudShift.value = shift
    cloudMat.uniforms.uSunWorld.value.copy(sunPos)
    cloudMat.uniforms.uShift.value = shift
  })
  const segs = near ? Math.max(96, q.sphereSegments) : 64
  const ready = !!tex || !!fallback
  return (
    <group ref={tilt} quaternion={pole}>
      <mesh ref={spin} geometry={sphereGeo(segs)} material={mat} scale={radius} visible={ready}>
        <mesh geometry={sphereGeo(segs)} material={cloudMat} scale={1.009} renderOrder={3} visible={ready} />
      </mesh>
      {!ready && (
        <mesh geometry={sphereGeo(48)} scale={radius}>
          <meshStandardMaterial color="#1d3f73" roughness={0.6} />
        </mesh>
      )}
    </group>
  )
}
