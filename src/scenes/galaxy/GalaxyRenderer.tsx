import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GalaxyVisual } from '../../core/registry/types'
import { requestGalaxy } from '../../workers/workerClient'
import type { GalaxyBuffers } from '../../workers/galaxyGen'
import { simClock } from '../../core/time/SimulationClock'

const vert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uSize;
uniform float uPixelRatio;
uniform float uViewportH;
uniform float uMaxPx;
uniform float uNearFade;
uniform float uTime;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(1e-4, -mv.z);
  float px = aSize * uSize * projectionMatrix[1][1] * uViewportH * 0.5 / depth;
  float a = 1.0;
  if(px < 1.4){ a = px / 1.4; px = 1.4; }
  // oversized sprites (camera inside the galaxy) dissolve instead of becoming blobs
  if(px > uMaxPx){ float k = uMaxPx / px; a *= k * k; px = uMaxPx; }
  // fade stars that pass very close to the camera instead of letting them become blobs
  a *= smoothstep(0.0, uNearFade, depth);
  float h = fract(sin(dot(position.xz, vec2(12.9898,78.233)))*43758.5453);
  a *= 1.0 - uTwinkle * (0.5 + 0.5*sin(uTime*(0.6+h*2.0) + h*60.0));
  gl_PointSize = px * uPixelRatio;
  vColor = aColor;
  vAlpha = a;
}
`
const fragStar = /* glsl */ `
uniform float uIntensity;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c,c);
  float a = exp(-r2*22.0) * vAlpha;
  if(a < 0.002) discard;
  gl_FragColor = vec4(vColor * a * uIntensity, 1.0);
}
`
const fragDust = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c,c);
  float a = exp(-r2*10.0) * vAlpha * uOpacity;
  if(a < 0.004) discard;
  // pure absorption: multiply what is behind toward a cool neutral shadow (never adds colour)
  gl_FragColor = vec4(mix(vec3(1.0), vec3(0.62, 0.66, 0.8), a) * (1.0 - a * 0.45), 1.0);
}
`

function makeMat(frag: string, blending: THREE.Blending, extra: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uSize: { value: 1 },
      uPixelRatio: { value: 1 },
      uViewportH: { value: 800 },
      uMaxPx: { value: 48 },
      uNearFade: { value: 0 },
      uTime: { value: 0 },
      uTwinkle: { value: 0 },
      ...extra,
    },
    transparent: true,
    depthWrite: false,
    blending,
  })
}

function geoFrom(b: { position: Float32Array; color: Float32Array; size: Float32Array }, radius: number) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(b.position, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(b.color, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(b.size, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius)
  return g
}

export interface GalaxyRendererProps {
  galaxy: GalaxyVisual
  unitsPerKpc: number
  stars: number
  haze: number
  /** world size of a unit star sprite */
  starSize: number
  intensity?: number
  onReady?: () => void
  nearFade?: number
}

/**
 * GalaxyRenderer — reusable 3D particle galaxy (spiral / barred / elliptical / irregular / lenticular).
 * Geometry is generated off-thread; materials are created once per instance and disposed on unmount.
 */
export function GalaxyRenderer({ galaxy, unitsPerKpc, stars, haze, starSize, intensity = 1, onReady, nearFade = 0 }: GalaxyRendererProps) {
  const [buffers, setBuffers] = useState<GalaxyBuffers | null>(null)
  useEffect(() => {
    let alive = true
    requestGalaxy(galaxy, stars, haze, unitsPerKpc).then((b) => {
      if (alive) setBuffers(b)
    })
    return () => {
      alive = false
    }
  }, [galaxy, stars, haze, unitsPerKpc])

  const radius = galaxy.radiusKpc * unitsPerKpc * 1.6
  const geos = useMemo(() => {
    if (!buffers) return null
    return { stars: geoFrom(buffers.stars, radius), dust: geoFrom(buffers.dust, radius), haze: geoFrom(buffers.haze, radius) }
  }, [buffers, radius])

  const mats = useMemo(
    () => ({
      stars: makeMat(fragStar, THREE.AdditiveBlending, { uIntensity: { value: intensity } }),
      haze: makeMat(fragStar, THREE.AdditiveBlending, { uIntensity: { value: 0.07 * intensity } }),
      dust: Object.assign(makeMat(fragDust, THREE.CustomBlending, { uOpacity: { value: 0.32 } }), { blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor }),
    }),
    [intensity],
  )

  const readyRef = useRef(onReady)
  readyRef.current = onReady
  useEffect(() => {
    if (geos) readyRef.current?.()
  }, [geos])

  useEffect(
    () => () => {
      if (geos) Object.values(geos).forEach((g) => g.dispose())
    },
    [geos],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  useFrame(({ gl, size }) => {
    const pr = gl.getPixelRatio()
    for (const [k, m] of Object.entries(mats)) {
      m.uniforms.uPixelRatio.value = pr
      m.uniforms.uViewportH.value = size.height
      m.uniforms.uTime.value = simClock.anim
      m.uniforms.uNearFade.value = nearFade
      m.uniforms.uSize.value = k === 'haze' ? starSize * 2.6 : k === 'dust' ? starSize * 1.8 : starSize
      m.uniforms.uMaxPx.value = k === 'haze' ? 380 : k === 'dust' ? 110 : 36
      m.uniforms.uTwinkle.value = k === 'stars' ? 0.18 : 0
    }
  })

  if (!geos) return null
  return (
    <group>
      <points geometry={geos.haze} material={mats.haze} renderOrder={1} />
      <points geometry={geos.stars} material={mats.stars} renderOrder={2} />
      <points geometry={geos.dust} material={mats.dust} renderOrder={3} />
    </group>
  )
}
