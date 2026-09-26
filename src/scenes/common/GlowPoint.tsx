import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const geo = new THREE.BufferGeometry()
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3))
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1)

const vert = /* glsl */ `
uniform float uSize;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uPixelRatio;
uniform float uViewportH;
varying float vBoost;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  float px = uSize * projectionMatrix[1][1] * uViewportH * 0.5 / max(1e-4,-mv.z);
  vBoost = clamp(px / uMinPx, 0.35, 1.0);
  gl_PointSize = clamp(px, uMinPx, uMaxPx) * uPixelRatio;
}
`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uSpikes;
varying float vBoost;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float r = length(c);
  float core = exp(-r*r*120.0);
  float halo = exp(-r*9.0)*0.55;
  float sp = uSpikes * (exp(-abs(c.x)*90.0)*exp(-abs(c.y)*6.0) + exp(-abs(c.y)*90.0)*exp(-abs(c.x)*6.0)) * 0.6;
  float a = (core*1.6 + halo + sp) * (1.0 - smoothstep(0.3, 0.5,r));
  gl_FragColor = vec4(uColor * a * uIntensity * vBoost, 1.0);
}
`

/** Screen-space glowing point with a minimum pixel size — for stars and distant markers. */
export function GlowPoint({ color = '#ffffff', size = 1, minPx = 6, maxPx = 160, intensity = 1, spikes = 0 }: { color?: string; size?: number; minPx?: number; maxPx?: number; intensity?: number; spikes?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uSize: { value: size },
          uMinPx: { value: minPx },
          uMaxPx: { value: maxPx },
          uPixelRatio: { value: 1 },
          uViewportH: { value: 800 },
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: intensity },
          uSpikes: { value: spikes },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color, size, minPx, maxPx, intensity, spikes],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ gl, size: s }) => {
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    mat.uniforms.uViewportH.value = s.height
  })
  return <points geometry={geo} material={mat} renderOrder={5} />
}
