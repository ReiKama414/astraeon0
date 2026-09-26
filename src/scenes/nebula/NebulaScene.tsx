import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { registry, type SceneRef } from '../../core/registry/CelestialRegistry'
import type { NebulaVisual } from '../../core/registry/types'
import { buildNebula } from './nebulaModels'
import { BackgroundSky } from '../common/BackgroundSky'
import { CelestialMarker } from '../common/CelestialMarker'
import { useQuality } from '../useQuality'
import { signalSceneReady } from '../../core/navigation/Navigator'
import { simClock } from '../../core/time/SimulationClock'
import { NOISE } from '../../shaders/noise'

/** 2×2 atlas of wispy cloud sprites baked once on the GPU (fbm + ridged filaments). */
let atlas: THREE.WebGLRenderTarget | null = null
function getAtlas(gl: THREE.WebGLRenderer) {
  if (atlas) return atlas.texture
  atlas = new THREE.WebGLRenderTarget(1024, 1024, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, depthBuffer: false })
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }',
    fragmentShader: `${NOISE}
    varying vec2 vUv;
    void main(){
      vec2 cell = floor(vUv*2.0);
      vec2 uv = fract(vUv*2.0)*2.0-1.0;
      float id = cell.x + cell.y*2.0;
      float r = length(uv);
      vec3 p = vec3(uv*1.6, id*7.31);
      float warp = fbm(p*1.3, 4);
      float n = fbm(p*2.2 + warp*1.2, 6)*0.5+0.5;
      float fil = ridged(p*1.8 + warp, 5);
      float shape = mix(n, fil, id < 1.5 ? 0.25 : 0.65);
      float fall = (1.0 - smoothstep(0.15, 1.0, r + (n-0.5)*0.5));
      float a = pow(clamp(shape*fall*1.45, 0.0, 1.0), 2.3);
      gl_FragColor = vec4(a, a, a, a);
    }`,
  })
  const scene = new THREE.Scene()
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  scene.add(quad)
  const prev = gl.getRenderTarget()
  gl.setRenderTarget(atlas)
  gl.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1))
  gl.setRenderTarget(prev)
  mat.dispose()
  quad.geometry.dispose()
  return atlas.texture
}

const cloudVert = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aRot;
attribute float aAlpha;
uniform float uPixelRatio;
uniform float uViewportH;
uniform float uTime;
varying vec3 vColor;
varying float vRot;
varying float vAlpha;
varying float vTile;
void main(){
  vec3 p = position;
  // slow turbulent drift (animation time, independent from simulation time)
  float h = fract(sin(dot(position, vec3(12.9898,78.233,37.719)))*43758.5453);
  p += vec3(sin(uTime*0.05 + h*20.0), cos(uTime*0.04 + h*13.0), sin(uTime*0.03 + h*7.0)) * aSize * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(0.1, -mv.z);
  float px = aSize * projectionMatrix[1][1] * uViewportH * 0.5 / d;
  float a = aAlpha * smoothstep(aSize*0.4, aSize*2.2, d);
  if(px > 420.0){ a *= 420.0/px; px = 420.0; }
  gl_PointSize = px * uPixelRatio;
  vColor = aColor;
  vRot = aRot + uTime*0.004*(h-0.5);
  vAlpha = a;
  vTile = floor(h*4.0);
}
`
const cloudFrag = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uIntensity;
uniform float uDust;
varying vec3 vColor;
varying float vRot;
varying float vAlpha;
varying float vTile;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vRot), sn = sin(vRot);
  c = mat2(cs, -sn, sn, cs) * c;
  if(abs(c.x) > 0.5 || abs(c.y) > 0.5) discard;
  vec2 tile = vec2(mod(vTile, 2.0), floor(vTile/2.0));
  float a = texture2D(uAtlas, (c + 0.5)*0.5 + tile*0.5).a * vAlpha;
  if(a < 0.004) discard;
  if(uDust > 0.5) gl_FragColor = vec4(vColor, a*0.85);
  else gl_FragColor = vec4(vColor * a * uIntensity, 1.0);
}
`
const starVert = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uPixelRatio;
uniform float uViewportH;
varying vec3 vColor;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  float px = aSize * 1.6 * projectionMatrix[1][1] * uViewportH * 0.5 / max(0.1,-mv.z);
  gl_PointSize = clamp(px, 2.0, 48.0) * uPixelRatio;
  vColor = aColor * clamp(px/2.0, 0.4, 1.6);
}
`
const starFrag = /* glsl */ `
varying vec3 vColor;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float r = length(c);
  float a = exp(-r*r*60.0)*1.4 + exp(-r*10.0)*0.25;
  a += (exp(-abs(c.x)*70.0)*exp(-abs(c.y)*7.0) + exp(-abs(c.y)*70.0)*exp(-abs(c.x)*7.0))*0.25;
  gl_FragColor = vec4(vColor*a, 1.0);
}
`

export function NebulaRenderer({ visual, sprites, onReady }: { visual: NebulaVisual; sprites: number; onReady?: () => void }) {
  const { gl } = useThree()
  const data = useMemo(() => buildNebula(visual, sprites), [visual, sprites])
  const tex = useMemo(() => getAtlas(gl), [gl])
  const built = useMemo(() => {
    const mk = (b: typeof data.emission) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3))
      g.setAttribute('aColor', new THREE.BufferAttribute(b.col, 3))
      g.setAttribute('aSize', new THREE.BufferAttribute(b.size, 1))
      g.setAttribute('aRot', new THREE.BufferAttribute(b.rot, 1))
      g.setAttribute('aAlpha', new THREE.BufferAttribute(b.alpha, 1))
      return g
    }
    const emissionGeo = mk(data.emission)
    const dustGeo = mk(data.dust)
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(data.stars.pos, 3))
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(data.stars.col, 3))
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(data.stars.size, 1))
    const base = { uPixelRatio: { value: 1 }, uViewportH: { value: 800 }, uTime: { value: 0 } }
    const emissionMat = new THREE.ShaderMaterial({ vertexShader: cloudVert, fragmentShader: cloudFrag, uniforms: { ...THREE.UniformsUtils.clone(base), uAtlas: { value: tex }, uIntensity: { value: 0.16 }, uDust: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    const dustMat = new THREE.ShaderMaterial({ vertexShader: cloudVert, fragmentShader: cloudFrag, uniforms: { ...THREE.UniformsUtils.clone(base), uAtlas: { value: tex }, uIntensity: { value: 1 }, uDust: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.NormalBlending })
    const starMat = new THREE.ShaderMaterial({ vertexShader: starVert, fragmentShader: starFrag, uniforms: THREE.UniformsUtils.clone(base), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    return { emissionGeo, dustGeo, starGeo, emissionMat, dustMat, starMat }
  }, [data, tex])
  useEffect(() => () => Object.values(built).forEach((o) => o.dispose()), [built])
  const readyRef = useRef(onReady)
  readyRef.current = onReady
  useEffect(() => {
    readyRef.current?.()
  }, [built])
  useFrame(({ gl: r, size }) => {
    for (const m of [built.emissionMat, built.dustMat, built.starMat]) {
      m.uniforms.uPixelRatio.value = r.getPixelRatio()
      m.uniforms.uViewportH.value = size.height
      m.uniforms.uTime.value = simClock.anim
    }
  })
  return (
    <group>
      <points geometry={built.emissionGeo} material={built.emissionMat} renderOrder={2} frustumCulled={false} />
      <points geometry={built.dustGeo} material={built.dustMat} renderOrder={3} frustumCulled={false} />
      <points geometry={built.starGeo} material={built.starMat} renderOrder={4} frustumCulled={false} />
    </group>
  )
}

export function NebulaScene({ scene }: { scene: SceneRef }) {
  const q = useQuality()
  const host = registry.get(scene.hostId)!
  const onReady = useMemo(() => () => signalSceneReady(scene.id), [scene.id])
  return (
    <group>
      <BackgroundSky band starCount={q.backgroundStars} intensity={0.8} />
      <NebulaRenderer visual={host.visual.nebula!} sprites={q.nebulaSprites} onReady={onReady} />
      <CelestialMarker obj={host} pickRadius={0.01} label={false} />
    </group>
  )
}
