import { Effect, BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { rig } from './cameraRig'

const frag = /* glsl */ `
uniform float uWarp;
uniform float uFade;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 dir = uv - 0.5;
  float len = length(dir);
  vec3 acc = inputColor.rgb;
  float total = 1.0;
  if(uWarp > 0.001){
    // radial zoom blur: light streaks outward from the vanishing point
    for(int i=1;i<=14;i++){
      float t = float(i)/14.0;
      float w = 1.0 - t*0.6;
      acc += texture2D(inputBuffer, uv - dir * t * uWarp * 0.28 * len * 2.0).rgb * w;
      total += w;
    }
    acc /= total;
    acc *= 1.0 + uWarp * 0.9 * smoothstep(0.1, 0.7, len);
    // subtle chromatic tint at the edges
    acc += vec3(0.25, 0.3, 0.6) * uWarp * uWarp * smoothstep(0.35, 0.8, len) * 0.35;
  }
  vec3 fadeCol = mix(vec3(0.0), vec3(0.9, 0.92, 1.0), 0.18);
  acc = mix(acc, fadeCol, clamp(uFade, 0.0, 1.0));
  outputColor = vec4(acc, inputColor.a);
}
`

/** Hyperspace-style radial blur + fade that masks reference-frame switches between scales. */
export class WarpEffect extends Effect {
  constructor() {
    super('WarpEffect', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uWarp', new THREE.Uniform(0)],
        ['uFade', new THREE.Uniform(0)],
      ]),
    })
  }
  update() {
    this.uniforms.get('uWarp')!.value = rig.warp
    this.uniforms.get('uFade')!.value = rig.fade
  }
}
