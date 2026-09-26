import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { registry } from '../../core/registry/CelestialRegistry'
import { galaxyOrientation, positionInScene } from '../../core/coords/SceneScaleManager'
import { GalaxyRenderer } from '../galaxy/GalaxyRenderer'
import { CelestialMarker } from '../common/CelestialMarker'
import { BackgroundSky } from '../common/BackgroundSky'
import { requestCosmicWeb } from '../../workers/workerClient'
import { useQuality } from '../useQuality'
import { signalSceneReady } from '../../core/navigation/Navigator'
import { useRegistryVersion } from '../useRegistry'

const SCENE = { id: 'universe', kind: 'universe' as const, hostId: 'universe' }
const WEB_EXTENT = 30000

const webVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uViewportH;
varying vec3 vColor;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(1e-3, -mv.z);
  float px = aSize * 30.0 * projectionMatrix[1][1] * uViewportH * 0.5 / d;
  float a = 1.0;
  if(px < 1.3){ a = px/1.3; px = 1.3; }
  if(px > 7.0){ a *= 7.0/px; px = 7.0; }
  gl_PointSize = px * uPixelRatio;
  vColor = aColor;
  vA = a;
}
`
const hazeVert = /* glsl */ `
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uViewportH;
varying vec3 vColor;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(1e-3, -mv.z);
  float px = 420.0 * projectionMatrix[1][1] * uViewportH * 0.5 / d;
  vA = smoothstep(2.0, 12.0, px) * (1.0 - smoothstep(200.0, 500.0, px));
  gl_PointSize = clamp(px, 2.0, 500.0) * uPixelRatio;
  // tint the unresolved light of the web toward nebular violet / cyan
  vColor = mix(vec3(0.42,0.3,0.85), vec3(0.3,0.55,0.9), fract(position.x*0.0013));
}
`
const hazeFrag = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float a = exp(-dot(c,c)*9.0) * vA * 0.035;
  if(a < 0.0015) discard;
  gl_FragColor = vec4(vColor*a, 1.0);
}
`
const webFrag = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float r2 = dot(c,c);
  // tiny elongated smudge: distant galaxies are not perfect points
  float a = exp(-r2*18.0) * vA;
  if(a<0.003) discard;
  gl_FragColor = vec4(vColor*a*0.9, 1.0);
}
`

function CosmicWeb({ count }: { count: number }) {
  const [buf, setBuf] = useState<{ position: Float32Array; color: Float32Array; size: Float32Array } | null>(null)
  useEffect(() => {
    let alive = true
    requestCosmicWeb(count, 13_800, WEB_EXTENT).then((b) => alive && setBuf(b))
    return () => {
      alive = false
    }
  }, [count])
  const geo = useMemo(() => {
    if (!buf) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buf.position, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(buf.color, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(buf.size, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), WEB_EXTENT * 2)
    return g
  }, [buf])
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: webVert, fragmentShader: webFrag, uniforms: { uPixelRatio: { value: 1 }, uViewportH: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  )
  const haze = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: hazeVert, fragmentShader: hazeFrag, uniforms: { uPixelRatio: { value: 1 }, uViewportH: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  )
  const hazeGeo = useMemo(() => {
    if (!buf) return null
    const n = Math.min(9000, Math.floor(buf.position.length / 3))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buf.position.slice(0, n * 3), 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), WEB_EXTENT * 2)
    return g
  }, [buf])
  useEffect(() => () => geo?.dispose(), [geo])
  useEffect(() => () => hazeGeo?.dispose(), [hazeGeo])
  useEffect(() => () => (mat.dispose(), haze.dispose()), [mat, haze])
  useFrame(({ gl, size }) => {
    for (const m of [mat, haze]) {
      m.uniforms.uPixelRatio.value = gl.getPixelRatio()
      m.uniforms.uViewportH.value = size.height
    }
  })
  return geo ? (
    <>
      {hazeGeo && <points geometry={hazeGeo} material={haze} />}
      <points geometry={geo} material={mat} />
    </>
  ) : null
}

/** Glowing impostor for the fictional sector: an iridescent cloud of tiny galaxies, clearly marked as fiction. */
function FantasySectorPortal() {
  const obj = registry.get('fantasy-universe')!
  const pos = useMemo(() => positionInScene(obj, SCENE), [obj])
  const { geo, mat } = useMemo(() => {
    const n = 2400
    const p = new Float32Array(n * 3)
    const c = new Float32Array(n * 3)
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) {
      const rad = 110 * Math.pow(r(), 0.6)
      const a = r() * Math.PI * 2
      const ct = r() * 2 - 1
      const st = Math.sqrt(1 - ct * ct)
      p.set([rad * st * Math.cos(a), rad * ct * 0.45, rad * st * Math.sin(a)], i * 3)
      const h = r()
      const col = new THREE.Color().setHSL(0.72 + h * 0.3, 0.8, 0.7)
      c.set([col.r, col.g, col.b], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3))
    const mat = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
    return { geo, mat }
  }, [])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  useFrame((_, dt) => {
    geo.rotateY(dt * 0.01)
  })
  return (
    <CelestialMarker obj={obj} position={pos} pickRadius={120} labelMaxDistance={40000}>
      <points geometry={geo} material={mat} />
    </CelestialMarker>
  )
}

export function UniverseScene() {
  const q = useQuality()
  useRegistryVersion()
  const galaxies = registry.byType('galaxy').filter((g) => g.sourceType === 'real')
  const groups = registry.byType('galaxy-group').filter((g) => g.sourceType === 'real')
  const [readyCount, setReady] = useState(0)
  useEffect(() => {
    if (readyCount >= 1) signalSceneReady('universe')
  }, [readyCount])
  useEffect(() => {
    const t = setTimeout(() => signalSceneReady('universe'), 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <group>
      <BackgroundSky band={false} starCount={Math.floor(q.backgroundStars * 0.35)} intensity={0.55} starScale={0.7} />
      <CosmicWeb count={q.cosmicWeb} />
      {galaxies.map((g) => {
        const pos = positionInScene(g, SCENE)
        const isMW = g.id === 'milky-way'
        return (
          <CelestialMarker key={g.id} obj={g} position={pos} pickRadius={Math.max(1.2, g.visual.galaxy!.radiusKpc * 0.12)} labelMaxDistance={isMW || g.id === 'm31' ? 1500 : g.parentId === 'local-group' ? (g.id === 'm33' ? 1200 : 160) : 9000} labelMinDistance={g.visual.galaxy!.radiusKpc * 0.25}>
            <group quaternion={galaxyOrientation(g)}>
              <GalaxyRenderer
                galaxy={g.visual.galaxy!}
                unitsPerKpc={0.1}
                stars={isMW || g.id === 'm31' ? q.farGalaxyStars * 2 : q.farGalaxyStars}
                haze={400}
                starSize={0.016}
                intensity={1.4}
                onReady={isMW ? () => setReady((c) => c + 1) : undefined}
              />
            </group>
          </CelestialMarker>
        )
      })}
      {groups.map((g) => (
        <CelestialMarker key={g.id} obj={g} position={positionInScene(g, SCENE)} pickRadius={0.001} labelMaxDistance={g.id === 'local-group' ? 6000 : 20000} labelMinDistance={g.id === 'local-group' ? 400 : 300} labelClass="is-group" />
      ))}
      <FantasySectorPortal />
    </group>
  )
}
