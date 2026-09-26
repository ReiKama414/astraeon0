import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { CelestialObject } from '../../core/registry/types'
import { CelestialMarker } from '../common/CelestialMarker'
import { GlowPoint } from '../common/GlowPoint'
import { relativePosition } from './bodyMath'
import { simClock } from '../../core/time/SimulationClock'
import { AU_UNITS } from '../../core/coords/SceneScaleManager'
import { mulberry32 } from '../../core/procedural/rng'
import { sphereGeo } from './shared'

const tailVert = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform float uLen;
uniform float uCurve;
varying float vA;
void main(){
  float t = fract(aSeed.x + uTime*0.05);
  float x = t * uLen;
  float spread = 0.02 + t * uLen * 0.12;
  vec3 p = vec3(x, (aSeed.y-0.5)*spread, (aSeed.z-0.5)*spread + uCurve*t*t*uLen);
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(40.0/ -mv.z, 1.0, 8.0);
  vA = (1.0 - t) * smoothstep(0.0, 0.05, t);
}
`
const tailFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vA;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float a = exp(-dot(c,c)*14.0) * vA * uIntensity;
  gl_FragColor = vec4(uColor*a, 1.0);
}
`

function Tail({ color, curve, count }: { color: string; curve: number; count: number }) {
  const ref = useRef<THREE.Points>(null)
  const { geo, mat } = useMemo(() => {
    const r = mulberry32(count + (curve > 0 ? 7 : 3))
    const s = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i++) s[i] = r()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(s, 3))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)
    const mat = new THREE.ShaderMaterial({ vertexShader: tailVert, fragmentShader: tailFrag, uniforms: { uTime: { value: 0 }, uLen: { value: 0 }, uCurve: { value: curve }, uColor: { value: new THREE.Color(color) }, uIntensity: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    return { geo, mat }
  }, [color, curve, count])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  return <points ref={ref} geometry={geo} material={mat} userData={{ mat }} />
}

/** Comet: nucleus + coma + ion (straight, blue) and dust (curved, warm) tails pointing away from the Sun. */
export function Comet({ obj, hostId }: { obj: CelestialObject; hostId: string }) {
  const tails = useRef<THREE.Group>(null)
  const coma = useRef<THREE.Group>(null)
  const nucleusMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a4540', roughness: 1 }), [])
  useEffect(() => () => nucleusMat.dispose(), [nucleusMat])
  const onFrame = (g: THREE.Group) => {
    relativePosition(obj, hostId, simClock.jd, g.position)
    const rAU = g.position.length() / AU_UNITS
    const activity = THREE.MathUtils.clamp(1.8 / (rAU * rAU), 0, 1.5) * (1 - THREE.MathUtils.smoothstep(rAU, 3, 6))
    if (tails.current) {
      // +X of tail group points away from the Sun
      const away = g.position.clone().normalize()
      tails.current.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), away)
      tails.current.children.forEach((c, i) => {
        const m = (c.userData.mat as THREE.ShaderMaterial | undefined) ?? ((c as THREE.Points).material as THREE.ShaderMaterial)
        if (!m?.uniforms) return
        m.uniforms.uTime.value = simClock.anim
        m.uniforms.uLen.value = activity * (i === 0 ? 70 : 45)
        m.uniforms.uIntensity.value = Math.min(1, activity) * (i === 0 ? 0.9 : 0.7)
      })
    }
    if (coma.current) coma.current.visible = activity > 0.02
  }
  return (
    <CelestialMarker obj={obj} pickRadius={0.8} labelMaxDistance={4000} onFrame={onFrame}>
      <mesh geometry={sphereGeo(24)} material={nucleusMat} scale={0.12} />
      <group ref={coma}>
        <GlowPoint color="#cfe8ff" size={0.8} minPx={3} maxPx={60} intensity={0.9} />
      </group>
      <group ref={tails}>
        <Tail color="#7fb8ff" curve={0} count={2500} />
        <Tail color="#ffe0b0" curve={0.35} count={2500} />
      </group>
    </CelestialMarker>
  )
}
