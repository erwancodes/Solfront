import * as THREE from 'three'
import { mulberry32 } from '../math'
import { ModelBuilder, box, cylZ, loft, sharedMaterials, sphere, torus } from './builder'
import { MARS_COLORS } from './ships'

export interface StationModel {
  group: THREE.Group
  /** Parts that spin on their own axis each frame. */
  spinners: { obj: THREE.Object3D; speed: number }[]
  blinkers: THREE.Mesh[]
  hitSpheres: { p: THREE.Vector3; r: number }[]
  turretSlots: THREE.Vector3[]
}

const hdr = (r: number, g: number, b: number) => new THREE.Color(r, g, b)
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function beacon(color: THREE.Color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({ color, toneMapped: false }))
  m.userData.color = color.clone()
  return m
}

/** Ares Station: the Martian orbital hub the first sector defends. */
export function buildAresStation(): StationModel {
  const rnd = mulberry32(4242)
  const core = new ModelBuilder()
  const hull = MARS_COLORS.hull
  const rust = MARS_COLORS.rust
  const dark = MARS_COLORS.dark
  // central spine along Y
  core.add(cylZ(16, 16, 150, 28), 'hull', hull, { r: [Math.PI / 2, 0, 0] })
  core.add(cylZ(24, 24, 34, 32), 'hull', 0xc4bdb2, { r: [Math.PI / 2, 0, 0] })
  core.add(cylZ(20, 26, 10, 32), 'dark', dark, { p: [0, 22, 0], r: [Math.PI / 2, 0, 0] })
  core.add(cylZ(26, 20, 10, 32), 'dark', dark, { p: [0, -22, 0], r: [Math.PI / 2, 0, 0] })
  core.add(sphere(18, 28, 16), 'hull', hull, { p: [0, 76, 0], s: [1, 0.6, 1] })
  core.add(sphere(18, 28, 16), 'hull', hull, { p: [0, -76, 0], s: [1, 0.6, 1] })
  // rust bands
  for (const y of [-52, -38, 38, 52]) core.add(cylZ(16.6, 16.6, 4, 28), 'hull', rust, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] })
  // docking arms
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    core.add(box(6, 6, 46), 'hull', 0xb9b2a8, { p: [dx * 36, -60, dz * 36], r: [0, -a + Math.PI / 2, 0] })
    core.add(cylZ(7, 7, 12, 16), 'dark', dark, { p: [dx * 60, -60, dz * 60], r: [0, -a + Math.PI / 2, 0] })
    core.add(box(3, 3, 3), 'glow', hdr(4, 2.6, 0.8), { p: [dx * 66.5, -60, dz * 66.5] })
  }
  // solar wings above and below
  for (const side of [1, -1]) {
    core.add(box(4, 4, 260), 'dark', dark, { p: [0, side * 64, 0] })
    for (const z of [-80, -40, 40, 80]) {
      core.add(box(60, 0.8, 34), 'dark', 0x1a2a44, { p: [34, side * 64, z] })
      core.add(box(60, 0.8, 34), 'dark', 0x1a2a44, { p: [-34, side * 64, z] })
      core.add(box(62, 1.1, 1.2), 'hull', 0x9a948b, { p: [34, side * 64, z + 17] })
      core.add(box(62, 1.1, 1.2), 'hull', 0x9a948b, { p: [-34, side * 64, z + 17] })
    }
  }
  // radiators
  for (const a of [0.8, 0.8 + Math.PI]) {
    core.add(box(1, 30, 60), 'hull', 0xe6e0d6, { p: [Math.cos(a) * 40, 30, Math.sin(a) * 40], r: [0, -a, 0] })
  }
  // window strip on the drum
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    if (rnd() < 0.25) continue
    core.add(box(2.4, 1.2, 0.6), 'glow', hdr(3.2, 2.4, 1.4), { p: [Math.cos(a) * 24.2, 6 + (i % 2) * 4, Math.sin(a) * 24.2], r: [0, -a + Math.PI / 2, 0] })
  }
  const group = core.build(sharedMaterials())

  // rotating habitat ring
  const ringB = new ModelBuilder()
  ringB.add(torus(120, 9, 18, 96), 'hull', hull, { r: [Math.PI / 2, 0, 0] })
  ringB.add(torus(120, 9.4, 6, 96), 'hull', rust, { r: [Math.PI / 2, 0, 0], s: [1, 1, 0.25] })
  ringB.add(torus(130.5, 1.6, 6, 96), 'dark', dark, { r: [Math.PI / 2, 0, 0] })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    ringB.add(box(5, 5, 96), 'hull', 0xb9b2a8, { p: [Math.cos(a) * 70, 0, Math.sin(a) * 70], r: [0, -a + Math.PI / 2, 0] })
    ringB.add(box(14, 14, 18), 'hull', hull, { p: [Math.cos(a) * 120, 0, Math.sin(a) * 120], r: [0, -a + Math.PI / 2, 0] })
  }
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2
    if (rnd() < 0.3) continue
    const warm = rnd() > 0.2
    ringB.add(box(2.2, 1.4, 0.5), 'glow', warm ? hdr(3.6, 2.6, 1.5) : hdr(1.4, 2.4, 3.4), {
      p: [Math.cos(a) * 128.9, (rnd() > 0.5 ? 1 : -1) * 2.6, Math.sin(a) * 128.9],
      r: [0, -a + Math.PI / 2, 0],
    })
  }
  const ring = ringB.build(sharedMaterials())
  group.add(ring)

  const blinkers: THREE.Mesh[] = []
  for (const [p, c] of [
    [v3(0, 92, 0), hdr(6, 0.4, 0.2)],
    [v3(0, -92, 0), hdr(6, 0.4, 0.2)],
    [v3(94, 64, 130), hdr(0.4, 6, 1)],
    [v3(-94, 64, -130), hdr(6, 0.4, 0.2)],
    [v3(94, -64, -130), hdr(0.4, 6, 1)],
    [v3(-94, -64, 130), hdr(6, 0.4, 0.2)],
  ] as const) {
    const b = beacon(c)
    b.position.copy(p)
    group.add(b)
    blinkers.push(b)
  }
  const hitSpheres = [
    { p: v3(0, 0, 0), r: 28 },
    { p: v3(0, 50, 0), r: 18 },
    { p: v3(0, -50, 0), r: 18 },
    { p: v3(0, 76, 0), r: 18 },
    { p: v3(0, -76, 0), r: 18 },
  ]
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    hitSpheres.push({ p: v3(Math.cos(a) * 120, 0, Math.sin(a) * 120), r: 14 })
  }
  return {
    group,
    spinners: [{ obj: ring, speed: 0.06 }],
    blinkers,
    hitSpheres,
    turretSlots: [v3(0, 92, 0), v3(0, -92, 0), v3(120, 14, 0), v3(-120, 14, 0)],
  }
}

/** Terran lunar shipyard with a half-built hull in the cradle. */
export function buildShipyard(): StationModel {
  const rnd = mulberry32(99)
  const b = new ModelBuilder()
  const steel = 0x9aa4ae
  const navy = 0x24324a
  const dark = 0x23272d
  // truss cradle: four longerons with cross members
  for (const [x, y] of [[-60, -40], [60, -40], [-60, 40], [60, 40]]) b.add(box(5, 5, 520), 'hull', steel, { p: [x, y, 0] })
  for (let z = -250; z <= 250; z += 50) {
    b.add(box(124, 3, 3), 'dark', dark, { p: [0, 40, z] })
    b.add(box(124, 3, 3), 'dark', dark, { p: [0, -40, z] })
    b.add(box(3, 84, 3), 'dark', dark, { p: [60, 0, z] })
    b.add(box(3, 84, 3), 'dark', dark, { p: [-60, 0, z] })
    b.add(box(2, 2, 2), 'glow', hdr(3, 3.2, 3.6), { p: [60, 40, z] })
    b.add(box(2, 2, 2), 'glow', hdr(3, 3.2, 3.6), { p: [-60, -40, z] })
  }
  // unfinished hull
  b.add(
    loft([
      { z: -180, w: 20, h: 12, n: 3 },
      { z: -120, w: 70, h: 34, n: 3.4 },
      { z: 40, w: 86, h: 44, n: 3.6 },
      { z: 90, w: 80, h: 40, n: 3.6 },
    ], 28),
    'hull',
    0xbcc5cf,
  )
  for (let z = 100; z <= 220; z += 20) {
    b.add(torus(36, 1.6, 6, 32), 'dark', dark, { p: [0, 0, z], s: [1.15, 0.9, 1] })
  }
  b.add(box(6, 6, 140), 'dark', dark, { p: [0, -18, 160] })
  // welding sparks: small hot points along the open frames
  for (let i = 0; i < 26; i++) {
    b.add(box(1.2, 1.2, 1.2), 'glow', hdr(6, 4.4, 2), { p: [(rnd() * 2 - 1) * 34, (rnd() * 2 - 1) * 26, 100 + rnd() * 120] })
  }
  // command block
  b.add(box(50, 30, 60), 'hull', steel, { p: [0, 70, -200] })
  b.add(box(54, 4, 1), 'glow', hdr(2.6, 3, 3.4), { p: [0, 74, -230.6] })
  b.add(box(20, 6, 40), 'hull', navy, { p: [0, 88, -200] })
  for (let i = 0; i < 40; i++) {
    const side = rnd() > 0.5 ? 1 : -1
    b.add(box(0.6, 1.2, 2.4), 'glow', hdr(2.4, 2.2, 1.8), { p: [side * 25.4, 60 + rnd() * 16, -228 + rnd() * 56] })
  }
  const group = b.build(sharedMaterials())
  const blinkers: THREE.Mesh[] = []
  for (const z of [-260, 260]) {
    for (const x of [-60, 60]) {
      const m = beacon(hdr(6, 0.4, 0.2))
      m.position.set(x, 44, z)
      group.add(m)
      blinkers.push(m)
    }
  }
  const hitSpheres: { p: THREE.Vector3; r: number }[] = []
  for (let z = -240; z <= 240; z += 40) hitSpheres.push({ p: v3(0, 0, z), r: 46 })
  hitSpheres.push({ p: v3(0, 76, -200), r: 34 })
  return { group, spinners: [], blinkers, hitSpheres, turretSlots: [] }
}

/** Reactor core suspended in the shipyard. */
export function buildYardCore() {
  const b = new ModelBuilder()
  b.add(sphere(22, 32, 20), 'glow', hdr(1.6, 3.4, 6))
  for (let i = 0; i < 3; i++) {
    b.add(torus(30 + i * 5, 1.6, 8, 64), 'dark', 0x23272d, { r: [i * 1.1, i * 0.7, 0] })
  }
  b.add(cylZ(4, 4, 90, 12), 'hull', 0x9aa4ae, { r: [Math.PI / 2, 0, 0] })
  return b.build(sharedMaterials())
}

/** Shield pylon: tall mast with an emitter dish. */
export function buildPylon() {
  const b = new ModelBuilder()
  b.add(cylZ(10, 14, 12, 20), 'hull', 0x8c96a1, { r: [Math.PI / 2, 0, 0] })
  b.add(cylZ(3.4, 4.6, 70, 12), 'hull', 0xbcc5cf, { p: [0, 40, 0], r: [Math.PI / 2, 0, 0] })
  b.add(torus(9, 1.6, 8, 32), 'dark', 0x23272d, { p: [0, 50, 0], r: [Math.PI / 2, 0, 0] })
  b.add(torus(6, 1.2, 8, 32), 'dark', 0x23272d, { p: [0, 64, 0], r: [Math.PI / 2, 0, 0] })
  b.add(sphere(5, 20, 12), 'glow', hdr(1.6, 3.4, 6), { p: [0, 78, 0] })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    b.add(box(2, 30, 2), 'dark', 0x23272d, { p: [Math.cos(a) * 9, 18, Math.sin(a) * 9], r: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25] })
  }
  return b.build(sharedMaterials())
}

/** Small orbital defence platform used as scenery over Earth. */
export function buildPlatform() {
  const b = new ModelBuilder()
  b.add(cylZ(30, 30, 8, 6), 'hull', 0xbcc5cf, { r: [Math.PI / 2, 0, 0] })
  b.add(cylZ(12, 18, 20, 6), 'hull', 0x9aa4ae, { p: [0, 12, 0], r: [Math.PI / 2, 0, 0] })
  b.add(box(140, 1, 26), 'dark', 0x1a2a44, { p: [0, 0, 0] })
  b.add(box(144, 2, 2), 'hull', 0x9aa4ae)
  b.add(cylZ(1.2, 1.4, 40, 8), 'dark', 0x23272d, { p: [0, 24, -18] })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    b.add(box(2, 1, 1), 'glow', hdr(1.4, 2.6, 4), { p: [Math.cos(a) * 30.4, 0, Math.sin(a) * 30.4], r: [0, -a, 0] })
  }
  return b.build(sharedMaterials())
}

/** Translucent hex-ish shield bubble with fresnel edge and hit ripples. */
export function makeShieldMaterial(color = new THREE.Color(0.4, 0.8, 1.6)) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
      uHit: { value: new THREE.Vector4(0, 0, 0, -10) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vW; varying vec3 vO;
      void main(){
        vO = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uTime; uniform vec4 uHit; uniform float uOpacity;
      varying vec3 vN; varying vec3 vW; varying vec3 vO;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 V = normalize(cameraPosition - vW);
        float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
        vec3 p = normalize(vO);
        float lat = abs(fract(p.y * 18.0 + uTime * 0.15) - 0.5);
        float lon = abs(fract(atan(p.z, p.x) * 9.0 / 3.14159) - 0.5);
        float grid = smoothstep(0.47, 0.5, max(lat, lon));
        float hitT = uTime - uHit.w;
        float d = distance(p, normalize(uHit.xyz));
        float ripple = hitT < 1.5 ? smoothstep(0.08, 0.0, abs(d - hitT * 0.9)) * (1.5 - hitT) : 0.0;
        float a = (0.04 + f * 0.7 + grid * 0.12 + ripple * 1.2) * uOpacity;
        gl_FragColor = vec4(uColor * (0.6 + f * 2.0 + ripple * 3.0), a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}
