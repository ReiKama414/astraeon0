import { NOISE } from '../../shaders/noise'

/**
 * Equirectangular planet texture baker. Every texel maps to a direction on the unit sphere,
 * so 3D noise is seamless across the dateline and poles.
 * uPass 0 → albedo.rgb | 1 → data (r height, g roughness, b emissive) | 2 → clouds
 */
export const SURFACE_IDS: Record<string, number> = { rocky: 0, moon: 1, mars: 2, venus: 3, gas: 4, 'ice-giant': 5, ice: 6, lava: 7, ocean: 8, earth: 9, sun: 10, 'dream-gas': 11, crystal: 12, biolume: 13 }

export const bakeVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export const bakeFrag = /* glsl */ `
${NOISE}
precision highp float;
varying vec2 vUv;
uniform int uSurface;
uniform int uPass;
uniform float uSeed;
uniform vec3 uPal0; uniform vec3 uPal1; uniform vec3 uPal2; uniform vec3 uPal3; uniform vec3 uPal4;
uniform float uBands;
uniform float uTurb;
uniform vec4 uStorm;       // lat, lon (rad), size, enabled
uniform vec3 uStormColor;
uniform float uCraters;
uniform float uPolar;
uniform sampler2D uLandMask;
uniform float uHasLand;

const float PI = 3.14159265359;

vec3 dirFromUv(vec2 uv){
  // matches three.js SphereGeometry: u=0.5 → +X (lon 0), v=1 → north pole (+Y)
  float lon = (uv.x - 0.5) * 2.0 * PI;
  float lat = (uv.y - 0.5) * PI;
  return vec3(cos(lat)*cos(lon), sin(lat), -cos(lat)*sin(lon));
}

float craterField(vec3 p, float scale, float seed){
  vec3 q = p*scale;
  vec3 i = floor(q);
  float h = 0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 c = i + vec3(x,y,z);
    vec3 r = hash33(c + seed);
    if(r.z > 0.55) continue;
    vec3 center = c + r;
    float rad = 0.25 + 0.35*hash13(c*1.7+seed);
    float d = length(q - center) / rad;
    if(d < 1.0) h += (d*d - 1.0) * 0.6;
    h += exp(-pow((d-1.0)*5.0, 2.0)) * 0.35;
  }
  return h;
}

vec3 pal(float t){
  t = clamp(t,0.0,1.0)*4.0;
  if(t<1.0) return mix(uPal0,uPal1,t);
  if(t<2.0) return mix(uPal1,uPal2,t-1.0);
  if(t<3.0) return mix(uPal2,uPal3,t-2.0);
  return mix(uPal3,uPal4,t-3.0);
}

void main(){
  vec3 d = dirFromUv(vUv);
  float lat = (vUv.y-0.5)*PI;
  float lon = (vUv.x-0.5)*2.0*PI;
  vec3 sp = d + vec3(uSeed*0.137, uSeed*0.071, uSeed*0.113);
  vec3 albedo = vec3(0.5);
  float height = 0.5;
  float rough = 0.9;
  float emissive = 0.0;
  float clouds = 0.0;

  if(uSurface==0 || uSurface==1){
    // rocky / moon: continents of maria + multi-scale craters
    float base = fbm(sp*2.0, 7);
    float maria = (1.0 - smoothstep(-0.25, 0.05, fbm(sp*1.2+3.0, 4)));
    float cr = uCraters>0.0 ? (craterField(d, 6.0, uSeed)*0.5 + craterField(d, 14.0, uSeed+5.0)*0.3 + craterField(d, 32.0, uSeed+9.0)*0.2)*uCraters : 0.0;
    height = 0.5 + base*0.25 + cr*0.12 - maria*0.06;
    float t = 0.35 + base*0.45 + cr*0.05;
    albedo = mix(pal(t), uPal3, maria*0.75);
    albedo *= 0.85 + 0.3*fbm(sp*18.0, 3);
    // bright ray ejecta around some young craters
    float rays = pow(max(0.0, ridged(sp*9.0, 3)-0.55), 2.0) * uCraters;
    albedo += rays*0.25;
    rough = 0.92;
  } else if(uSurface==2){
    // Mars: dark albedo features, highlands, Tharsis bulge, Valles Marineris, polar caps
    float base = fbm(sp*1.6, 7);
    float dark = smoothstep(0.1, 0.35, fbm(sp*1.1 + 7.0, 5));
    float cr = craterField(d, 9.0, uSeed)*0.4 + craterField(d, 22.0, uSeed+3.0)*0.3;
    vec3 tharsisDir = normalize(vec3(cos(0.02)*cos(-1.95), 0.02, -cos(0.02)*sin(-1.95)));
    float tharsis = exp(-pow(acos(clamp(dot(d, tharsisDir),-1.0,1.0))/0.35, 2.0));
    vec3 olyDir = normalize(vec3(cos(0.32)*cos(-2.37), sin(0.32), -cos(0.32)*sin(-2.37)));
    float olympus = exp(-pow(acos(clamp(dot(d, olyDir),-1.0,1.0))/0.05, 2.0));
    float vm = exp(-pow((lat + 0.14 + 0.05*snoise(d*6.0))/0.012, 2.0)) * smoothstep(-1.7,-1.3,lon) * (1.0 - smoothstep(-0.9, -0.5,lon));
    height = 0.45 + base*0.2 + cr*0.08 + tharsis*0.2 + olympus*0.45 - vm*0.25;
    albedo = mix(pal(0.2 + base*0.5), uPal1*0.75, dark*0.6);
    albedo = mix(albedo, uPal2, smoothstep(0.3,0.7,base+0.3)*0.3);
    albedo *= 0.9 + 0.2*fbm(sp*20.0,3);
    float capEdge = PI*0.5 - uPolar*PI*0.5 + 0.05*snoise(d*8.0);
    float cap = smoothstep(capEdge - 0.03, capEdge + 0.03, abs(lat));
    albedo = mix(albedo, vec3(0.93,0.92,0.9), cap);
    rough = mix(0.95, 0.6, cap);
  } else if(uSurface==3){
    // Venus / Titan: thick cloud deck — stretched, sheared flows with Y-shaped dark features
    vec3 q = vec3(d.x, d.y*3.0, d.z);
    float warp = fbm(q*2.0 + fbm(q*3.0, 4), 5);
    float band = sin(lat*6.0 + warp*3.0) * 0.5 + 0.5;
    float y = smoothstep(0.1, 0.8, fbm(vec3(lon*0.6, lat*4.0 + abs(lat)*2.0, 1.0) + warp, 4)*0.5+0.5);
    albedo = mix(pal(0.2 + 0.5*band), uPal3, 0.25*y);
    albedo = mix(albedo, uPal2, 0.25*smoothstep(0.3,0.9,warp*0.5+0.5));
    height = 0.5;
    rough = 1.0;
  } else if(uSurface==4 || uSurface==5){
    // gas & ice giants: zonal bands with turbulent shear and vortices
    float ice = uSurface==5 ? 1.0 : 0.0;
    vec3 q = d;
    float turb = fbm(vec3(q.x*2.0, q.y*14.0, q.z*2.0) + uSeed, 6);
    float swirl = fbm(q*6.0 + turb*1.5, 5);
    float y = sin(lat) + (turb*0.04*(1.0-ice*0.6) + swirl*0.015) * uTurb;
    float b = sin(y*uBands*PI*0.5 + uSeed) * 0.5 + 0.5;
    float fine = sin(y*uBands*PI*2.3 + turb*4.0*uTurb)*0.5+0.5;
    float t = mix(b, fine, 0.3*mix(0.5, 1.0, uTurb));
    albedo = pal(t*0.85 + 0.075);
    // edge eddies along band boundaries
    float edge = smoothstep(0.35, 0.5, abs(b-0.5));
    albedo = mix(albedo, pal(fract(t+0.5)), (1.0-edge)*0.12*swirl*(1.0-ice)*uTurb);
    if(ice > 0.5){
      albedo = mix(pal(0.45), albedo, 0.35);
      albedo *= 1.0 + 0.08*smoothstep(0.6, 1.2, abs(lat));
    }
    // storm (Great Red Spot / Great Dark Spot)
    if(uStorm.w > 0.5){
      float dl = lon - uStorm.y;
      dl = atan(sin(dl), cos(dl));
      vec2 e = vec2(dl*cos(lat)/(uStorm.z*1.9), (lat - uStorm.x)/uStorm.z);
      float r = length(e);
      float ang = atan(e.y, e.x) + (1.0-r)*6.0;
      float spiral = 0.5 + 0.5*sin(ang*2.0 + r*12.0);
      float m = (1.0 - smoothstep(0.55, 1.0, r));
      albedo = mix(albedo, mix(uStormColor, uStormColor*1.35 + 0.05, spiral*0.5), m*0.92);
      albedo = mix(albedo, pal(0.9), (1.0 - smoothstep(1.0, 1.25,r))*smoothstep(0.85,1.0,r)*0.35);
    }
    albedo *= 0.94 + 0.12*fbm(q*30.0, 2)*uTurb;
    rough = 1.0;
  } else if(uSurface==6){
    // ice worlds: bright plains with dark lineae (Europa) and mottling
    float base = fbm(sp*2.5, 6);
    float lines = pow(max(0.0, 1.0 - abs(snoise(sp*4.0))), 12.0) + pow(max(0.0, 1.0 - abs(snoise(sp*9.0+2.0))), 18.0)*0.7;
    float cr = uCraters>0.0 ? craterField(d, 10.0, uSeed)*uCraters*0.3 : 0.0;
    height = 0.5 + base*0.1 + cr*0.1 - lines*0.03;
    albedo = mix(pal(0.3 + base*0.4), uPal1*0.7, clamp(lines,0.0,1.0)*0.7);
    albedo = mix(albedo, uPal2, smoothstep(0.2, 0.6, fbm(sp*1.3,3))*0.35);
    rough = 0.55;
  } else if(uSurface==7){
    // lava / volcanic worlds
    float base = fbm(sp*3.0, 6);
    float cracks = pow(max(0.0, 1.0 - abs(snoise(sp*5.0))), 10.0) + pow(max(0.0, 1.0 - abs(snoise(sp*12.0))), 14.0)*0.6;
    float spots = smoothstep(0.62, 0.8, hash13(floor(sp*14.0))) * (1.0 - smoothstep(0.0, 0.5, length(fract(sp*14.0)-0.5)));
    height = 0.5 + base*0.2 - cracks*0.05;
    albedo = mix(pal(0.1 + base*0.35), uPal2, 0.2);
    float glow = clamp(cracks*0.8 + spots, 0.0, 1.0);
    albedo = mix(albedo, uPal1, glow*0.6);
    emissive = glow;
    rough = 0.8;
  } else if(uSurface==8 || uSurface==9){
    // ocean worlds / procedural Earth fallback
    float cont = uHasLand > 0.5 ? texture2D(uLandMask, vUv).r * 2.0 - 1.0 + fbm(sp*8.0,4)*0.15 : fbm(sp*1.4, 7) - 0.12;
    float land = smoothstep(-0.02, 0.03, cont);
    float mtn = ridged(sp*4.0, 6);
    float coldness = smoothstep(0.9, 1.35, abs(lat) + 0.08*snoise(d*5.0));
    float arid = (1.0 - smoothstep(0.0, 0.2, abs(abs(lat)-0.4))) * smoothstep(-0.1, 0.4, fbm(sp*2.0+4.0, 4));
    vec3 veg = mix(uPal1, uPal1*0.7 + vec3(0.02,0.04,0.0), fbm(sp*6.0,4)*0.5+0.5);
    vec3 landCol = mix(veg, uPal2, arid);
    landCol = mix(landCol, uPal2*0.8, smoothstep(0.55, 0.8, mtn)*0.5);
    vec3 ocean = mix(uPal0*0.6, uPal0*1.2 + vec3(0.0,0.05,0.05), smoothstep(-0.25, 0.0, cont));
    albedo = mix(ocean, landCol, land);
    albedo = mix(albedo, uPal3, coldness);
    // procedural night-light proxy for the offline Earth (clustered near temperate coasts)
    if(uSurface==9) emissive = land * smoothstep(0.58, 0.85, fbm(sp*28.0, 4)*0.5+0.5) * (1.0-coldness) * (1.0-arid*0.7) * (1.0 - smoothstep(0.02, 0.35, cont));
    height = 0.5 + land*(0.1 + mtn*0.25*smoothstep(0.02,0.3,cont));
    rough = mix(0.28, 0.9, land);
    rough = mix(rough, 0.6, coldness);
  } else if(uSurface==11){
    // pastel dream giant: marbled, heavily domain-warped bands
    vec3 q = d;
    vec3 w1 = vec3(fbm(q*1.6 + uSeed, 5), fbm(q*1.6 + uSeed + 7.1, 5), fbm(q*1.6 + uSeed + 3.7, 5));
    vec3 w2 = vec3(fbm(q*2.4 + w1*1.8, 5), fbm(q*2.4 + w1*1.8 + 5.2, 5), 0.0);
    float y = sin(lat) * 2.0 + w2.x * 1.1 + w1.y * 0.4;
    float t = 0.5 + 0.5 * sin(y * uBands * 0.9);
    albedo = pal(t);
    albedo = mix(albedo, uPal2, smoothstep(0.55, 0.95, w2.y * 0.5 + 0.5) * 0.35);
    albedo = mix(albedo, vec3(1.0, 0.96, 0.92), smoothstep(0.82, 1.0, fbm(q*5.0 + w1, 4) * 0.5 + 0.5) * 0.25);
    albedo *= 0.8;
    rough = 1.0;
  } else if(uSurface==12){
    // crystal world: faceted Voronoi plates with luminous seams
    vec3 q = d * 7.0;
    vec3 ip = floor(q);
    float d1 = 9.0, d2 = 9.0; vec3 cid = vec3(0.0);
    for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
      vec3 c = ip + vec3(x,y,z);
      vec3 pnt = c + hash33(c + uSeed);
      float dd = length(q - pnt);
      if(dd < d1){ d2 = d1; d1 = dd; cid = c; } else if(dd < d2){ d2 = dd; }
    }
    float seam = 1.0 - smoothstep(0.0, 0.08, d2 - d1);
    float tint = hash13(cid + uSeed);
    albedo = mix(pal(0.15 + tint * 0.45), uPal2, 0.15 + 0.1 * sin(tint * 20.0));
    albedo = mix(albedo, uPal3, seam * 0.7);
    height = 0.5 + tint * 0.12 - seam * 0.08;
    emissive = seam * 0.55;
    rough = mix(0.12, 0.4, seam);
  } else if(uSurface==13){
    // bioluminescent ocean world: dark seas veined with glowing plankton currents
    float cont = fbm(sp*1.3, 6) - 0.2;
    float land = smoothstep(-0.02, 0.03, cont);
    vec3 flow = vec3(fbm(sp*3.0, 4), fbm(sp*3.0 + 4.0, 4), 0.0);
    float veins = pow(max(0.0, 1.0 - abs(snoise(sp*6.0 + flow*2.0))), 8.0) + pow(max(0.0, 1.0 - abs(snoise(sp*13.0 + flow*3.0))), 12.0)*0.6;
    vec3 sea = mix(uPal0 * 0.7, uPal0 * 1.2, fbm(sp*4.0, 3)*0.5+0.5);
    albedo = mix(sea, mix(uPal1, uPal2, fbm(sp*6.0,3)*0.5+0.5), land);
    emissive = (1.0 - land) * clamp(veins, 0.0, 1.0);
    height = 0.5 + land * 0.12;
    rough = mix(0.22, 0.85, land);
  } else if(uSurface==10){
    float g = fbm(sp*20.0, 5);
    albedo = pal(0.5 + g*0.3);
  }

  // clouds (pass 2): banded mid-latitude storms + cellular convection
  if(uPass == 2){
    vec3 q = d*1.0;
    float w = fbm(q*2.0 + uSeed, 4);
    float c = fbm(vec3(q.x, q.y*1.6, q.z)*3.0 + w*1.8 + uSeed*0.3, 7);
    float lat2 = abs(lat);
    float belt = 0.55 + 0.45*smoothstep(0.2, 0.9, lat2) - 0.25*smoothstep(0.15,0.4,lat2)*(1.0 - smoothstep(0.45, 0.7,lat2));
    clouds = smoothstep(0.02, 0.45, c*belt + 0.08);
    clouds *= 0.75 + 0.25*fbm(q*22.0, 3);
    gl_FragColor = vec4(vec3(clouds), clouds);
    return;
  }
  if(uPass == 1){
    gl_FragColor = vec4(clamp(height,0.0,1.0), clamp(rough,0.0,1.0), clamp(emissive,0.0,1.0), 1.0);
    return;
  }
  gl_FragColor = vec4(clamp(albedo,0.0,1.0), 1.0);
}
`
