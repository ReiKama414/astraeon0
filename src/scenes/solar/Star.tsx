import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CelestialObject } from '../../core/registry/types'
import { coronaFrag, coronaVert, earthVert, sunFrag } from './planetShaders'
import { sphereGeo, quadGeo } from './shared'
import { simClock } from '../../core/time/SimulationClock'
import { GlowPoint } from '../common/GlowPoint'
import { kelvinToRgb } from '../../core/data/stars'

function tempColors(o: CelestialObject): [THREE.Color, THREE.Color, THREE.Color] {
  const pal = o.visual.planet?.palette
  if (pal && pal.length >= 3) return [new THREE.Color(pal[0]), new THREE.Color(pal[1]), new THREE.Color(pal[2])]
  const [r, g, b] = kelvinToRgb(o.physical.temperatureK ?? 5772)
  const c = new THREE.Color(r, g, b)
  return [c.clone().lerp(new THREE.Color('#ffffff'), 0.5), c, c.clone().multiplyScalar(0.55)]
}

/** Star renderer: animated photosphere shader + corona billboard + far-distance glow + light source. */
export function StarBody({ obj, radius, light = true }: { obj: CelestialObject; radius: number; light?: boolean }) {
  const [a, b, c] = useMemo(() => tempColors(obj), [obj])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: sunFrag,
        uniforms: { uTime: { value: 0 }, uColorA: { value: a }, uColorB: { value: b }, uColorC: { value: c }, uIntensity: { value: 2.6 } },
      }),
    [a, b, c],
  )
  const corona = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coronaVert,
        fragmentShader: coronaFrag,
        uniforms: { uTime: { value: 0 }, uScale: { value: radius * 4.2 }, uColor: { value: b.clone().lerp(new THREE.Color('#ffffff'), 0.3) }, uCore: { value: 0.24 }, uIntensity: { value: 0.75 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [b, radius],
  )
  useEffect(() => () => (mat.dispose(), corona.dispose()), [mat, corona])
  useFrame(() => {
    mat.uniforms.uTime.value = simClock.anim
    corona.uniforms.uTime.value = simClock.anim
  })
  const lightColor = useMemo(() => b.clone().lerp(new THREE.Color('#ffffff'), 0.55), [b])
  return (
    <group>
      <mesh geometry={sphereGeo(96)} material={mat} scale={radius} />
      <mesh geometry={quadGeo} material={corona} renderOrder={7} frustumCulled={false} />
      <GlowPoint color={`#${lightColor.getHexString()}`} size={radius * 2} minPx={5} maxPx={40} intensity={1.2} spikes={0.5} />
      {light && <pointLight color={lightColor} intensity={3.2} decay={0} distance={0} />}
    </group>
  )
}
