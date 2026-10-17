import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE } from '../../shaders/noise'
import { BackgroundSky } from './BackgroundSky'
import { simClock } from '../../core/time/SimulationClock'

const frag = /* glsl */ `
${NOISE}
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uTime;
uniform float uSeed;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float t = uTime * 0.004;
  vec3 w = vec3(fbm(d * 1.4 + uSeed, 4), fbm(d * 1.4 + uSeed + 4.3, 4), fbm(d * 1.4 + uSeed + 8.1, 4));
  float n1 = fbm(d * 2.2 + w * 1.6 + t, 6) * 0.5 + 0.5;
  float n2 = fbm(d * 4.5 - w + t * 1.7, 5) * 0.5 + 0.5;
  float veil = smoothstep(0.45, 0.85, n1);
  float wisps = pow(smoothstep(0.55, 0.95, n2), 1.5);
  vec3 col = mix(uA, uB, smoothstep(0.3, 0.8, w.x * 0.5 + 0.5)) * veil * 0.11;
  col += uC * wisps * veil * 0.09;
  col += mix(uA, uC, n2) * smoothstep(0.35, 0.7, n1) * 0.025;
  // deep violet floor so the black never goes flat
  col += vec3(0.012, 0.008, 0.024);
  gl_FragColor = vec4(col, 1.0);
}
`
const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}
`

/** Soft, drifting pastel nebulosity behind the stars — the backdrop of every fictional scene. */
export function DreamSky({ palette = ['#b58cff', '#ff8fc8', '#7fe8e0'], seed = 1, starCount = 14000 }: { palette?: string[]; seed?: number; starCount?: number }) {
  const key = palette.join('|')
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uA: { value: new THREE.Color(palette[0]) }, uB: { value: new THREE.Color(palette[1]) }, uC: { value: new THREE.Color(palette[2] ?? palette[0]) }, uTime: { value: 0 }, uSeed: { value: (seed % 97) * 0.31 } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [key, seed],
  )
  const geo = useMemo(() => new THREE.SphereGeometry(10, 64, 32), [])
  useEffect(() => () => (mat.dispose(), geo.dispose()), [mat, geo])
  useFrame(() => {
    mat.uniforms.uTime.value = simClock.anim
  })
  return (
    <group>
      <mesh geometry={geo} material={mat} renderOrder={-1001} frustumCulled={false} />
      <BackgroundSky band={false} starCount={starCount} starScale={0.85} starsOnly />
    </group>
  )
}
