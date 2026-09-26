import * as THREE from 'three'
import type { PlanetVisual } from '../../core/registry/types'
import { bakeFrag, bakeVert, SURFACE_IDS } from './bakeShader'

export interface BakedPlanet {
  albedo: THREE.Texture
  data: THREE.Texture
  clouds: THREE.Texture | null
  dispose: () => void
}

interface Entry {
  baked: BakedPlanet
  refs: number
  targets: THREE.WebGLRenderTarget[]
}

const cache = new Map<string, Entry>()
// render-target textures live in one WebGL context, so caches are per renderer
const rendererIds = new WeakMap<THREE.WebGLRenderer, number>()
let nextRendererId = 1
function rid(gl: THREE.WebGLRenderer) {
  let id = rendererIds.get(gl)
  if (!id) rendererIds.set(gl, (id = nextRendererId++))
  return id
}
let quad: THREE.Mesh | null = null
let material: THREE.ShaderMaterial | null = null
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const scene = new THREE.Scene()
const blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
blankTex.needsUpdate = true

function ensure() {
  if (quad && material) return
  material = new THREE.ShaderMaterial({
    vertexShader: bakeVert,
    fragmentShader: bakeFrag,
    uniforms: {
      uSurface: { value: 0 },
      uPass: { value: 0 },
      uSeed: { value: 0 },
      uPal0: { value: new THREE.Color() },
      uPal1: { value: new THREE.Color() },
      uPal2: { value: new THREE.Color() },
      uPal3: { value: new THREE.Color() },
      uPal4: { value: new THREE.Color() },
      uBands: { value: 10 },
      uTurb: { value: 1 },
      uStorm: { value: new THREE.Vector4() },
      uStormColor: { value: new THREE.Color() },
      uCraters: { value: 0 },
      uPolar: { value: 0 },
      uLandMask: { value: blankTex },
      uHasLand: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  })
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)
}

function linearColor(hex: string) {
  // palette authored in sRGB → linear; the albedo target is SRGB8_ALPHA8 so the GPU re-encodes on write
  return new THREE.Color().setStyle(hex, THREE.SRGBColorSpace)
}

function bakeKey(v: PlanetVisual, size: number, land: boolean) {
  return `${v.surface}:${v.seed}:${v.palette.join(',')}:${size}:${land ? 1 : 0}:${v.bands ?? 0}:${v.turbulence ?? 1}:${v.clouds ? 1 : 0}`
}

/**
 * GPU-bakes equirectangular albedo / data / cloud maps for a planet, cached and ref-counted:
 * identical planets (same seed + params) share textures, released when the last user disposes.
 */
export function bakePlanet(gl: THREE.WebGLRenderer, v: PlanetVisual, size: number, landMask?: THREE.Texture | null): BakedPlanet {
  const key = `${rid(gl)}|${bakeKey(v, size, !!landMask)}`
  const hit = cache.get(key)
  if (hit) {
    hit.refs++
    return hit.baked
  }
  ensure()
  const m = material!
  const u = m.uniforms
  u.uSurface.value = SURFACE_IDS[v.surface] ?? 0
  u.uSeed.value = (v.seed % 1000) + 0.5
  const pal = [...v.palette]
  while (pal.length < 5) pal.push(pal[pal.length - 1] ?? '#888888')
  ;[u.uPal0, u.uPal1, u.uPal2, u.uPal3, u.uPal4].forEach((un, i) => un.value.copy(linearColor(pal[i])))
  u.uBands.value = v.bands ?? 10
  u.uTurb.value = v.turbulence ?? 1
  if (v.storm) {
    u.uStorm.value.set((v.storm.lat * Math.PI) / 180, (((v.storm.lon + 180) % 360) - 180) * (Math.PI / 180), v.storm.size, 1)
    u.uStormColor.value.copy(linearColor(v.storm.color))
  } else u.uStorm.value.set(0, 0, 0, 0)
  u.uCraters.value = v.craters ?? 0
  u.uPolar.value = v.polarCaps ?? 0
  u.uLandMask.value = landMask ?? blankTex
  u.uHasLand.value = landMask ? 1 : 0

  const prevTarget = gl.getRenderTarget()
  const prevAutoClear = gl.autoClear
  gl.autoClear = true
  const targets: THREE.WebGLRenderTarget[] = []
  const passes = v.clouds ? [0, 1, 2] : [0, 1]
  const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
  for (const p of passes) {
    const w = p === 1 ? size / 2 : size
    const rt = new THREE.WebGLRenderTarget(w, w / 2, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      depthBuffer: false,
    })
    rt.texture.anisotropy = aniso
    if (p === 0) rt.texture.colorSpace = THREE.SRGBColorSpace
    u.uPass.value = p
    gl.setRenderTarget(rt)
    gl.render(scene, cam)
    targets.push(rt)
  }
  gl.setRenderTarget(prevTarget)
  gl.autoClear = prevAutoClear

  const baked: BakedPlanet = {
    albedo: targets[0].texture,
    data: targets[1].texture,
    clouds: targets[2]?.texture ?? null,
    dispose: () => {
      const e = cache.get(key)
      if (!e) return
      e.refs--
      if (e.refs <= 0) {
        e.targets.forEach((t) => t.dispose())
        cache.delete(key)
      }
    },
  }
  cache.set(key, { baked, refs: 1, targets })
  return baked
}

export function bakedTextureCount() {
  return cache.size
}
