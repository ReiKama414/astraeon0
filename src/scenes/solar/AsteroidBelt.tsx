import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CelestialObject } from '../../core/registry/types'
import { mulberry32, gauss } from '../../core/procedural/rng'
import { AU_UNITS } from '../../core/coords/SceneScaleManager'
import { simClock } from '../../core/time/SimulationClock'
import { J2000_JD } from '../../core/coords/UniverseCoordinateSystem'

const vert = /* glsl */ `
attribute vec4 aOrbit; // a(AU), phase, inclination, node
attribute float aSize;
uniform float uDays;
uniform float uAU;
uniform float uPixelRatio;
uniform float uViewportH;
varying float vShade;
void main(){
  float a = aOrbit.x;
  float n = 6.28318530718 / (365.25 * pow(a, 1.5));
  float M = aOrbit.y + n * uDays;
  vec3 p = vec3(cos(M)*a, 0.0, -sin(M)*a);
  float ci = cos(aOrbit.z), si = sin(aOrbit.z);
  p = vec3(p.x, -p.z*si, p.z*ci);
  float cn = cos(aOrbit.w), sn = sin(aOrbit.w);
  p = vec3(p.x*cn - p.z*sn, p.y, p.x*sn + p.z*cn);
  vec4 mv = modelViewMatrix * vec4(p*uAU, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aSize * 0.35 * projectionMatrix[1][1] * uViewportH * 0.5 / max(0.01,-mv.z);
  vShade = clamp(px/1.2, 0.2, 1.0);
  gl_PointSize = clamp(px, 1.2, 6.0) * uPixelRatio;
}
`
const frag = /* glsl */ `
varying float vShade;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float a = (1.0 - smoothstep(0.15, 0.5, length(c))) * vShade * 0.7;
  if(a<0.01) discard;
  gl_FragColor = vec4(vec3(0.78,0.7,0.62)*a, 1.0);
}
`

/** Statistical visualisation of the main belt (2.1–3.3 AU) with Kirkwood gaps; not catalogued asteroids. */
export function AsteroidBelt({ obj, count }: { obj: CelestialObject; count: number }) {
  const { geo, mat } = useMemo(() => {
    const r = mulberry32(2718)
    const orb = new Float32Array(count * 4)
    const size = new Float32Array(count)
    const gaps = [[2.49, 2.53], [2.81, 2.85], [2.95, 2.98], [3.26, 3.3]]
    let i = 0
    while (i < count) {
      const a = 2.1 + Math.pow(r(), 1.2) * 1.2
      if (gaps.some(([x, y]) => a > x && a < y)) continue
      orb.set([a, r() * Math.PI * 2, Math.abs(gauss(r)) * 0.12 * (r() < 0.5 ? 1 : -1), r() * Math.PI * 2], i * 4)
      size[i] = 0.4 + Math.pow(r(), 5) * 2
      i++
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geo.setAttribute('aOrbit', new THREE.BufferAttribute(orb, 4))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.5 * AU_UNITS)
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uDays: { value: 0 }, uAU: { value: AU_UNITS }, uPixelRatio: { value: 1 }, uViewportH: { value: 800 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [count])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  useFrame(({ gl, size }) => {
    mat.uniforms.uDays.value = simClock.jd - J2000_JD
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    mat.uniforms.uViewportH.value = size.height
  })
  return <points geometry={geo} material={mat} userData={{ id: obj.id }} />
}
