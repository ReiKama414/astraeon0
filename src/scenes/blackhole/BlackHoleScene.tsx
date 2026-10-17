import { useEffect, useMemo, useState } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { registry, type SceneRef } from '../../core/registry/CelestialRegistry'
import type { CelestialObject } from '../../core/registry/types'
import { bhFrag, bhVert } from './blackHoleShader'
import { BackgroundSky } from '../common/BackgroundSky'
import { CelestialMarker } from '../common/CelestialMarker'
import { simClock } from '../../core/time/SimulationClock'
import { useQuality } from '../useQuality'
import { signalSceneReady } from '../../core/navigation/Navigator'
import { quadGeo } from '../solar/shared'
import { NOISE } from '../../shaders/noise'

/** Environment specific backdrop, captured once into a cubemap that the lensing shader samples. */
function EnvironmentBackdrop({ env }: { env: 'galactic-center' | 'elliptical-core' | 'fantasy' }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix)*position,1.0); gl_Position = vec4(p.xy, p.w*0.99999, p.w); }`,
        fragmentShader: `${NOISE}
        uniform int uEnv; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          vec3 col;
          if(uEnv == 0){
            // inside the bulge: warm crowded glow, dark dust clouds in the plane
            float band = exp(-abs(d.y)/0.35);
            float n = fbm(d*3.0, 6)*0.5+0.5;
            float dust = smoothstep(0.35, 0.75, fbm(d*5.0+2.0, 5)*0.5+0.5) * exp(-abs(d.y)/0.12);
            col = mix(vec3(0.02,0.022,0.05), vec3(0.62,0.54,0.44), band*(0.5+0.6*n));
            col = mix(col, vec3(0.01,0.012,0.03), dust*0.85);
            col += vec3(0.4,0.1,0.18) * smoothstep(0.7,0.95,n) * band * 0.3;
          } else if(uEnv == 1){
            // giant elliptical core: smooth golden starlight falling off with angle from the core
            float core = exp(-acos(clamp(d.z,-1.0,1.0))*1.2);
            col = mix(vec3(0.02,0.02,0.05), vec3(0.5,0.44,0.36), (0.25 + 0.75*core)) * (0.85+0.3*fbm(d*4.0,4));
          } else {
            float n = fbm(d*2.0, 6)*0.5+0.5;
            col = mix(vec3(0.02,0.01,0.05), vec3(0.25,0.08,0.35), smoothstep(0.4,0.9,n));
            col += vec3(0.05,0.2,0.3) * smoothstep(0.6,1.0,fbm(d*3.0+5.0,4)*0.5+0.5);
          }
          gl_FragColor = vec4(col*0.22, 1.0);
        }`,
        uniforms: { uEnv: { value: env === 'galactic-center' ? 0 : env === 'elliptical-core' ? 1 : 2 } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [env],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh geometry={useMemo(() => new THREE.SphereGeometry(10, 64, 32), [])} material={mat} />
}

export function BlackHoleRenderer({ obj }: { obj: CelestialObject }) {
  const bh = obj.visual.blackHole!
  const q = useQuality()
  const { gl, camera } = useThree()
  const envScene = useMemo(() => new THREE.Scene(), [])
  const [cube] = useState(() => {
    const rt = new THREE.WebGLCubeRenderTarget(q.textureSize >= 2048 ? 2048 : 1024, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter })
    return { rt, cam: new THREE.CubeCamera(0.1, 100, rt) }
  })
  const [captured, setCaptured] = useState(false)
  useEffect(() => () => cube.rt.dispose(), [cube])

  const mat = useMemo(() => {
    const n = new THREE.Vector3(0, 1, 0)
    return new THREE.ShaderMaterial({
      vertexShader: bhVert,
      fragmentShader: bhFrag(q.bhSteps),
      uniforms: {
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uEnv: { value: cube.rt.texture },
        uTime: { value: 0 },
        uDiskN: { value: n.normalize() },
        uInner: { value: bh.diskInner },
        uOuter: { value: bh.diskOuter },
        uTemp: { value: bh.diskTemperatureK },
        uBright: { value: bh.diskBrightness },
        uJet: { value: bh.jet ? 1 : 0 },
        uSeed: { value: (bh.seed % 97) * 0.37 },
      },
      depthWrite: false,
      depthTest: false,
    })
  }, [bh, q.bhSteps, cube])
  useEffect(() => () => mat.dispose(), [mat])

  useFrame(() => {
    if (!captured) {
      cube.cam.update(gl, envScene)
      setCaptured(true)
      signalSceneReady(`black-hole:${obj.id}`)
    }
    const u = mat.uniforms
    u.uInvProj.value.copy(camera.projectionMatrixInverse)
    u.uCamWorld.value.copy(camera.matrixWorld)
    u.uCamPos.value.copy(camera.position)
    u.uTime.value = simClock.anim
  })

  return (
    <>
      {createPortal(
        <>
          <EnvironmentBackdrop env={bh.environment} />
          <BackgroundSky band={false} starCount={q.backgroundStars * 2} intensity={0.6} starScale={0.9} />
        </>,
        envScene,
      )}
      <mesh geometry={quadGeo} material={mat} frustumCulled={false} renderOrder={-2000} />
    </>
  )
}

export function BlackHoleScene({ scene }: { scene: SceneRef }) {
  const host = registry.get(scene.hostId)!
  return (
    <group>
      <BlackHoleRenderer obj={host} />
      <CelestialMarker obj={host} pickRadius={2.2} label={false} />
    </group>
  )
}
