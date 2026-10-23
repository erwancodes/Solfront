import * as THREE from 'three'

export type PlanetKind = 'earth' | 'mars' | 'moon'

export interface PlanetTextures {
  day: THREE.Texture
  night?: THREE.Texture
  normal?: THREE.Texture
  spec?: THREE.Texture
  clouds?: THREE.Texture
}

export interface Planet {
  group: THREE.Group
  kind: PlanetKind
  radius: number
  update(dt: number, sunDir: THREE.Vector3): void
}

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;
varying vec3 vW;
void main(){
  vUv = uv;
  vec3 n = normalize(normal);
  vec3 t = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
  vec3 b = cross(n, t);
  mat3 m = mat3(modelMatrix);
  vN = normalize(m * n);
  vT = normalize(m * t);
  vB = normalize(m * b);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uNormal;
uniform sampler2D uSpec;
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform vec3 uAtmo;
uniform vec3 uTerm;
uniform float uCloudOffset;
uniform float uBump;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;
varying vec3 vW;

float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

void main(){
  #include <logdepthbuf_fragment>
  vec3 N0 = normalize(vN);
  vec3 T = normalize(vT);
  vec3 B = normalize(vB);
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(uSun);
  vec3 day = texture2D(uDay, vUv).rgb;

  vec3 N = N0;
  #ifdef HAS_NORMAL
    vec3 nm = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    nm.xy *= 1.4;
    N = normalize(T * nm.x + B * nm.y + N0 * nm.z);
  #else
    float h0 = lum(texture2D(uDay, vUv).rgb);
    float hu = lum(texture2D(uDay, vUv + vec2(uTexel.x, 0.0)).rgb);
    float hv = lum(texture2D(uDay, vUv + vec2(0.0, uTexel.y)).rgb);
    N = normalize(N0 - (T * (hu - h0) + B * (hv - h0)) * uBump);
  #endif

  float geo = dot(N0, L);
  float ndl = max(dot(N, L), 0.0);
  float dayMask = smoothstep(-0.12, 0.22, geo);

  // soft terminator: a thin warm band where the sun sets
  float term = smoothstep(-0.05, 0.08, geo) * (1.0 - smoothstep(0.08, 0.35, geo));
  vec3 lit = day * ndl * 1.6;
  lit += day * uTerm * term * 0.35;

  #ifdef HAS_CLOUDS
    vec2 cuv = vUv + vec2(uCloudOffset, 0.0);
    // shadow of the cloud layer, offset away from the sun
    vec2 shadowUv = cuv - vec2(dot(L, T), dot(L, B)) * 0.0025;
    float cs = texture2D(uClouds, shadowUv).r;
    lit *= 1.0 - cs * 0.55 * dayMask;
  #endif

  #ifdef HAS_SPEC
    float specMask = texture2D(uSpec, vUv).r;
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(N0, H), 0.0), 60.0) * specMask;
    lit += vec3(1.0, 0.9, 0.75) * sp * 1.8 * dayMask;
    // ocean tint toward deep blue at grazing angles
    lit = mix(lit, lit + vec3(0.02, 0.06, 0.12) * dayMask, specMask * 0.6);
  #endif

  vec3 col = lit;
  #ifdef HAS_NIGHT
    vec3 night = texture2D(uNight, vUv).rgb;
    night = pow(night, vec3(1.6)) * vec3(1.6, 1.25, 0.85) * 2.2;
    #ifdef HAS_CLOUDS
      night *= 1.0 - texture2D(uClouds, cuv).r * 0.8;
    #endif
    col += night * (1.0 - smoothstep(-0.2, 0.06, geo));
  #endif

  // atmospheric haze toward the limb
  float rim = pow(1.0 - max(dot(N0, V), 0.0), 3.0);
  float sunSide = smoothstep(-0.3, 0.4, geo);
  col = mix(col, uAtmo * 1.2, rim * 0.75 * sunSide);
  col += uAtmo * rim * 0.4 * sunSide;

  gl_FragColor = vec4(col, 1.0);
}`

const CLOUD_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uCloudOffset;
uniform vec3 uTerm;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;
varying vec3 vW;
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float c = texture2D(uClouds, vUv + vec2(uCloudOffset, 0.0)).r;
  float geo = dot(N, normalize(uSun));
  float light = smoothstep(-0.15, 0.35, geo);
  float term = smoothstep(-0.05, 0.08, geo) * (1.0 - smoothstep(0.08, 0.4, geo));
  vec3 col = vec3(1.0) * (0.04 + light * 1.25) + uTerm * term * 0.6;
  float edge = smoothstep(0.0, 0.25, dot(N, V));
  gl_FragColor = vec4(col, c * edge * 0.95);
}`

const ATMO_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCenter;
uniform float uR;
uniform float uRa;
uniform vec3 uSun;
uniform vec3 uAtmo;
uniform vec3 uTerm;
uniform float uStrength;
varying vec3 vW;
void main(){
  #include <logdepthbuf_fragment>
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vW - ro);
  vec3 oc = uCenter - ro;
  float tc = dot(oc, rd);
  vec3 closest = ro + rd * max(tc, 0.0);
  float d = length(closest - uCenter);
  float h = clamp((d - uR) / (uRa - uR), 0.0, 1.0);
  float dens = exp(-h * 4.5) * (1.0 - h);
  vec3 up = normalize(closest - uCenter);
  float geo = dot(up, normalize(uSun));
  float lit = smoothstep(-0.35, 0.3, geo);
  float term = smoothstep(-0.25, 0.05, geo) * (1.0 - smoothstep(0.05, 0.45, geo));
  vec3 col = uAtmo * lit + uTerm * term * 0.8;
  // forward scattering toward the sun
  float fwd = pow(max(dot(rd, normalize(uSun)), 0.0), 8.0);
  col += uTerm * fwd * dens * 1.5;
  gl_FragColor = vec4(col * dens * uStrength, 1.0);
}`

const ATMO_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`

const PRESETS: Record<PlanetKind, { atmo: THREE.Color; term: THREE.Color; shell: number; strength: number; bump: number }> = {
  earth: { atmo: new THREE.Color(0.32, 0.56, 1.0), term: new THREE.Color(1.0, 0.45, 0.2), shell: 1.035, strength: 1.4, bump: 0 },
  mars: { atmo: new THREE.Color(0.85, 0.52, 0.34), term: new THREE.Color(0.22, 0.26, 0.4), shell: 1.022, strength: 0.7, bump: 5 },
  moon: { atmo: new THREE.Color(0, 0, 0), term: new THREE.Color(0, 0, 0), shell: 0, strength: 0, bump: 7 },
}

export function createPlanet(kind: PlanetKind, radius: number, tex: PlanetTextures, segments = 160): Planet {
  const group = new THREE.Group()
  const preset = PRESETS[kind]
  const defines: Record<string, string> = {}
  if (tex.normal) defines.HAS_NORMAL = ''
  if (tex.night) defines.HAS_NIGHT = ''
  if (tex.spec) defines.HAS_SPEC = ''
  if (tex.clouds) defines.HAS_CLOUDS = ''
  const img = tex.day.image as { width?: number; height?: number } | undefined
  const sun = new THREE.Vector3(1, 0, 0)
  const uniforms = {
    uDay: { value: tex.day },
    uNight: { value: tex.night ?? tex.day },
    uNormal: { value: tex.normal ?? tex.day },
    uSpec: { value: tex.spec ?? tex.day },
    uClouds: { value: tex.clouds ?? tex.day },
    uSun: { value: sun },
    uAtmo: { value: preset.atmo },
    uTerm: { value: preset.term },
    uCloudOffset: { value: 0 },
    uBump: { value: preset.bump },
    uTexel: { value: new THREE.Vector2(1 / (img?.width ?? 4096), 1 / (img?.height ?? 2048)) },
  }
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments / 2),
    new THREE.ShaderMaterial({ uniforms, defines, vertexShader: VERT, fragmentShader: FRAG }),
  )
  surface.name = 'surface'
  group.add(surface)

  let clouds: THREE.Mesh | null = null
  if (tex.clouds) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.008, segments, segments / 2),
      new THREE.ShaderMaterial({
        uniforms: { uClouds: uniforms.uClouds, uSun: uniforms.uSun, uCloudOffset: uniforms.uCloudOffset, uTerm: uniforms.uTerm },
        vertexShader: VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    )
    group.add(clouds)
  }

  let atmoUniforms: { uCenter: { value: THREE.Vector3 } } | null = null
  if (preset.shell > 0) {
    const u = {
      uCenter: { value: new THREE.Vector3() },
      uR: { value: radius },
      uRa: { value: radius * preset.shell },
      uSun: uniforms.uSun,
      uAtmo: uniforms.uAtmo,
      uTerm: uniforms.uTerm,
      uStrength: { value: preset.strength },
    }
    atmoUniforms = u
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(radius * preset.shell, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    group.add(shell)
  }

  const spin = kind === 'earth' ? 0.0035 : kind === 'mars' ? 0.003 : 0.0012
  return {
    group,
    kind,
    radius,
    update(dt, sunDir) {
      surface.rotation.y += spin * dt
      if (clouds) {
        clouds.rotation.y = surface.rotation.y
        uniforms.uCloudOffset.value = (uniforms.uCloudOffset.value + dt * 0.0006) % 1
      }
      sun.copy(sunDir)
      if (atmoUniforms) group.getWorldPosition(atmoUniforms.uCenter.value)
    },
  }
}

const loader = new THREE.TextureLoader()
const texCache = new Map<string, Promise<THREE.Texture>>()

export function loadTexture(url: string, srgb = true, anisotropy = 8) {
  let p = texCache.get(url)
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.anisotropy = anisotropy
      t.wrapS = THREE.RepeatWrapping
      return t
    })
    texCache.set(url, p)
  }
  return p
}

export async function loadPlanetTextures(kind: PlanetKind): Promise<PlanetTextures> {
  const base = '/textures/planets/'
  if (kind === 'earth') {
    const [day, night, normal, spec, clouds] = await Promise.all([
      loadTexture(base + 'earth.jpg'),
      loadTexture(base + 'earth-night.jpg'),
      loadTexture(base + 'earth-normal.jpg', false),
      loadTexture(base + 'earth-specular.jpg', false),
      loadTexture(base + 'earth-clouds.jpg', false),
    ])
    return { day, night, normal, spec, clouds }
  }
  return { day: await loadTexture(base + (kind === 'mars' ? 'mars.jpg' : 'moon.jpg')) }
}
