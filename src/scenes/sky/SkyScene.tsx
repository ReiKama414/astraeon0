import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { registry, type SceneRef } from '../../core/registry/CelestialRegistry'
import type { CelestialObject } from '../../core/registry/types'
import { sphericalToCartesian, zUpToThree } from '../../core/coords/UniverseCoordinateSystem'
import { BackgroundSky } from '../common/BackgroundSky'
import { CelestialMarker } from '../common/CelestialMarker'
import { GlowLine } from '../common/GlowLine'
import { useApp } from '../../store/useAppStore'
import { useQuality } from '../useQuality'
import { signalSceneReady, travelTo } from '../../core/navigation/Navigator'
import { rig } from '../common/cameraRig'
import { useRegistryVersion } from '../useRegistry'
import { SKY, starIdByHip, bvToColor } from '../../core/data/stars'

const SPHERE_R = 1000
const dirOf = (raDeg: number, decDeg: number) => new THREE.Vector3(...zUpToThree(sphericalToCartesian(raDeg, decDeg, 1)))

/** Distance (ly) for catalogue stars that have a curated distance; undefined keeps them on the sphere. */
function distanceForHip(hip: number): number | undefined {
  const id = starIdByHip.get(hip)
  return id ? registry.get(id)?.physical.distanceLy : undefined
}
function place(dir: THREE.Vector3, ly: number | undefined, depth: number, out = new THREE.Vector3()) {
  const R = ly ? THREE.MathUtils.lerp(SPHERE_R, ly, depth) : SPHERE_R
  return out.copy(dir).multiplyScalar(R)
}
export function skyPos(o: CelestialObject, depth: number, out: THREE.Vector3) {
  const p = o.position
  if (p.kind !== 'equatorial') return out.set(0, 0, 0)
  return place(dirOf(p.raDeg, p.decDeg), o.type === 'star' ? o.physical.distanceLy : undefined, depth, out)
}

const starVert = /* glsl */ `
attribute vec3 aColor;
attribute float aMag;
attribute float aKnown;
uniform float uPixelRatio;
uniform float uFov;
uniform float uDepth;
uniform float uTime;
varying vec3 vColor;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  float zoom = clamp(50.0/uFov, 0.7, 2.6);
  float s = clamp(13.0 - aMag*2.1, 1.6, 24.0) * zoom;
  gl_PointSize = s * uPixelRatio;
  float h = fract(sin(dot(position.xy, vec2(12.9898,78.233)))*43758.5453);
  float twinkle = 0.86 + 0.14*sin(uTime*(1.1 + h*2.3) + h*50.0);
  vColor = aColor * clamp(1.9 - aMag*0.3, 0.22, 2.4) * twinkle;
  vA = mix(1.0, 0.25 + 0.75*aKnown, uDepth);
}
`
const starFrag = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float r = length(c);
  float a = (exp(-r*r*55.0)*1.5 + exp(-r*8.0)*0.28) * vA;
  a += (exp(-abs(c.x)*80.0)*exp(-abs(c.y)*9.0) + exp(-abs(c.y)*80.0)*exp(-abs(c.x)*9.0)) * 0.14 * vA;
  if(a < 0.004) discard;
  gl_FragColor = vec4(vColor*a, 1.0);
}
`

interface CatalogueStar {
  dir: THREE.Vector3
  ly?: number
  mag: number
  color: THREE.Color
}

export function SkyScene({ scene }: { scene: SceneRef }) {
  const q = useQuality()
  const showLines = useApp((s) => s.showConstellationLines)
  const showNames = useApp((s) => s.showStarNames)
  const selectedId = useApp((s) => s.selectedId)
  const version = useRegistryVersion()

  // full catalogue (Hipparcos to V=6) + any Gaia stars streamed into the registry
  const catalogue = useMemo<CatalogueStar[]>(() => {
    const out: CatalogueStar[] = SKY.stars.map(([hip, ra, dec, mag, bv]) => ({ dir: dirOf(ra, dec), ly: distanceForHip(hip), mag, color: new THREE.Color(bvToColor(bv)) }))
    for (const o of registry.byType('star')) {
      if (!o.id.startsWith('gaia-') || o.position.kind !== 'equatorial') continue
      out.push({ dir: dirOf(o.position.raDeg, o.position.decDeg), ly: o.physical.distanceLy, mag: o.visual.magnitude ?? 8, color: new THREE.Color(o.visual.starColor ?? '#ffffff') })
    }
    return out
  }, [version])

  const { geo, mat } = useMemo(() => {
    const n = catalogue.length
    const col = new Float32Array(n * 3)
    const mag = new Float32Array(n)
    const known = new Float32Array(n)
    catalogue.forEach((s, i) => {
      col.set([s.color.r, s.color.g, s.color.b], i * 3)
      mag[i] = s.mag
      known[i] = s.ly ? 1 : 0
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1))
    geo.setAttribute('aKnown', new THREE.BufferAttribute(known, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    const mat = new THREE.ShaderMaterial({ vertexShader: starVert, fragmentShader: starFrag, uniforms: { uPixelRatio: { value: 1 }, uFov: { value: 50 }, uDepth: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    return { geo, mat }
  }, [catalogue])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])

  // constellation figures: every edge is its own feathered segment; vertices snap to catalogue stars for 3D mode
  const constellations = useMemo(() => registry.childrenOf('celestial-sphere').filter((c) => c.type === 'constellation'), [version])
  const vertexLy = useMemo(() => {
    const m = new Map<string, number | undefined>()
    for (const c of constellations)
      for (const pl of c.constellation?.polylines ?? [])
        for (const [ra, dec] of pl) {
          const key = `${ra},${dec}`
          if (m.has(key)) continue
          let best: number | undefined
          let bd = 0.12
          for (const [hip, sra, sdec] of SKY.stars) {
            if (Math.abs(sdec - dec) > bd) continue
            const dd = Math.hypot((((sra - ra + 540) % 360) - 180) * Math.cos((dec * Math.PI) / 180), sdec - dec)
            if (dd < bd) {
              bd = dd
              best = distanceForHip(hip)
            }
          }
          m.set(key, best)
        }
    return m
  }, [constellations])

  const depth = useApp((s) => s.skyDepth)
  const depthQ = Math.round(depth * 25) / 25
  const segmentsFor = (c: CelestialObject) => {
    const segs: THREE.Vector3[][] = []
    for (const pl of c.constellation?.polylines ?? [])
      for (let i = 0; i < pl.length - 1; i++) {
        const [a, b] = [pl[i], pl[i + 1]]
        const pa = place(dirOf(a[0], a[1]), vertexLy.get(`${a[0]},${a[1]}`), depthQ)
        const pb = place(dirOf(b[0], b[1]), vertexLy.get(`${b[0]},${b[1]}`), depthQ)
        segs.push([pa, pa.clone().lerp(pb, 0.5), pb])
      }
    return segs
  }
  const allSegments = useMemo(() => constellations.flatMap(segmentsFor), [constellations, vertexLy, depthQ])
  const selectedCon = useMemo(() => {
    const o = registry.get(selectedId)
    if (!o) return null
    if (o.type === 'constellation' && o.constellation) return o
    const parent = registry.get(o.parentId)
    return parent?.type === 'constellation' && parent.constellation ? parent : null
  }, [selectedId])
  const selectedSegments = useMemo(() => (selectedCon ? segmentsFor(selectedCon) : null), [selectedCon, vertexLy, depthQ])

  const depthRef = useRef(-1)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ gl }) => {
    const d = useApp.getState().skyDepth
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    mat.uniforms.uFov.value = useApp.getState().fov
    mat.uniforms.uDepth.value = d
    mat.uniforms.uTime.value = performance.now() / 1000
    if (d !== depthRef.current || geo.userData.built !== true) {
      depthRef.current = d
      geo.userData.built = true
      const pa = geo.getAttribute('position') as THREE.BufferAttribute
      catalogue.forEach((s, i) => {
        place(s.dir, s.ly, d, v)
        pa.setXYZ(i, v.x, v.y, v.z)
      })
      pa.needsUpdate = true
    }
  })

  useEffect(() => {
    const t = setTimeout(() => signalSceneReady(scene.id), 150)
    return () => clearTimeout(t)
  }, [scene.id])

  // true-3D mode pulls the camera out of the Sun/Earth position so the depth structure becomes visible
  const was3D = useRef(false)
  useEffect(() => {
    rig.maxDistance = 3200
    const is3D = depth > 0.02
    if (is3D && !was3D.current) {
      rig.travel = null
      rig.followId = null
      rig.panOffset.set(0, 0, 0)
      rig.target.set(0, 0, 0)
      rig.distance = 1500
      rig.pitch = -0.35
      rig.lastInput = performance.now()
    } else if (!is3D && was3D.current) {
      travelTo('celestial-sphere')
    }
    was3D.current = is3D
  }, [depth])
  useEffect(() => () => useApp.getState().set({ skyDepth: 0 }), [])

  const namedStars = useMemo(() => registry.byType('star').filter((s) => s.position.kind === 'equatorial' && !s.id.startsWith('gaia-') && (s.visual.magnitude ?? 9) < 4.2), [version])
  const dsos = useMemo(() => registry.all().filter((o) => o.position.kind === 'equatorial' && (o.type === 'nebula' || o.type === 'star-cluster' || o.type === 'galaxy') && (registry.sceneFor(o.id).id === scene.id || o.visual.hostsScene)), [version, scene.id])
  const selectedParent = selectedCon?.id

  return (
    <group>
      <BackgroundSky frame="equatorial" band starCount={Math.floor(q.backgroundStars * 0.6)} intensity={0.9} starScale={0.8} />
      <points geometry={geo} material={mat} renderOrder={5} />
      {showLines && <GlowLine paths={allSegments} mode="segments" color="#9fb2ff" width={2.2} opacity={selectedCon ? 0.16 : 0.3} renderOrder={4} />}
      {selectedSegments && <GlowLine key={selectedCon!.id} paths={selectedSegments} mode="segments" color="#f0dcb4" width={3.2} opacity={0.85} renderOrder={4} />}
      {namedStars.map((s) => {
        const inSelected = !!selectedParent && s.parentId === selectedParent
        const showLabel = showNames && ((s.visual.magnitude ?? 5) < 1.6 || inSelected || s.id === selectedId)
        return <CelestialMarker key={s.id} obj={s} pickRadius={10} label={showLabel} labelMaxDistance={1e6} labelClass="is-star" onFrame={(g) => skyPos(s, depthRef.current < 0 ? 0 : depthRef.current, g.position)} />
      })}
      {constellations.map((c) => (
        <CelestialMarker key={c.id} obj={c} pickRadius={34} labelMaxDistance={1e6} labelClass="is-constellation" onFrame={(g) => constellationCenter(c, depthRef.current, g.position)} />
      ))}
      {dsos.map((d) => (
        <CelestialMarker key={d.id} obj={d} pickRadius={9} label={!!d.nameZh && !d.nameZh.startsWith('梅西耶')} labelMaxDistance={1e6} labelClass="is-dso" onFrame={(g) => skyPos(d, 0, g.position).multiplyScalar(0.995)} />
      ))}
    </group>
  )
}

function constellationCenter(c: CelestialObject, depth: number, out: THREE.Vector3) {
  const p = c.position
  if (p.kind !== 'equatorial') return out
  out.copy(dirOf(p.raDeg, p.decDeg)).multiplyScalar(SPHERE_R * 0.99)
  if (depth > 0.02) out.multiplyScalar(THREE.MathUtils.lerp(1, 0.4, depth))
  return out
}
