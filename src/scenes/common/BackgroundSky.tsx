import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE } from '../../shaders/noise'
import { simClock } from '../../core/time/SimulationClock'
import { OBLIQUITY_J2000 } from '../../core/coords/UniverseCoordinateSystem'
import { mulberry32 } from '../../core/procedural/rng'
import { kelvinToRgb } from '../../core/data/stars'

/**
 * Background sky rendered at infinity (depth-independent):
 *  - a procedural Milky Way band aligned with true galactic coordinates (for scenes inside the Galaxy)
 *  - a GPU point field of faint background stars (simulated distribution, concentrated to the galactic plane)
 */
export type SkyFrame = 'galactic' | 'ecliptic' | 'equatorial'

// three (y-up) -> physical z-up, then to galactic
function frameToGalactic(frame: SkyFrame): THREE.Matrix3 {
  const toPhys = new THREE.Matrix3().set(1, 0, 0, 0, 0, -1, 0, 1, 0)
  const eqToGal = new THREE.Matrix3().set(
    -0.0548755604162154, -0.873437090234885, -0.4838350155487132,
    0.4941094278755837, -0.4448296299600112, 0.7469822444972189,
    -0.8676661490190047, -0.1980763734312015, 0.4559837761750669,
  )
  const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000)
  const eclToEq = new THREE.Matrix3().set(1, 0, 0, 0, c, -s, 0, s, c)
  const m = new THREE.Matrix3()
  if (frame === 'galactic') m.identity()
  else if (frame === 'equatorial') m.copy(eqToGal)
  else m.multiplyMatrices(eqToGal, eclToEq)
  return m.multiply(toPhys)
}

const bandVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w*0.99999, p.w);
}
`
const bandFrag = /* glsl */ `
${NOISE}
uniform mat3 uToGal;
uniform float uIntensity;
uniform float uBand;
uniform float uTime;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 g = normalize(uToGal * d);          // galactic cartesian: x→GC, y→l=90, z→NGP
  float b = asin(clamp(g.z,-1.0,1.0));
  float l = atan(g.y, g.x);
  float cosl = cos(l);
  // disk thickness flares away from the center, bulge brightens toward l=0
  float width = 0.075 + 0.05*(1.0-cosl);
  float disk = exp(-abs(b)/width);
  float bulge = exp(-(b*b)/0.045 - (l*l)/0.22) * 1.6;
  float n = fbm(g*3.2, 6);
  float n2 = fbm(g*9.0 + 3.0, 5);
  float clumps = 0.55 + 0.45*n + 0.25*n2;
  // dark dust lanes hugging the plane (Great Rift)
  float lane = smoothstep(0.02, 0.26, fbm(g*5.0 + vec3(0.0,2.0,0.0), 5)*0.5+0.5);
  float rift = 1.0 - 0.85*exp(-abs(b+0.012)/0.03) * (1.0-lane) * (0.6+0.4*cosl);
  float lum = (disk*clumps + bulge) * rift;
  vec3 warm = vec3(1.0, 0.86, 0.68);
  vec3 cool = vec3(0.72, 0.8, 1.0);
  vec3 col = mix(cool, warm, clamp(bulge*0.8 + 0.25*cosl + 0.2, 0.0, 1.0)) * lum;
  // faint H-alpha glow in star-forming patches
  float ha = smoothstep(0.55, 0.9, n2*0.5+0.5) * disk;
  col += vec3(0.9, 0.25, 0.4) * ha * 0.18;
  // very faint large-scale interstellar haze (keeps the black from being flat)
  float haze = fbm(d*1.3 + 11.0, 4)*0.5+0.5;
  vec3 hazeCol = mix(vec3(0.035,0.02,0.07), vec3(0.01,0.03,0.06), haze);
  col = col * 0.16 * uBand + hazeCol * 0.12 * uIntensity;
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`

const starVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w*0.99999, p.w);
  float tw = 0.82 + 0.18*sin(uTime*(1.3+aPhase*2.0) + aPhase*40.0);
  gl_PointSize = max(1.0, aSize * uPixelRatio * uScale);
  vColor = aColor;
  vAlpha = tw * clamp(aSize*0.6, 0.15, 1.0);
}
`
const starFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float core = exp(-r*r*38.0);
  float halo = exp(-r*9.0) * 0.25;
  float a = (core + halo) * vAlpha;
  if(a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
}
`

export function BackgroundSky({ frame = 'galactic', band = true, starCount = 20000, intensity = 1, starScale = 1, starsOnly = false }: { frame?: SkyFrame; band?: boolean; starCount?: number; intensity?: number; starScale?: number; starsOnly?: boolean }) {
  const toGal = useMemo(() => frameToGalactic(frame), [frame])
  const bandMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: bandVert,
        fragmentShader: bandFrag,
        uniforms: { uToGal: { value: toGal }, uIntensity: { value: intensity }, uBand: { value: band ? 1 : 0 }, uTime: { value: 0 } },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
      }),
    [toGal, intensity, band],
  )
  const bandGeo = useMemo(() => new THREE.SphereGeometry(10, 64, 32), [])

  const { geo, mat } = useMemo(() => {
    const rnd = mulberry32(90210)
    const pos = new Float32Array(starCount * 3)
    const col = new Float32Array(starCount * 3)
    const size = new Float32Array(starCount)
    const phase = new Float32Array(starCount)
    const galToFrame = toGal.clone().invert()
    const v = new THREE.Vector3()
    let i = 0
    while (i < starCount) {
      // random direction in galactic frame, concentrated toward plane when band enabled
      const u = rnd() * 2 - 1
      const th = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      v.set(s * Math.cos(th), s * Math.sin(th), u)
      if (band) {
        const w = 0.25 + 0.75 * Math.exp(-Math.abs(u) / 0.18)
        if (rnd() > w) continue
      }
      v.applyMatrix3(galToFrame).normalize().multiplyScalar(10)
      pos.set([v.x, v.y, v.z], i * 3)
      // magnitude distribution: many faint, few bright
      const m = Math.pow(rnd(), 5.5)
      size[i] = 0.9 + m * 3.6
      const t = 2800 + Math.pow(rnd(), 1.6) * 16000
      const [r, g, b] = kelvinToRgb(t)
      const bright = 0.35 + m * 1.9
      col.set([r * bright, g * bright, b * bright], i * 3)
      phase[i] = rnd()
      i++
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    const mat = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uScale: { value: starScale } },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [starCount, toGal, band, starScale])

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
      bandMat.dispose()
      bandGeo.dispose()
    },
    [geo, mat, bandMat, bandGeo],
  )

  useFrame(({ gl }) => {
    mat.uniforms.uTime.value = simClock.anim
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })

  return (
    <group>
      {!starsOnly && <mesh geometry={bandGeo} material={bandMat} renderOrder={-1000} frustumCulled={false} />}
      <points geometry={geo} material={mat} renderOrder={-999} frustumCulled={false} />
    </group>
  )
}
