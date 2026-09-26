import * as THREE from 'three'

/**
 * Remote texture pipeline: CORS-safe fetch → persistent Cache Storage → off-main-thread decode
 * (createImageBitmap, downscaled to the device's texture budget) → GPU upload.
 * Textures must be CORS-enabled so photo-mode screenshots stay untainted.
 */
const BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/'

export const EARTH_TEXTURES = {
  day: BASE + 'earth_day_4096.jpg',
  night: BASE + 'earth_night_4096.jpg',
  bumpRoughClouds: BASE + 'earth_bump_roughness_clouds_4096.jpg',
}
export const MOON_TEXTURE = BASE + 'moon_1024.jpg'

export const TEXTURE_CREDITS = [
  { what: 'Earth day / night / relief & clouds maps', who: 'Solar System Scope (based on NASA imagery), via three.js examples', license: 'CC BY 4.0', url: 'https://www.solarsystemscope.com/textures/' },
  { what: 'Moon map', who: 'NASA LRO-derived imagery via three.js examples', license: 'Public domain (NASA) / MIT distribution', url: 'https://svs.gsfc.nasa.gov/cgi-bin/details.cgi?aid=4720' },
  { what: 'Coastline fallback (offline Earth)', who: 'Natural Earth via world-atlas', license: 'Public domain', url: 'https://www.naturalearthdata.com/' },
  { what: 'All other planets, moons, galaxies, nebulae, black holes', who: 'ASTRALIS procedural shaders', license: 'Original', url: '' },
]

const CACHE_NAME = 'astralis-assets-v1'

async function fetchWithCache(url: string): Promise<Blob> {
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME)
      const hit = await cache.match(url)
      if (hit) return await hit.blob()
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      cache.put(url, res.clone()).catch(() => {})
      return await res.blob()
    }
  } catch (e) {
    if (!(e instanceof DOMException)) throw e
  }
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

export async function loadRemoteTexture(url: string, { srgb, maxWidth }: { srgb: boolean; maxWidth: number }): Promise<THREE.Texture> {
  const blob = await fetchWithCache(url)
  let bmp: ImageBitmap
  try {
    const probe = await createImageBitmap(blob)
    const w = Math.min(probe.width, maxWidth)
    const h = Math.round((probe.height * w) / probe.width)
    if (w !== probe.width) {
      probe.close()
      bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
    } else {
      probe.close()
      bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' })
    }
  } catch {
    // Safari < 15 fallback
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = URL.createObjectURL(blob)
    await img.decode()
    const t = new THREE.Texture(img)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }
  const tex = new THREE.Texture(bmp as unknown as HTMLImageElement)
  tex.flipY = false
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.needsUpdate = true
  return tex
}
