import { NOISE, BLACKBODY } from '../../shaders/noise'

/**
 * Visual approximation of a Schwarzschild black hole (units: Rs = 1).
 * Photons are integrated with the classic geodesic-equivalent Newtonian form
 *   d²x/dλ² = −(3/2) h² x / r⁵,  h = |x × v|,
 * which reproduces the photon sphere (r = 1.5), shadow and Einstein-ring lensing of the background.
 * Disk emission: thin disk with T ∝ r^(-3/4)(1−√(rin/r))^(1/4), Doppler beaming and gravitational redshift.
 * This is a visual simulation — not a GR-accurate radiative transfer.
 */
export const bhVert = /* glsl */ `
varying vec2 vNdc;
void main(){
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.99999, 1.0);
}
`

export const bhFrag = (steps: number) => /* glsl */ `
${NOISE}
${BLACKBODY}
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform samplerCube uEnv;
uniform float uTime;
uniform vec3 uDiskN;
uniform float uInner;
uniform float uOuter;
uniform float uTemp;
uniform float uBright;
uniform float uJet;
uniform float uSeed;
varying vec2 vNdc;

vec3 rotateAround(vec3 p, vec3 axis, float a){
  return p*cos(a) + cross(axis,p)*sin(a) + axis*dot(axis,p)*(1.0-cos(a));
}

vec4 diskSample(vec3 p, vec3 rd){
  float r = length(p);
  if(r < uInner || r > uOuter) return vec4(0.0);
  // Keplerian angular velocity (Rs=1 → GM=0.5) drives differential rotation of the texture
  float v = sqrt(0.5 / r);
  float omega = v / r;
  vec3 q = rotateAround(p, uDiskN, -uTime * omega * 0.6);
  // polar-ish noise coordinates on the disk plane
  vec3 t1 = normalize(cross(uDiskN, abs(uDiskN.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0)));
  vec3 t2 = cross(uDiskN, t1);
  vec2 d2 = vec2(dot(q,t1), dot(q,t2));
  float ang = atan(d2.y, d2.x);
  vec3 nc = vec3(d2 * 0.9, r*0.25 + uSeed);
  float streaks = fbm(vec3(cos(ang)*r*0.7, sin(ang)*r*0.7, r*2.2) + vec3(uSeed), 5);
  float clumps = fbm(nc*1.7, 4);
  float dens = 0.55 + 0.35*streaks + 0.35*clumps;
  float edge = smoothstep(uInner, uInner*1.18, r) * (1.0 - smoothstep(uOuter*0.62, uOuter, r));
  float x = uInner / r;
  float T = uTemp * pow(x, 0.75) * pow(max(1.0 - sqrt(x*0.9), 0.02), 0.25) * 1.6;
  // Doppler beaming
  vec3 vdir = normalize(cross(uDiskN, p));
  float cosT = dot(vdir, -rd);
  float gamma = 1.0 / sqrt(1.0 - v*v);
  float delta = 1.0 / (gamma * (1.0 - v * cosT));
  float grav = sqrt(max(1.0 - 1.0/r, 0.05));
  float shift = delta * grav;
  vec3 col = blackbody(clamp(T * shift * 0.55, 1000.0, 40000.0));
  float I = pow(shift, 3.5) * pow(T / uTemp, 2.4) * dens * edge * uBright;
  float alpha = clamp(dens * edge * 1.1, 0.0, 1.0);
  return vec4(col * I * 3.2, alpha);
}

void main(){
  vec4 clip = vec4(vNdc, 1.0, 1.0);
  vec4 view = uInvProj * clip;
  vec3 rd = normalize((uCamWorld * vec4(normalize(view.xyz / view.w), 0.0)).xyz);
  vec3 pos = uCamPos;
  vec3 vel = rd;
  float h2 = dot(cross(pos, vel), cross(pos, vel));
  vec3 acc = vec3(0.0);
  vec4 sum = vec4(0.0);
  bool captured = false;
  float jetGlow = 0.0;
  // skip empty space: jump to the interaction sphere if we start outside it
  float R = max(uOuter * 1.4, 18.0);
  float b = dot(pos, vel);
  float c = dot(pos, pos) - R*R;
  if(c > 0.0){
    float disc = b*b - c;
    if(disc < 0.0 || b > 0.0){
      gl_FragColor = vec4(textureCube(uEnv, rd).rgb, 1.0);
      #include <colorspace_fragment>
      return;
    }
    pos += vel * (-b - sqrt(disc));
  }
  for(int i=0; i<${steps}; i++){
    float r = length(pos);
    if(r < 1.0){ captured = true; break; }
    float dt = clamp(0.06 * r * r / (1.0 + r), 0.015, 1.6);
    vec3 prev = pos;
    acc = -1.5 * h2 * pos / pow(r, 5.0);
    vel += acc * dt;
    pos += vel * dt;
    float s0 = dot(prev, uDiskN);
    float s1 = dot(pos, uDiskN);
    if(s0 * s1 < 0.0){
      float t = s0 / (s0 - s1);
      vec3 hit = mix(prev, pos, t);
      vec4 d = diskSample(hit, normalize(vel));
      sum.rgb += (1.0 - sum.a) * d.rgb;
      sum.a += (1.0 - sum.a) * d.a;
      if(sum.a > 0.985) break;
    }
    if(uJet > 0.5){
      float along = dot(pos, uDiskN);
      float perp = length(pos - uDiskN*along);
      float w = 0.35 + abs(along)*0.09;
      jetGlow += exp(-perp*perp/(w*w)) * exp(-abs(along)*0.03) * smoothstep(1.5, 4.0, abs(along)) * dt * 0.05;
    }
    if(r > R*1.05 && dot(pos, vel) > 0.0) break;
  }
  vec3 bg = captured ? vec3(0.0) : textureCube(uEnv, normalize(vel)).rgb;
  vec3 jet = vec3(0.45, 0.62, 1.0) * jetGlow * (0.8 + 0.4*snoise(vec3(pos*0.2) + uTime*0.2));
  vec3 col = sum.rgb + (1.0 - sum.a) * (bg + jet);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`
