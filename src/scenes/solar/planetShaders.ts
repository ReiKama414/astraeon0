import { NOISE } from '../../shaders/noise'

/** Atmospheric limb scattering shell (rendered BackSide, additive). Physically-motivated approximation. */
export const atmoVert = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
export const atmoFrag = /* glsl */ `
uniform vec3 uSunPos;
uniform vec3 uCenter;
uniform float uR;
uniform float uRa;
uniform vec3 uColor;
uniform vec3 uSunset;
uniform float uDensity;
varying vec3 vWorld;
void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec3 oc = uCenter - ro;
  float tca = dot(oc, rd);
  vec3 closest = ro + rd*max(tca, 0.0);
  float h = length(closest - uCenter);
  // rays that hit the solid body are shaded by the surface shader's own limb haze
  if(h < uR) discard;
  float x = clamp((h - uR) / (uRa - uR), 0.0, 1.0);
  // optical depth grows toward the limb; fade to zero at shell edge
  float dens = exp(-x*5.0) * (1.0 - smoothstep(0.75, 1.0, x));
  vec3 n = normalize(closest - uCenter);
  vec3 L = normalize(uSunPos - closest);
  float mu = dot(n, L);
  float light = smoothstep(-0.28, 0.25, mu);
  float fwd = pow(max(dot(rd, L), 0.0), 6.0);
  vec3 col = mix(uSunset, uColor, smoothstep(-0.08, 0.35, mu));
  col *= dens * light * uDensity * (1.2 + 2.5*fwd);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

/** Injected into MeshStandardMaterial for baked planets: emissive cracks, limb haze, ring shadows. */
export const standardPatch = {
  uniforms: /* glsl */ `
uniform sampler2D uData;
uniform vec3 uEmissiveTint;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform vec3 uSunWorld;
uniform vec3 uCenterWorld;
uniform vec3 uRingNormal;
uniform vec2 uRingRadii;
uniform float uRingOpacity;
varying vec3 vWorldP;
varying vec2 vPlanetUv;
`,
  vertex: /* glsl */ `
varying vec3 vWorldP;
varying vec2 vPlanetUv;
`,
  vertexMain: /* glsl */ `
vWorldP = (modelMatrix * vec4(transformed,1.0)).xyz;
vPlanetUv = uv;
`,
  fragment: /* glsl */ `
  {
    float em = texture2D(uData, vPlanetUv).b;
    vec3 Ls = normalize(uSunWorld - vWorldP);
    vec3 Nw = normalize(vWorldP - uCenterWorld);
    float night = (1.0 - smoothstep(-0.2, 0.1, dot(Nw, Ls)));
    totalEmissiveRadiance += uEmissiveTint * em * (0.08 + 0.92*night) * 2.2;
    // ring shadow: ray toward the Sun crosses the ring plane inside the ring annulus
    if(uRingOpacity > 0.0){
      float denom = dot(Ls, uRingNormal);
      if(abs(denom) > 1e-4){
        float t = dot(uCenterWorld - vWorldP, uRingNormal) / denom;
        if(t > 0.0){
          float r = length(vWorldP + Ls*t - uCenterWorld);
          float inRing = smoothstep(uRingRadii.x, uRingRadii.x*1.03, r) * (1.0 - smoothstep(uRingRadii.y*0.98, uRingRadii.y, r));
          float cassini = 1.0 - 0.8*(1.0 - smoothstep(0.0, 0.012,abs(r/uRingRadii.x - 1.60)));
          reflectedLight.directDiffuse *= 1.0 - inRing * uRingOpacity * 0.65 * cassini;
        }
      }
    }
  }
`,
  fragmentEnd: /* glsl */ `
  {
    vec3 Vv = normalize(cameraPosition - vWorldP);
    vec3 Nw2 = normalize(vWorldP - uCenterWorld);
    vec3 Ls2 = normalize(uSunWorld - vWorldP);
    float fres = pow(1.0 - max(dot(Nw2, Vv), 0.0), 3.0);
    float lit = smoothstep(-0.15, 0.4, dot(Nw2, Ls2));
    gl_FragColor.rgb += uRimColor * fres * lit * uRimStrength;
  }
`,
}

/** Earth: day/night blend, city lights, ocean glint, bump-mapped relief, cloud shadows, limb haze. */
export const earthVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vUpW;
void main(){
  vUv = uv;
  vUpW = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  vObjN = normalize(position);
  vec4 w = modelMatrix * vec4(position,1.0);
  vWorld = w.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
export const earthFrag = /* glsl */ `
${NOISE}
uniform float uDetail;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uBRC;       // r bump, g roughness, b clouds
uniform float uHasTextures;
uniform sampler2D uFallbackAlbedo;
uniform sampler2D uFallbackData;
uniform sampler2D uFallbackClouds;
uniform vec3 uSunWorld;
uniform vec3 uCenter;
uniform float uCloudShift;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vUpW;

// close range: tent-filter the source JPEGs so 8×8 compression blocks don't show
vec4 soft(sampler2D t, vec2 uv){
  if (uDetail < 0.01) return texture2D(t, uv);
  vec2 o = uTexel * 1.6 * uDetail;
  vec4 c = texture2D(t, uv) * 0.36;
  c += texture2D(t, uv + vec2(o.x, o.y)) * 0.16;
  c += texture2D(t, uv + vec2(-o.x, o.y)) * 0.16;
  c += texture2D(t, uv + vec2(o.x, -o.y)) * 0.16;
  c += texture2D(t, uv + vec2(-o.x, -o.y)) * 0.16;
  return c;
}
float heightAt(vec2 uv){ return uHasTextures > 0.5 ? texture2D(uBRC, uv).r : texture2D(uFallbackData, uv).r; }

void main(){
  vec3 N0 = normalize(vWorldN);
  // tangent frame on the sphere (east / north) in world space
  vec3 upW = normalize(vUpW);
  vec3 east = normalize(cross(upW, N0) + 1e-5);
  vec3 north = cross(N0, east);
  float h = heightAt(vUv);
  float hx = heightAt(vUv + vec2(uTexel.x, 0.0));
  float hy = heightAt(vUv + vec2(0.0, uTexel.y));
  float bumpK = uHasTextures > 0.5 ? 2.2 : 3.0;
  vec3 N = normalize(N0 - (east*(hx-h) + north*(hy-h)) * bumpK * 8.0);
  // close-range micro relief: multi-octave noise fades in at low altitude
  float micro = 0.0;
  if (uDetail > 0.001) {
    vec3 q = vObjN * 900.0;
    micro = snoise(q) * 0.5 + snoise(q * 3.1) * 0.25 + snoise(q * 9.7) * 0.125;
    float mx = snoise(q + vec3(0.37, 0.0, 0.0)) - snoise(q);
    float my = snoise(q + vec3(0.0, 0.0, 0.37)) - snoise(q);
    N = normalize(N - (east * mx + north * my) * 0.18 * uDetail);
  }

  vec3 L = normalize(uSunWorld - vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float NdL0 = dot(N0, L);
  float NdL = dot(N, L);

  vec3 day, night;
  float rough, cloudHere, cloudShadow;
  vec2 cuv = vec2(vUv.x + uCloudShift, vUv.y);
  // shadow: sample clouds displaced toward the sun along the surface
  vec2 sunOff = vec2(dot(L, east), dot(L, north)) * 0.0025;
  if(uHasTextures > 0.5){
    day = soft(uDay, vUv).rgb;
    night = soft(uNight, vUv).rgb;
    vec3 brc = soft(uBRC, vUv).rgb;
    rough = brc.g;
    cloudHere = soft(uBRC, cuv).b;
    cloudShadow = soft(uBRC, cuv - sunOff).b;
  } else {
    day = texture2D(uFallbackAlbedo, vUv).rgb;
    vec4 dt = texture2D(uFallbackData, vUv);
    rough = dt.g;
    float landMask = step(0.52, dt.r);
    night = vec3(1.0,0.75,0.45) * landMask * dt.b;
    cloudHere = texture2D(uFallbackClouds, cuv).r;
    cloudShadow = texture2D(uFallbackClouds, cuv - sunOff).r;
  }
  float ocean = (1.0 - smoothstep(0.35, 0.55, rough));
  day *= 1.0 + micro * 0.2 * uDetail * (1.0 - ocean);
  night *= 1.0 + micro * 0.5 * uDetail;
  float wrap = smoothstep(-0.12, 0.35, NdL0);
  float diff = max(NdL, 0.0) * 0.85 + 0.15 * wrap;
  diff *= 1.0 - cloudShadow * 0.55;
  vec3 col = day * diff * 0.92;
  // ocean specular glint (Blinn-Phong with roughness)
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N0, H), 0.0), mix(60.0, 420.0, ocean)) * ocean * (1.0 - cloudHere) * step(0.0, NdL0);
  col += vec3(1.0, 0.92, 0.8) * spec * 0.55;
  // night side: city lights fade through twilight
  float nightMask = (1.0 - smoothstep(-0.18, 0.08, NdL0));
  col += night * nightMask * vec3(1.0, 0.82, 0.58) * 1.6 * (1.0 - cloudHere*0.7);
  // atmospheric limb haze
  float fres = pow(1.0 - max(dot(N0, V), 0.0), 2.4);
  float twilight = smoothstep(-0.25, 0.5, NdL0);
  vec3 sky = mix(vec3(1.0, 0.45, 0.25), vec3(0.35, 0.62, 1.0), smoothstep(-0.05, 0.4, NdL0));
  col = mix(col, sky * twilight * 0.7, fres * 0.4 * twilight);
  col += sky * fres * twilight * 0.06;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export const cloudFrag = /* glsl */ `
uniform sampler2D uClouds;
uniform float uChannel; // 2 = blue (packed BRC), 0 = red
uniform vec3 uSunWorld;
uniform float uOpacity;
uniform vec3 uTint;
uniform float uShift;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vWorldN;
void main(){
  vec2 uv = vec2(vUv.x + uShift, vUv.y);
  vec4 t = texture2D(uClouds, uv);
  float c = uChannel > 1.5 ? t.b : t.r;
  c = smoothstep(0.08, 0.9, c);
  vec3 N = normalize(vWorldN);
  vec3 L = normalize(uSunWorld - vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float NdL = dot(N, L);
  float lit = smoothstep(-0.06, 0.3, NdL);
  // warm tint in the terminator zone
  vec3 tint = mix(vec3(1.0, 0.7, 0.5), uTint, smoothstep(0.02, 0.25, NdL));
  float edge = pow(1.0 - max(dot(N,V),0.0), 3.0);
  float a = c * uOpacity * (1.0 - edge*0.4);
  gl_FragColor = vec4(tint * (lit * 0.95 + 0.006), a);
  #include <colorspace_fragment>
}
`

/** Sun / star photosphere: animated granulation, supergranulation, limb darkening. */
export const sunFrag = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uIntensity;
varying vec3 vObjN;
varying vec3 vWorld;
varying vec3 vWorldN;
void main(){
  vec3 p = normalize(vObjN);
  float t = uTime * 0.05;
  float gran = fbm(p*28.0 + vec3(t, -t*0.7, t*0.3), 5);
  float cells = 1.0 - abs(snoise(p*60.0 + t*2.0));
  float super = fbm(p*6.0 - t*0.2, 4);
  float spots = smoothstep(0.62, 0.72, fbm(p*3.0 + 17.0 + t*0.02, 4)*0.5+0.5) * (1.0 - smoothstep(0.15, 0.75, abs(p.y)));
  float v = gran*0.5 + cells*0.35 + super*0.25;
  vec3 col = mix(uColorC, uColorB, smoothstep(-0.4, 0.6, v));
  col = mix(col, uColorA, smoothstep(0.35, 0.9, v));
  col *= 1.0 - spots*0.75;
  vec3 V = normalize(cameraPosition - vWorld);
  float mu = max(dot(normalize(vWorldN), V), 0.0);
  float limb = 0.35 + 0.65*pow(mu, 0.55);
  gl_FragColor = vec4(col * limb * uIntensity, 1.0);
  #include <colorspace_fragment>
}
`

export const coronaVert = /* glsl */ `
uniform float uScale;
varying vec2 vUv;
void main(){
  vUv = uv*2.0-1.0;
  vec4 mv = modelViewMatrix * vec4(0.0,0.0,0.0,1.0);
  mv.xy += position.xy * uScale;
  gl_Position = projectionMatrix * mv;
}
`
export const coronaFrag = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uColor;
uniform float uCore;
uniform float uIntensity;
varying vec2 vUv;
void main(){
  float r = length(vUv);
  if(r > 1.0) discard;
  float a = atan(vUv.y, vUv.x);
  float streak = fbm(vec3(cos(a)*3.0, sin(a)*3.0, uTime*0.03), 4)*0.5+0.5;
  float rr = max(r - uCore, 0.0) / (1.0 - uCore);
  float glow = exp(-rr*7.0) * (0.55 + 0.9*streak) + exp(-rr*2.2)*0.18;
  glow *= (1.0 - smoothstep(0.7, 1.0, r)) * smoothstep(uCore*0.92, uCore, r);
  gl_FragColor = vec4(uColor * glow * uIntensity, 1.0);
  #include <colorspace_fragment>
}
`

/** Planetary rings: radial density profile, planet shadow, lit/unlit face, forward scattering. */
export const ringVert = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
void main(){
  vLocal = position;
  vec4 w = modelMatrix * vec4(position,1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
export const ringFrag = /* glsl */ `
${NOISE}
uniform float uInner;
uniform float uOuter;
uniform float uPlanetR;
uniform int uKind;          // 0 saturn, 1 uranus, 2 fantasy
uniform vec3 uCol0; uniform vec3 uCol1; uniform vec3 uCol2;
uniform float uOpacity;
uniform vec3 uSunWorld;
uniform vec3 uCenter;
uniform vec3 uNormal;
uniform float uSeed;
varying vec3 vLocal;
varying vec3 vWorld;

float saturnDensity(float x){ // x in planet radii
  float d = 0.0;
  d += smoothstep(1.239,1.26,x)*(1.0-smoothstep(1.51,1.527,x))*0.18;     // C ring
  d += smoothstep(1.52,1.53,x)*(1.0-smoothstep(1.945,1.95,x))*(0.75+0.25*smoothstep(1.6,1.8,x));  // B ring
  d += smoothstep(1.95,1.99,x)*(1.0-smoothstep(2.0,2.025,x))*0.06;       // Cassini division (faint)
  d += smoothstep(2.025,2.03,x)*(1.0-smoothstep(2.26,2.27,x))*0.55;      // A ring
  d *= 1.0 - (1.0-smoothstep(0.0,0.006,abs(x-2.214)))*0.95;               // Encke gap
  d *= 1.0 - (1.0-smoothstep(0.0,0.002,abs(x-2.265)))*0.8;                // Keeler gap
  return d;
}
float uranusDensity(float x){
  float d = 0.0;
  float rings[9] = float[9](1.637,1.652,1.666,1.75,1.786,1.834,1.863,1.900,2.00);
  for(int i=0;i<9;i++){ d += exp(-pow((x-rings[i])/(i==8?0.012:0.004),2.0)) * (i==8?1.0:0.6); }
  return d;
}
void main(){
  float r = length(vLocal.xy);
  float x = r / uPlanetR;
  if(r < uInner || r > uOuter) discard;
  float t = (r - uInner)/(uOuter - uInner);
  float fine = snoise(vec3(x*180.0 + uSeed, 0.0, 0.0))*0.5+0.5;
  float fine2 = snoise(vec3(x*620.0, 1.0, 0.0))*0.5+0.5;
  float dens;
  if(uKind == 0) dens = saturnDensity(x) * (0.72 + 0.28*fine) * (0.85+0.15*fine2);
  else if(uKind == 1) dens = uranusDensity(x);
  else dens = smoothstep(0.0,0.08,t)*(1.0 - smoothstep(0.85, 1.0,t)) * (0.35 + 0.65*smoothstep(0.3,0.7,snoise(vec3(x*14.0+uSeed,2.0,0.0))*0.5+0.5)) * (0.7+0.3*fine);
  vec3 col = mix(uCol0, uCol1, smoothstep(0.2, 0.8, t + (fine-0.5)*0.2));
  col = mix(col, uCol2, (1.0-smoothstep(0.0, 0.3, t))*0.6);
  // shadow cast by the planet
  vec3 L = normalize(uSunWorld - vWorld);
  vec3 oc = vWorld - uCenter;
  float b = dot(oc, L);
  float c = dot(oc, oc) - uPlanetR*uPlanetR;
  float shadow = (b < 0.0 && b*b - c > 0.0) ? 0.04 : 1.0;
  vec3 V = normalize(cameraPosition - vWorld);
  float sunSide = dot(uNormal, L);
  float viewSide = dot(uNormal, V);
  float litFace = sign(sunSide) == sign(viewSide) ? 1.0 : 0.0;
  float fwd = pow(max(dot(-V, L), 0.0), 4.0);
  float light = mix(0.12 + 0.9*fwd*(1.0-dens), 1.0, litFace) * (0.35 + 0.65*abs(sunSide)) * shadow;
  float a = clamp(dens * uOpacity, 0.0, 0.97);
  gl_FragColor = vec4(col * light * 1.15, a);
  #include <colorspace_fragment>
}
`
