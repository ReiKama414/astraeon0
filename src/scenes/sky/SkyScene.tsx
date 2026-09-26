import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { registry, type SceneRef } from '../../core/registry/CelestialRegistry'
import type { CelestialObject } from '../../core/registry/types'
import { sphericalToCartesian, zUpToThree } from '../../core/coords/UniverseCoordinateSystem'
import { BackgroundSky } from '../common/BackgroundSky'
import { CelestialMarker } from '../common/CelestialMarker'
import { useApp } from '../../store/useAppStore'
import { useQuality } from '../useQuality'
import { signalSceneReady, travelTo } from '../../core/navigation/Navigator'
import { rig } from '../common/cameraRig'
import { useRegistryVersion } from '../useRegistry'

const SPHERE_R = 1000
const LY_UNITS = 1 // true-3D mode: 1 unit = 1 light-year

function skyDir(o: CelestialObject) {
  const p = o.position
  if (p.kind !== 'equatorial') return new THREE.Vector3()
  return new THREE.Vector3(...zUpToThree(sphericalToCartesian(p.raDeg, p.decDeg, 1)))
}

/** Position on the celestial sphere (depth 0) or at its true distance (depth 1). */
function skyPos(o: CelestialObject, depth: number, out: THREE.Vector3) {
  const d = skyDir(o)
  const ly = o.physical.distanceLy
  const R = ly ? THREE.MathUtils.lerp(SPHERE_R, ly * LY_UNITS, depth) : SPHERE_R
  return out.copy(d).multiplyScalar(R)
}

const starVert = /* glsl */ `
attribute vec3 aColor;
attribute float aMag;
attribute float aKnown;
uniform float uPixelRatio;
uniform float uFov;
uniform float uDepth;
varying vec3 vColor;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  float s = clamp(15.0 - aMag*3.2, 3.0, 26.0) * clamp(50.0/uFov, 0.7, 2.2);
  gl_PointSize = s * uPixelRatio;
  vColor = aColor * clamp(2.2 - aMag*0.45, 0.35, 2.6);
  vA = mix(1.0, 0.25 + 0.75*aKnown, uDepth);
}
`
const starFrag = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float r = length(c);
  float a = (exp(-r*r*45.0)*1.6 + exp(-r*7.0)*0.3) * vA;
  a += (exp(-abs(c.x)*80.0)*exp(-abs(c.y)*8.0) + exp(-abs(c.y)*80.0)*exp(-abs(c.x)*8.0))*0.18*vA;
  gl_FragColor = vec4(vColor*a, 1.0);
}
`

export function SkyScene({ scene }: { scene: SceneRef }) {
  const q = useQuality()
  const showLines = useApp((s) => s.showConstellationLines)
  const showNames = useApp((s) => s.showStarNames)
  const constellations = registry.childrenOf('celestial-sphere').filter((c) => c.type === 'constellation')
  const version = useRegistryVersion()
  const stars = useMemo(() => registry.byType('star').filter((s) => s.position.kind === 'equatorial' && registry.sceneFor(s.id).id === scene.id), [scene.id, version])
  const index = useMemo(() => new Map(stars.map((s, i) => [s.id, i])), [stars])

  const { geo, mat, lineGeo, lineMat, segs } = useMemo(() => {
    const pos = new Float32Array(stars.length * 3)
    const col = new Float32Array(stars.length * 3)
    const mag = new Float32Array(stars.length)
    const known = new Float32Array(stars.length)
    const v = new THREE.Vector3()
    stars.forEach((s, i) => {
      skyPos(s, 0, v)
      pos.set([v.x, v.y, v.z], i * 3)
      const c = new THREE.Color(s.visual.starColor ?? '#ffffff')
      col.set([c.r, c.g, c.b], i * 3)
      mag[i] = s.visual.magnitude ?? 3
      known[i] = s.physical.distanceLy ? 1 : 0
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1))
    geo.setAttribute('aKnown', new THREE.BufferAttribute(known, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    const mat = new THREE.ShaderMaterial({ vertexShader: starVert, fragmentShader: starFrag, uniforms: { uPixelRatio: { value: 1 }, uFov: { value: 50 }, uDepth: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    const segs: [number, number][] = []
    constellations.forEach((c) => c.constellation?.lines.forEach(([a, b]) => {
      const ia = index.get(a), ib = index.get(b)
      if (ia !== undefined && ib !== undefined) segs.push([ia, ib])
    }))
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs.length * 6), 3))
    lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    const lineMat = new THREE.LineBasicMaterial({ color: '#9fb4ff', transparent: true, opacity: 0.32, depthWrite: false })
    return { geo, mat, lineGeo, lineMat, segs }
  }, [stars, constellations, index])
  useEffect(() => () => (geo.dispose(), mat.dispose(), lineGeo.dispose(), lineMat.dispose()), [geo, mat, lineGeo, lineMat])

  const depthRef = useRef(-1)
  const pa0 = useRef<THREE.BufferGeometry | null>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ gl }) => {
    const depth = useApp.getState().skyDepth
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    mat.uniforms.uFov.value = useApp.getState().fov
    mat.uniforms.uDepth.value = depth
    if (depth !== depthRef.current || pa0.current !== geo) {
      pa0.current = geo
      depthRef.current = depth
      const pa = geo.getAttribute('position') as THREE.BufferAttribute
      stars.forEach((s, i) => {
        skyPos(s, depth, v)
        pa.setXYZ(i, v.x, v.y, v.z)
      })
      pa.needsUpdate = true
      const la = lineGeo.getAttribute('position') as THREE.BufferAttribute
      segs.forEach(([a, b], k) => {
        la.setXYZ(k * 2, pa.getX(a), pa.getY(a), pa.getZ(a))
        la.setXYZ(k * 2 + 1, pa.getX(b), pa.getY(b), pa.getZ(b))
      })
      la.needsUpdate = true
    }
  })

  useEffect(() => {
    const t = setTimeout(() => signalSceneReady(scene.id), 150)
    return () => clearTimeout(t)
  }, [scene.id])

  // entering true-3D mode pulls the camera out of the Sun/Earth position so the depth structure becomes visible
  const depth = useApp((s) => s.skyDepth)
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

  return (
    <group>
      <BackgroundSky frame="equatorial" band starCount={q.backgroundStars} intensity={0.9} />
      <points geometry={geo} material={mat} renderOrder={5} />
      {showLines && <lineSegments geometry={lineGeo} material={lineMat} renderOrder={4} />}
      {stars.filter((s) => !s.id.startsWith('gaia-')).map((s) => (
        <CelestialMarker key={s.id} obj={s} pickRadius={14} label={showNames && (s.visual.magnitude ?? 5) < 3.4} labelMaxDistance={1e6} labelClass="is-star" onFrame={(g) => skyPos(s, depthRef.current < 0 ? 0 : depthRef.current, g.position)} />
      ))}
      {constellations.map((c) => (
        <ConstellationLabel key={c.id} obj={c} />
      ))}
    </group>
  )
}

function ConstellationLabel({ obj }: { obj: CelestialObject }) {
  const members = registry.childrenOf(obj.id).filter((s) => s.type === 'star')
  const onFrame = (g: THREE.Group) => {
    const depth = useApp.getState().skyDepth
    const acc = new THREE.Vector3()
    const t = new THREE.Vector3()
    members.forEach((m) => acc.add(skyPos(m, depth, t)))
    if (members.length) g.position.copy(acc.divideScalar(members.length))
    if (depth < 0.01) g.position.setLength(SPHERE_R * 0.98)
  }
  return <CelestialMarker obj={obj} pickRadius={30} labelMaxDistance={1e6} labelClass="is-constellation" onFrame={onFrame} />
}
