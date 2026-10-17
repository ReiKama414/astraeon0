import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { CelestialObject, PlanetVisual } from '../../core/registry/types'
import { bakePlanet, type BakedPlanet } from './TextureBaker'
import { atmoFrag, atmoVert, ringFrag, ringVert, standardPatch, cloudFrag, earthVert } from './planetShaders'
import { poleQuaternion, spinAngle } from './bodyMath'
import { ringGeo, sphereGeo } from './shared'
import { simClock } from '../../core/time/SimulationClock'
import { useQuality } from '../useQuality'
import { loadRemoteTexture } from '../../core/assets/RemoteTextures'
import { NOISE } from '../../shaders/noise'

const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()

/** Detail level switches with hysteresis as the camera approaches (progressive LOD). */
export function useNearLOD(ref: React.RefObject<THREE.Object3D | null>, radius: number, enter = 40, exit = 60) {
  const [near, setNear] = useState(false)
  useFrame(({ camera }) => {
    const o = ref.current
    if (!o) return
    o.getWorldPosition(tmpV)
    const d = camera.position.distanceTo(tmpV) / radius
    if (!near && d < enter) setNear(true)
    else if (near && d > exit) setNear(false)
  })
  return near
}

export function Atmosphere({ radius, visual, sunPos, centerRef }: { radius: number; visual: NonNullable<PlanetVisual['atmosphere']>; sunPos: THREE.Vector3; centerRef: React.RefObject<THREE.Object3D | null> }) {
  const shell = radius * (1 + (visual.thickness ?? 0.03) * 2.2)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        uniforms: {
          uSunPos: { value: new THREE.Vector3() },
          uCenter: { value: new THREE.Vector3() },
          uR: { value: radius },
          uRa: { value: shell },
          uColor: { value: new THREE.Color(visual.color) },
          uSunset: { value: new THREE.Color('#ff7a45') },
          uDensity: { value: visual.density * 0.8 },
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [radius, shell, visual.color, visual.density],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    mat.uniforms.uSunPos.value.copy(sunPos)
    centerRef.current?.getWorldPosition(mat.uniforms.uCenter.value)
  })
  return <mesh geometry={sphereGeo(64)} material={mat} scale={shell} renderOrder={4} />
}

export function Rings({ radius, rings, seed, sunPos, centerRef }: { radius: number; rings: NonNullable<PlanetVisual['rings']>; seed: number; sunPos: THREE.Vector3; centerRef: React.RefObject<THREE.Object3D | null> }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => {
    const pal = [...rings.palette, rings.palette[rings.palette.length - 1], rings.palette[0]]
    return new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      uniforms: {
        uInner: { value: rings.inner * radius },
        uOuter: { value: rings.outer * radius },
        uPlanetR: { value: radius },
        uKind: { value: rings.kind === 'saturn' ? 0 : rings.kind === 'uranus' ? 1 : 2 },
        uCol0: { value: new THREE.Color(pal[0]) },
        uCol1: { value: new THREE.Color(pal[1]) },
        uCol2: { value: new THREE.Color(pal[2]) },
        uOpacity: { value: rings.opacity },
        uSunWorld: { value: new THREE.Vector3() },
        uCenter: { value: new THREE.Vector3() },
        uNormal: { value: new THREE.Vector3(0, 1, 0) },
        uSeed: { value: (seed % 100) * 1.37 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [rings, radius, seed])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    mat.uniforms.uSunWorld.value.copy(sunPos)
    centerRef.current?.getWorldPosition(mat.uniforms.uCenter.value)
    if (ref.current) mat.uniforms.uNormal.value.set(0, 0, 1).transformDirection(ref.current.matrixWorld)
  })
  const tilt = ((rings.tiltDeg ?? 0) * Math.PI) / 180
  return <mesh ref={ref} geometry={ringGeo(rings.inner * radius, rings.outer * radius)} material={mat} rotation={[-Math.PI / 2 + tilt, 0, 0]} renderOrder={6} />
}

function Clouds({ radius, texture, channel, opacity, sunPos, speed }: { radius: number; texture: THREE.Texture; channel: number; opacity: number; sunPos: THREE.Vector3; speed: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: cloudFrag,
        uniforms: {
          uClouds: { value: texture },
          uChannel: { value: channel },
          uSunWorld: { value: new THREE.Vector3() },
          uOpacity: { value: opacity },
          uTint: { value: new THREE.Color('#ffffff') },
          uShift: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      }),
    [texture, channel, opacity],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    mat.uniforms.uSunWorld.value.copy(sunPos)
    mat.uniforms.uShift.value = (simClock.anim * 0.0015 * speed) % 1
  })
  return <mesh geometry={sphereGeo(96)} material={mat} scale={radius * 1.012} renderOrder={3} />
}

const auroraVert = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vWorldN;
void main(){
  vLocal = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const auroraFrag = /* glsl */ `
${NOISE}
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uTime;
uniform vec3 uSunWorld;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vWorldN;
void main(){
  float lat = asin(clamp(abs(vLocal.y), 0.0, 1.0));
  float lon = atan(vLocal.z, vLocal.x);
  // wavy auroral oval around ~68° latitude
  float oval = 1.18 + 0.05 * sin(lon * 3.0 + uTime * 0.2) + 0.03 * snoise(vec3(lon * 2.0, uTime * 0.1, 0.0));
  float band = exp(-pow((lat - oval) / 0.07, 2.0));
  float rays = 0.45 + 0.55 * smoothstep(-0.2, 0.8, snoise(vec3(lon * 22.0, uTime * 0.35, vLocal.y * 3.0)));
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(normalize(vWorldN), V)), 1.5);
  float night = smoothstep(0.15, -0.35, dot(normalize(vWorldN), normalize(uSunWorld - vWorld)));
  float a = band * rays * (0.35 + 0.65 * rim) * (0.35 + 0.65 * night);
  vec3 col = mix(uColor, uColor2, smoothstep(1.1, 1.3, lat + 0.1 * rays));
  gl_FragColor = vec4(col * a * 1.6, 1.0);
}
`

/** Fantasy aurora: animated curtains of light circling both magnetic poles. */
function Aurora({ radius, color, sunPos }: { radius: number; color: string; sunPos: THREE.Vector3 }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: auroraVert,
        fragmentShader: auroraFrag,
        uniforms: { uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(color).offsetHSL(0.18, 0, 0.05) }, uTime: { value: 0 }, uSunWorld: { value: new THREE.Vector3() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [color],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    mat.uniforms.uTime.value = simClock.anim
    mat.uniforms.uSunWorld.value.copy(sunPos)
  })
  return <mesh geometry={sphereGeo(96)} material={mat} scale={radius * 1.035} renderOrder={5} />
}

/** Glittering particles scattered through fantasy ring systems. */
function RingSparkles({ radius, rings, seed }: { radius: number; rings: NonNullable<PlanetVisual['rings']>; seed: number }) {
  const { geo, mat } = useMemo(() => {
    const n = 2600
    const p = new Float32Array(n * 3)
    const ph = new Float32Array(n)
    let st = (seed * 9301 + 49297) % 233280
    const rnd = () => ((st = (st * 9301 + 49297) % 233280) / 233280)
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const rr = radius * (rings.inner + (rings.outer - rings.inner) * Math.pow(rnd(), 0.8))
      p.set([Math.cos(a) * rr, (rnd() - 0.5) * radius * 0.01, Math.sin(a) * rr], i * 3)
      ph[i] = rnd() * 6.28
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: `attribute float aPhase; uniform float uTime; uniform float uPR; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        vA = pow(0.5 + 0.5*sin(uTime*2.0 + aPhase*3.0), 6.0); gl_PointSize = (1.5 + 3.0*vA) * uPR; }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; float r = length(c);
        float a = (exp(-r*r*40.0) + (exp(-abs(c.x)*40.0)*exp(-abs(c.y)*6.0) + exp(-abs(c.y)*40.0)*exp(-abs(c.x)*6.0))*0.4) * (0.15 + vA);
        if(a < 0.01) discard; gl_FragColor = vec4(uColor * a, 1.0); }`,
      uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uColor: { value: new THREE.Color(rings.palette[0]).lerp(new THREE.Color('#ffffff'), 0.5) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [radius, rings, seed])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  useFrame(({ gl }) => {
    mat.uniforms.uTime.value = simClock.anim
    mat.uniforms.uPR.value = gl.getPixelRatio()
  })
  const tilt = ((rings.tiltDeg ?? 0) * Math.PI) / 180
  return <points geometry={geo} material={mat} rotation={[tilt, 0, 0]} renderOrder={7} />
}

export interface BodyProps {
  obj: CelestialObject
  radius: number
  sunPos: THREE.Vector3
  /** object that marks the body's center (for shader uniforms) */
  centerRef: React.RefObject<THREE.Object3D | null>
}

/** Generic PBR planet/moon: baked procedural maps + MeshStandardMaterial with shader extensions. */
export function PlanetSurface({ obj, radius, sunPos, centerRef }: BodyProps) {
  const v = obj.visual.planet!
  const { gl } = useThree()
  const q = useQuality()
  const tilt = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Mesh>(null)
  const near = useNearLOD(tilt, radius)
  const size = near ? q.textureSize : Math.min(512, q.textureSize)
  const [baked, setBaked] = useState<BakedPlanet | null>(null)
  useEffect(() => {
    const b = bakePlanet(gl, v, size)
    setBaked(b)
    return () => b.dispose()
  }, [gl, v, size])

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: v.roughness ?? 1, metalness: 0, bumpScale: v.surface === 'gas' || v.surface === 'ice-giant' || v.surface === 'venus' || v.surface === 'dream-gas' ? 0 : 0.55 })
    const uniforms = {
      uData: { value: null as THREE.Texture | null },
      uEmissiveTint: { value: new THREE.Color(v.surface === 'lava' ? v.palette[1] ?? '#ff6a2a' : v.surface === 'biolume' ? v.palette[3] : v.surface === 'crystal' ? v.palette[1] : '#000000').multiplyScalar(v.surface === 'crystal' ? 0.35 : 1) },
      uRimColor: { value: new THREE.Color(v.atmosphere?.color ?? '#000000') },
      uRimStrength: { value: v.atmosphere ? 0.35 * v.atmosphere.density : 0 },
      uSunWorld: { value: new THREE.Vector3() },
      uCenterWorld: { value: new THREE.Vector3() },
      uRingNormal: { value: new THREE.Vector3(0, 1, 0) },
      uRingRadii: { value: new THREE.Vector2((v.rings?.inner ?? 0) * radius, (v.rings?.outer ?? 0) * radius) },
      uRingOpacity: { value: v.rings && v.rings.kind === 'saturn' ? v.rings.opacity : 0 },
    }
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${standardPatch.vertex}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${standardPatch.vertexMain}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${standardPatch.uniforms}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${standardPatch.fragment}`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${standardPatch.fragmentEnd}`)
    }
    m.userData.uniforms = uniforms
    return m
  }, [v, radius])
  useEffect(() => () => mat.dispose(), [mat])

  // real imagery when available (e.g. the Moon); the procedural bake stays as fallback + relief source
  const [photo, setPhoto] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!v.textureUrl) return
    let alive = true
    let tex: THREE.Texture | null = null
    loadRemoteTexture(v.textureUrl, { srgb: true, maxWidth: q.textureSize })
      .then((t) => {
        tex = t
        if (alive) setPhoto(t)
        else t.dispose()
      })
      .catch(() => {})
    return () => {
      alive = false
      tex?.dispose()
    }
  }, [v.textureUrl, q.textureSize])

  useEffect(() => {
    if (!baked) return
    mat.map = photo ?? baked.albedo
    mat.roughnessMap = baked.data
    mat.bumpMap = photo || v.surface === 'gas' || v.surface === 'ice-giant' || v.surface === 'venus' || v.surface === 'dream-gas' ? null : baked.data
    mat.userData.uniforms.uData.value = baked.data
    mat.needsUpdate = true
  }, [baked, photo, mat, v.surface])

  const pole = useMemo(() => poleQuaternion(v), [v])
  useFrame(() => {
    if (spin.current) spin.current.rotation.y = spinAngle(v, simClock.jd)
    const u = mat.userData.uniforms
    u.uSunWorld.value.copy(sunPos)
    centerRef.current?.getWorldPosition(u.uCenterWorld.value)
    if (tilt.current) u.uRingNormal.value.set(0, 1, 0).applyQuaternion(tilt.current.getWorldQuaternion(new THREE.Quaternion()))
  })

  const segs = near ? q.sphereSegments : 48
  return (
    <group ref={tilt} quaternion={pole}>
      <mesh ref={spin} geometry={sphereGeo(segs)} material={mat} scale={radius} />
      {baked?.clouds && v.clouds && <Clouds radius={radius} texture={baked.clouds} channel={0} opacity={v.clouds.opacity * (v.surface === 'venus' ? 0.35 : 0.9)} sunPos={sunPos} speed={v.clouds.speed ?? 1} />}
      {v.rings && <Rings radius={radius} rings={v.rings} seed={v.seed} sunPos={sunPos} centerRef={centerRef} />}
      {v.rings?.kind === 'fantasy' && <RingSparkles radius={radius} rings={v.rings} seed={v.seed} />}
      {v.aurora && <Aurora radius={radius} color={v.aurora} sunPos={sunPos} />}
    </group>
  )
}

export function sunDirection(sunPos: THREE.Vector3, from: THREE.Object3D) {
  from.getWorldPosition(tmpV2)
  return tmpV.copy(sunPos).sub(tmpV2).normalize()
}
