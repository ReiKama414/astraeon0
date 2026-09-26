import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, advance } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as ECImpl } from 'postprocessing'
import * as THREE from 'three'
import { useApp, toast } from '../store/useAppStore'
import { registry } from '../core/registry/CelestialRegistry'
import { CameraController } from './common/CameraController'
import { WarpEffect } from './common/WarpEffect'
import { simClock } from '../core/time/SimulationClock'
import { QUALITY, isMobile } from '../core/quality'
import { UniverseScene } from './universe/UniverseScene'
import { GalaxyScene } from './galaxy/GalaxyScene'
import { SolarSystemScene } from './solar/SolarSystemScene'
import { BlackHoleScene } from './blackhole/BlackHoleScene'
import { NebulaScene } from './nebula/NebulaScene'
import { SkyScene } from './sky/SkyScene'
import { FantasyUniverseScene } from './fantasy/FantasyUniverseScene'
import { perfStats } from './common/perf'
import { projectLabels } from './common/labels'
import { liveObjects } from './common/cameraRig'
import { collect, procCount } from '../core/registry/SceneStreamingManager'
import { setCaptureHandler } from '../core/capture'
import type { SceneKind } from '../core/registry/types'
import type { SceneRef } from '../core/registry/CelestialRegistry'

/** CelestialRendererFactory: scene kind → renderer. New scene kinds plug in here only. */
const SCENE_RENDERERS: Record<SceneKind, (p: { scene: SceneRef }) => React.ReactElement | null> = {
  universe: () => <UniverseScene />,
  galaxy: ({ scene }) => <GalaxyScene scene={scene} />,
  system: ({ scene }) => <SolarSystemScene scene={scene} />,
  'black-hole': ({ scene }) => <BlackHoleScene scene={scene} />,
  nebula: ({ scene }) => <NebulaScene scene={scene} />,
  sky: ({ scene }) => <SkyScene scene={scene} />,
  'fantasy-universe': ({ scene }) => <FantasyUniverseScene scene={scene} />,
}

function SceneRouter() {
  const sceneId = useApp((s) => s.sceneId)
  const scene = useMemo(() => registry.sceneById(sceneId), [sceneId])
  const Renderer = SCENE_RENDERERS[scene.kind]
  useEffect(() => {
    // release procedural objects that the new scene does not need
    const t = setTimeout(() => collect(sceneId), 1500)
    return () => clearTimeout(t)
  }, [sceneId])
  if (!registry.get(scene.hostId) && scene.id !== 'universe') registry.resolve(scene.hostId)
  return <group key={sceneId}>{Renderer ? <Renderer scene={scene} /> : null}</group>
}

function LabelProjector() {
  useFrame(({ camera, size }) => projectLabels(camera, size.width, size.height), 0)
  return null
}

function SimDriver() {
  useFrame((_, dt) => simClock.tick(dt), -100)
  return null
}

/** Adaptive DPR + (in Auto mode) quality downgrade when frame rate stays below target. */
function AdaptivePerformance() {
  const { gl, setDpr } = useThree()
  const quality = useApp((s) => s.quality)
  const resolved = useApp((s) => s.resolvedQuality)
  const photo = useApp((s) => s.photoMode)
  const acc = useRef({ frames: 0, time: 0, dpr: QUALITY[resolved].dpr[1], lowStreak: 0 })
  useEffect(() => {
    acc.current.dpr = Math.min(QUALITY[resolved].dpr[1], window.devicePixelRatio || 1)
    setDpr(acc.current.dpr)
  }, [resolved, setDpr])
  useFrame((_, dt) => {
    const a = acc.current
    a.frames++
    a.time += dt
    if (a.time < 1.5) return
    const fps = a.frames / a.time
    perfStats.fps = fps
    perfStats.frameMs = (a.time / a.frames) * 1000
    a.frames = 0
    a.time = 0
    if (photo || useApp.getState().transitioning) return
    const target = isMobile() ? 30 : 55
    const [lo, hi] = QUALITY[resolved].dpr
    // full-screen ray marching (black holes) is fill-rate bound: cap its resolution
    const heavy = registry.sceneById(useApp.getState().sceneId).kind === 'black-hole'
    const maxDpr = Math.min(hi, window.devicePixelRatio || 1, heavy ? 1.25 : 4)
    if (a.dpr > maxDpr) a.dpr = maxDpr
    else if (fps < target * 0.85 && a.dpr > lo) a.dpr = Math.max(lo, a.dpr - 0.15)
    else if (fps > target * 1.08 && a.dpr < maxDpr) a.dpr = Math.min(maxDpr, a.dpr + 0.1)
    else if (fps < target * 0.6 && a.dpr <= lo) a.lowStreak++
    if (Math.abs(gl.getPixelRatio() - a.dpr) > 0.01) setDpr(a.dpr)
    perfStats.dpr = a.dpr
    if (quality === 'auto' && a.lowStreak >= 3) {
      a.lowStreak = 0
      const order = ['low', 'medium', 'high', 'ultra'] as const
      const i = order.indexOf(resolved)
      if (i > 0) useApp.getState().set({ resolvedQuality: order[i - 1] })
    }
  })
  return null
}

/** Renderer statistics & rough GPU memory estimate for the performance monitor. */
function PerfProbe() {
  const { gl, scene } = useThree()
  const t = useRef(0)
  useEffect(() => {
    gl.info.autoReset = false
  }, [gl])
  useFrame(() => {
    perfStats.calls = gl.info.render.calls
    perfStats.triangles = gl.info.render.triangles
    perfStats.points = gl.info.render.points
    perfStats.lines = gl.info.render.lines
    gl.info.reset()
    t.current++
    if (t.current % 60 !== 0 || !useApp.getState().showStats) return
    let bytes = 0
    const seenGeo = new Set<THREE.BufferGeometry>()
    const seenTex = new Set<THREE.Texture>()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry && !seenGeo.has(m.geometry)) {
        seenGeo.add(m.geometry)
        for (const k in m.geometry.attributes) bytes += (m.geometry.attributes[k] as THREE.BufferAttribute).array?.byteLength ?? 0
        if (m.geometry.index) bytes += m.geometry.index.array.byteLength
      }
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
      for (const mat of mats) {
        for (const v of Object.values(mat as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) seenTex.add(v)
        const u = (mat as THREE.ShaderMaterial).uniforms
        if (u) for (const un of Object.values(u)) if (un?.value instanceof THREE.Texture) seenTex.add(un.value)
      }
    })
    seenTex.forEach((tx) => {
      const img = tx.image as { width?: number; height?: number } | undefined
      const w = img?.width ?? 0, h = img?.height ?? 0
      bytes += w * h * 4 * 1.33 * (tx instanceof THREE.CubeTexture ? 6 : 1)
    })
    perfStats.geometries = gl.info.memory.geometries
    perfStats.textures = gl.info.memory.textures
    perfStats.gpuMemMB = bytes / 1048576
    perfStats.activeObjects = liveObjects.size
    perfStats.procedural = procCount()
  }, 100)
  return null
}

function CaptureBridge({ composer }: { composer: React.RefObject<ECImpl | null> }) {
  const { gl, size } = useThree()
  useEffect(() => {
    setCaptureHandler(async (scale: number) => {
      const c = composer.current
      const prev = gl.getPixelRatio()
      const maxDim = Math.min(gl.capabilities.maxTextureSize, 8192)
      const target = Math.min(scale * (window.devicePixelRatio || 1), maxDim / Math.max(size.width, size.height))
      gl.setPixelRatio(target)
      gl.setSize(size.width, size.height, false)
      c?.setSize(size.width, size.height)
      c?.render(0)
      const url = gl.domElement.toDataURL('image/png')
      gl.setPixelRatio(prev)
      gl.setSize(size.width, size.height, false)
      c?.setSize(size.width, size.height)
      return { url, width: Math.round(size.width * target), height: Math.round(size.height * target) }
    })
    return () => setCaptureHandler(null)
  }, [gl, size, composer])
  return null
}

function PostFX() {
  const q = QUALITY[useApp((s) => s.resolvedQuality)]
  const warp = useMemo(() => new WarpEffect(), [])
  const composer = useRef<ECImpl>(null)
  useEffect(() => () => warp.dispose(), [warp])
  return (
    <>
      <EffectComposer ref={composer} multisampling={0} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.0} luminanceSmoothing={0.3} radius={0.7} levels={q.bloomLevels} />
        <primitive object={warp} />
        <Vignette offset={0.32} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {q.smaa ? <SMAA /> : <></>}
      </EffectComposer>
      <CaptureBridge composer={composer} />
    </>
  )
}

if (import.meta.env.DEV) (window as unknown as { __advance: typeof advance }).__advance = advance

export function Stage() {
  const resolved = useApp((s) => s.resolvedQuality)
  const q = QUALITY[resolved]
  return (
    <Canvas
      className="astr-canvas"
      flat
      dpr={q.dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, depth: true, preserveDrawingBuffer: false }}
      camera={{ fov: 50, near: 0.05, far: 4e5, position: [0, 80, 260] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#010108', 1)
        gl.outputColorSpace = THREE.SRGBColorSpace
        // GPU reset / driver crash: tell the user and rebuild once the context comes back
        const c = gl.domElement
        c.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          toast(useApp.getState().lang === 'zh' ? '顯示卡內容遺失，正在恢復…' : 'Graphics context lost — restoring…')
        })
        c.addEventListener('webglcontextrestored', () => location.reload())
      }}
      onPointerMissed={(e) => {
        if ((e as MouseEvent).button === 0) useApp.getState().set({ hoveredId: null })
      }}
    >
      <SimDriver />
      <CameraController />
      <LabelProjector />
      <Suspense fallback={null}>
        <SceneRouter />
      </Suspense>
      <PostFX />
      <AdaptivePerformance />
      <PerfProbe />
    </Canvas>
  )
}
