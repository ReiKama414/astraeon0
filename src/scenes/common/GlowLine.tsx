import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { simClock } from '../../core/time/SimulationClock'

/**
 * Screen-space ribbon line with a soft luminous profile.
 *  - `mode="trail"`: closed path whose brightness decays behind a moving head (orbits)
 *  - `mode="segments"`: independent segments with feathered, gapped ends (constellation figures)
 */
const vert = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aT;
uniform vec2 uResolution;
uniform float uWidth;
varying float vT;
varying float vSide;
varying float vDepthFade;
void main(){
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c = mvp * vec4(position, 1.0);
  vec4 p = mvp * vec4(aPrev, 1.0);
  vec4 n = mvp * vec4(aNext, 1.0);
  float aspect = uResolution.x / uResolution.y;
  vec2 sc = c.xy / max(c.w, 1e-5); sc.x *= aspect;
  vec2 sp = p.xy / max(p.w, 1e-5); sp.x *= aspect;
  vec2 sn = n.xy / max(n.w, 1e-5); sn.x *= aspect;
  vec2 d = sn - sp;
  if (dot(d, d) < 1e-10) d = vec2(1.0, 0.0);
  vec2 dir = normalize(d);
  vec2 nrm = vec2(-dir.y, dir.x);
  nrm.x /= aspect;
  c.xy += nrm * aSide * uWidth / uResolution.y * c.w;
  gl_Position = c;
  vT = aT;
  vSide = aSide;
  vDepthFade = 1.0;
}
`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uMode;      // 0 trail, 1 segments
uniform float uHead;
uniform float uTrailLen;
uniform float uTime;
varying float vT;
varying float vSide;
void main(){
  // luminous profile: bright hairline core + soft halo
  float x = abs(vSide);
  float profile = exp(-x * x * 18.0) * 0.9 + exp(-x * x * 2.6) * 0.35;
  float a = profile * uOpacity;
  if (uMode < 0.5) {
    float behind = fract(uHead - vT);           // 0 at the body, grows backwards along the orbit
    float trail = exp(-behind * uTrailLen);
    a *= 0.12 + 0.88 * trail;
    a *= 1.0 + 1.4 * exp(-behind * uTrailLen * 6.0); // brighter just behind the body
  } else {
    float ends = smoothstep(0.06, 0.2, vT) * (1.0 - smoothstep(0.8, 0.94, vT));
    a *= ends * (0.82 + 0.18 * sin(uTime * 0.9 + vT * 9.0));
  }
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`

function buildStrip(points: THREE.Vector3[], closed: boolean) {
  const pts = closed ? [...points, points[0]] : points
  const n = pts.length
  const pos = new Float32Array(n * 2 * 3)
  const prev = new Float32Array(n * 2 * 3)
  const next = new Float32Array(n * 2 * 3)
  const side = new Float32Array(n * 2)
  const t = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const pp = pts[Math.max(0, i - 1)]
    const pn = pts[Math.min(n - 1, i + 1)]
    for (let s = 0; s < 2; s++) {
      const k = i * 2 + s
      pos.set([p.x, p.y, p.z], k * 3)
      prev.set([pp.x, pp.y, pp.z], k * 3)
      next.set([pn.x, pn.y, pn.z], k * 3)
      side[k] = s === 0 ? -1 : 1
      t[k] = i / (n - 1)
    }
  }
  const index: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  return { pos, prev, next, side, t, index }
}

function buildGeometry(paths: THREE.Vector3[][], closed: boolean) {
  const parts = paths.map((p) => buildStrip(p, closed))
  const total = parts.reduce((s, p) => s + p.side.length, 0)
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array(total * 3), prev = new Float32Array(total * 3), next = new Float32Array(total * 3)
  const side = new Float32Array(total), t = new Float32Array(total)
  const index: number[] = []
  let o = 0
  for (const p of parts) {
    pos.set(p.pos, o * 3)
    prev.set(p.prev, o * 3)
    next.set(p.next, o * 3)
    side.set(p.side, o)
    t.set(p.t, o)
    for (const i of p.index) index.push(i + o)
    o += p.side.length
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3))
  g.setAttribute('aNext', new THREE.BufferAttribute(next, 3))
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
  g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

export interface GlowLineProps {
  paths: THREE.Vector3[][]
  mode: 'trail' | 'segments'
  color?: string
  width?: number
  opacity?: number
  trailLength?: number
  /** returns 0..1 position of the moving head along the path (trail mode) */
  head?: () => number
  /** optional per-frame opacity multiplier */
  fade?: () => number
  renderOrder?: number
}

export function GlowLine({ paths, mode, color = '#cfd8ff', width = 3, opacity = 0.5, trailLength = 5, head, fade, renderOrder = 3 }: GlowLineProps) {
  const geo = useMemo(() => buildGeometry(paths, mode === 'trail'), [paths, mode])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uResolution: { value: new THREE.Vector2(1, 1) },
          uWidth: { value: width },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uMode: { value: mode === 'trail' ? 0 : 1 },
          uHead: { value: 0 },
          uTrailLen: { value: trailLength },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [color, width, opacity, mode, trailLength],
  )
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const cur = useRef(opacity)
  useFrame(({ size, gl }) => {
    const pr = gl.getPixelRatio()
    mat.uniforms.uResolution.value.set(size.width * pr, size.height * pr)
    mat.uniforms.uWidth.value = width * pr
    mat.uniforms.uTime.value = simClock.anim
    if (head) mat.uniforms.uHead.value = head()
    const target = opacity * (fade ? fade() : 1)
    cur.current += (target - cur.current) * 0.12
    mat.uniforms.uOpacity.value = cur.current
  })
  return <mesh geometry={geo} material={mat} renderOrder={renderOrder} frustumCulled={false} />
}
