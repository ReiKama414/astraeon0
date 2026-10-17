import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { CelestialObject } from '../../core/registry/types'
import { CelestialMarker } from '../common/CelestialMarker'
import { GlowPoint } from '../common/GlowPoint'
import { relativePosition } from './bodyMath'
import { simClock } from '../../core/time/SimulationClock'
import { AU_UNITS } from '../../core/coords/SceneScaleManager'
import { sphereGeo } from './shared'
import { NOISE } from '../../shaders/noise'

/**
 * Comet tail: a camera-facing ribbon along the anti-solar axis. The fragment shader draws
 * streaming, slowly twisting ion filaments (cyan → deep blue) or a broad curved dust fan (warm white).
 */
const tailVert = /* glsl */ `
uniform float uLen;
uniform float uWidth;
uniform float uCurve;
varying vec2 vUv;
void main(){
  vUv = uv;                       // x: 0 at nucleus → 1 at tail end, y: 0..1 across
  float t = uv.x;
  vec3 axisW = normalize((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 bendW = normalize((modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  vec3 originW = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 center = originW + axisW * t * uLen + bendW * uCurve * t * t * uLen;
  vec3 toCam = normalize(cameraPosition - center);
  vec3 side = normalize(cross(axisW, toCam));
  float w = uWidth * (0.04 + 0.96 * pow(t, 0.8));
  vec3 p = center + side * (uv.y - 0.5) * w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`
const tailFrag = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uIntensity;
uniform float uIon;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec2 vUv;
void main(){
  float t = vUv.x;                 // 0 at the head → 1 at the end of the tail
  float yn = (vUv.y - 0.5) * 2.0;  // -1..1 across the ribbon
  float along = pow(clamp(1.0 - t, 0.0, 1.0), 1.15) * smoothstep(0.0, 0.02, t);
  float body;
  if (uIon > 0.5) {
    // the whole bundle drifts and twists slowly, more so far from the head
    float warp = snoise(vec3(t * 1.8 - uTime * 0.03, 0.0, 3.1)) * 0.22 * t
               + snoise(vec3(t * 5.0 - uTime * 0.05, yn * 1.3, 7.0)) * 0.1 * t;
    float yy = yn + warp;
    // envelope: tight near the head, fanning out downstream
    float env = exp(-pow(yy / (0.22 + 0.78 * t), 2.0) * 2.0);
    // braided streamers: ridged noise stretched along the flow
    float s1 = pow(max(0.0, 1.0 - abs(snoise(vec3(t * 1.5 - uTime * 0.035, yy * 4.5, 1.0)))), 6.0);
    float s2 = pow(max(0.0, 1.0 - abs(snoise(vec3(t * 2.6 - uTime * 0.055, yy * 10.0, 4.0)))), 9.0);
    float wisps = fbm(vec3(t * 3.0 - uTime * 0.04, yy * 3.0, 9.0), 4) * 0.5 + 0.5;
    // smoky veils: domain-warped fbm drifting downstream
    float dw = fbm(vec3(t * 1.4 - uTime * 0.02, yy * 1.6, 12.0), 3);
    float smoke = smoothstep(0.35, 0.95, fbm(vec3(t * 2.2 - uTime * 0.04, yy * 2.4 + dw * 0.9, 5.0), 5) * 0.5 + 0.5);
    // bright spine right behind the coma
    float spine = exp(-pow(yy / (0.05 + 0.25 * t), 2.0)) * pow(clamp(1.0 - t, 0.0, 1.0), 3.0);
    body = env * (0.16 + 0.42 * s1 + 0.12 * s2 + 0.75 * smoke * t) * (0.55 + 0.7 * wisps) + spine * 1.3;
  } else {
    // dust tail: smooth, broad, softly striated fan
    float yy = yn + 0.15 * t;
    float stri = 0.75 + 0.25 * sin(yy * 18.0 + t * 6.0);
    body = exp(-pow(yy / (0.3 + 0.7 * t), 2.0) * 1.6) * stri * (0.7 + 0.3 * snoise(vec3(t * 3.0, yy * 2.0, 2.0)));
  }
  // colour: white-cyan at the head → sky blue → deep ultramarine
  vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.35, t));
  col = mix(col, uColorC, smoothstep(0.35, 1.0, t));
  float edge = 1.0 - smoothstep(0.78, 1.0, abs(yn));
  gl_FragColor = vec4(col * body * along * edge * uIntensity, 1.0);
}
`

function Tail({ ion, colorA, colorB, colorC, curve, register }: { ion: boolean; colorA: string; colorB: string; colorC: string; curve: number; register: (m: THREE.ShaderMaterial) => void }) {
  // PlaneGeometry uv: x along the tail, y across (vertices are positioned by the shader)
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1, 96, 2), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: tailVert,
        fragmentShader: tailFrag,
        uniforms: { uLen: { value: 0 }, uWidth: { value: 1 }, uCurve: { value: curve }, uTime: { value: 0 }, uIntensity: { value: 0 }, uIon: { value: ion ? 1 : 0 }, uColorA: { value: new THREE.Color(colorA) }, uColorB: { value: new THREE.Color(colorB) }, uColorC: { value: new THREE.Color(colorC) } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [ion, colorA, colorB, colorC, curve],
  )
  useEffect(() => register(mat), [mat, register])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />
}

/** Comet: nucleus, cyan coma, filamentary ion tail and curved dust tail pointing away from the Sun. */
export function Comet({ obj, hostId }: { obj: CelestialObject; hostId: string }) {
  const tails = useRef<THREE.Group>(null)
  const coma = useRef<THREE.Group>(null)
  const mats = useRef<THREE.ShaderMaterial[]>([])
  const register = useMemo(
    () => (m: THREE.ShaderMaterial) => {
      if (!mats.current.includes(m)) mats.current.push(m)
    },
    [],
  )
  const nucleusMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3632', roughness: 1 }), [])
  useEffect(() => () => nucleusMat.dispose(), [nucleusMat])
  const onFrame = (g: THREE.Group) => {
    relativePosition(obj, hostId, simClock.jd, g.position)
    const rAU = g.position.length() / AU_UNITS
    // outgassing switches on inside ~5 AU and strengthens toward perihelion
    const activity = THREE.MathUtils.clamp(2.2 / (rAU * rAU), 0, 1.6) * (1 - THREE.MathUtils.smoothstep(rAU, 3, 6))
    if (tails.current) tails.current.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), g.position.clone().normalize())
    mats.current.forEach((m) => {
      const ion = m.uniforms.uIon.value > 0.5
      m.uniforms.uTime.value = simClock.anim
      m.uniforms.uLen.value = activity * (ion ? 170 : 80)
      m.uniforms.uWidth.value = activity * (ion ? 58 : 44)
      m.uniforms.uIntensity.value = Math.min(1.2, activity) * (ion ? 0.75 : 0.22)
    })
    if (coma.current) {
      coma.current.visible = activity > 0.01
      coma.current.scale.setScalar(0.6 + Math.min(1.4, activity))
    }
  }
  return (
    <CelestialMarker obj={obj} pickRadius={0.9} labelMaxDistance={4000} onFrame={onFrame}>
      <mesh geometry={sphereGeo(24)} material={nucleusMat} scale={0.12} />
      <group ref={coma}>
        <GlowPoint color="#dffaff" size={2.4} minPx={5} maxPx={120} intensity={2.0} />
        <GlowPoint color="#4fd2ff" size={7} minPx={4} maxPx={320} intensity={1.0} />
        <GlowPoint color="#2f6cff" size={18} minPx={3} maxPx={600} intensity={0.28} />
      </group>
      <group ref={tails}>
        <Tail ion colorA="#b6f4ff" colorB="#5ab8ff" colorC="#2244d8" curve={0} register={register} />
        <Tail ion={false} colorA="#f4f7ff" colorB="#a9c4e8" colorC="#56688a" curve={0.18} register={register} />
      </group>
    </CelestialMarker>
  )
}
