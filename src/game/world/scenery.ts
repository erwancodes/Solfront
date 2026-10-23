import * as THREE from 'three'
import { mulberry32 } from '../math'

/** Cheap smooth 3D value noise for displacing rock meshes. */
function hash(x: number, y: number, z: number, seed: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453
  return s - Math.floor(s)
}
function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = zf * zf * (3 - 2 * zf)
  let r = 0
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const h = hash(xi + dx, yi + dy, zi + dz, seed)
        r += h * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w)
      }
  return r
}

/** Lumpy rock: an icosphere pushed around by octave noise and a few craters. */
export function rockGeometry(seed: number, detail = 3, rough = 0.35, craters = 6) {
  const geo = new THREE.IcosahedronGeometry(1, detail)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const rnd = mulberry32(seed)
  const cr: { d: THREE.Vector3; r: number }[] = []
  for (let i = 0; i < craters; i++) cr.push({ d: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), r: 0.15 + rnd() * 0.3 })
  const stretch = new THREE.Vector3(0.8 + rnd() * 0.5, 0.7 + rnd() * 0.4, 0.8 + rnd() * 0.5)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize()
    let n = 0
    let amp = 1
    let f = 1.6
    for (let o = 0; o < 4; o++) {
      n += (noise3(p.x * f + 10, p.y * f, p.z * f, seed) - 0.5) * amp
      amp *= 0.5
      f *= 2.1
    }
    let d = 1 + n * rough
    for (const c of cr) {
      const a = p.distanceTo(c.d) / c.r
      if (a < 1) d -= (1 - a * a) * c.r * 0.22
      else if (a < 1.3) d += (1.3 - a) * c.r * 0.12
    }
    p.multiplyScalar(d).multiply(stretch)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  geo.computeVertexNormals()
  return geo
}

export interface Obstacle {
  p: THREE.Vector3
  r: number
}

export interface AsteroidField {
  group: THREE.Group
  obstacles: Obstacle[]
  update(dt: number): void
}

/** Instanced asteroid belt; the big rocks are also collision obstacles. */
export function createAsteroidField(opts: { center: THREE.Vector3; inner: number; outer: number; height: number; count: number; seed: number; color?: number }): AsteroidField {
  const group = new THREE.Group()
  const rnd = mulberry32(opts.seed)
  const mat = new THREE.MeshStandardMaterial({ color: opts.color ?? 0x8a8580, roughness: 0.95, metalness: 0.05 })
  const variants = [rockGeometry(opts.seed + 1), rockGeometry(opts.seed + 2, 3, 0.45), rockGeometry(opts.seed + 3, 2, 0.3)]
  const per = Math.ceil(opts.count / variants.length)
  const obstacles: Obstacle[] = []
  const dummy = new THREE.Object3D()
  const meshes: THREE.InstancedMesh[] = []
  const spins: { axis: THREE.Vector3; speed: number; base: THREE.Quaternion; pos: THREE.Vector3; scale: number }[][] = []
  for (const geo of variants) {
    const mesh = new THREE.InstancedMesh(geo, mat, per)
    const list: (typeof spins)[number] = []
    for (let i = 0; i < per; i++) {
      const a = rnd() * Math.PI * 2
      const r = opts.inner + Math.sqrt(rnd()) * (opts.outer - opts.inner)
      const pos = new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.5) * opts.height, Math.sin(a) * r).add(opts.center)
      const big = rnd() < 0.08
      const scale = big ? 40 + rnd() * 70 : 3 + Math.pow(rnd(), 2.2) * 30
      dummy.position.copy(pos)
      dummy.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (scale > 14) obstacles.push({ p: pos.clone(), r: scale * 0.95 })
      list.push({ axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), speed: (rnd() - 0.5) * 0.4 / Math.sqrt(scale), base: dummy.quaternion.clone(), pos, scale })
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    meshes.push(mesh)
    spins.push(list)
    group.add(mesh)
  }
  let t = 0
  let frame = 0
  const q = new THREE.Quaternion()
  return {
    group,
    obstacles,
    update(dt) {
      t += dt
      // tumble a third of the rocks per frame; nobody can tell
      frame = (frame + 1) % 3
      const m = meshes[frame]
      const list = spins[frame]
      for (let i = 0; i < list.length; i++) {
        const s = list[i]
        q.setFromAxisAngle(s.axis, s.speed * t).multiply(s.base)
        dummy.position.copy(s.pos)
        dummy.quaternion.copy(q)
        dummy.scale.setScalar(s.scale)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    },
  }
}

/** Phobos: a potato-shaped moon close over Mars. */
export function createPhobos(radius: number, map?: THREE.Texture) {
  const geo = rockGeometry(1877, 5, 0.22, 14)
  const mat = new THREE.MeshStandardMaterial({ color: 0x8c7462, roughness: 1, metalness: 0, map: map ?? null, bumpMap: map ?? null, bumpScale: 3 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.scale.set(radius * 1.3, radius, radius * 1.1)
  return mesh
}

const DUST_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aEnd;
uniform vec3 uCam;
uniform vec3 uVel;
uniform float uBox;
varying float vA;
void main(){
  vec3 p = mod(position - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  float d = length(p);
  vA = smoothstep(uBox * 0.5, uBox * 0.15, d) * smoothstep(2.0, 12.0, d);
  float streak = max(0.8, length(uVel) * 0.035);
  vec3 dir = length(uVel) > 0.1 ? normalize(uVel) : vec3(0.0, 0.0, 1.0);
  p += uCam - dir * streak * aEnd;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  #include <logdepthbuf_vertex>
}`
const DUST_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uAlpha;
uniform vec3 uColor;
varying float vA;
void main(){
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(uColor * vA * uAlpha, 1.0);
}`

/** Drifting motes around the camera that stretch into speed lines. */
export function createDust(count = 900, box = 420) {
  const pos = new Float32Array(count * 2 * 3)
  const end = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const x = Math.random() * box
    const y = Math.random() * box
    const z = Math.random() * box
    pos.set([x, y, z, x, y, z], i * 6)
    end[i * 2] = 0
    end[i * 2 + 1] = 1
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uBox: { value: box }, uAlpha: { value: 0.5 }, uColor: { value: new THREE.Color(1, 0.95, 0.9) } },
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const lines = new THREE.LineSegments(geo, mat)
  lines.frustumCulled = false
  return {
    object: lines,
    update(cam: THREE.Vector3, vel: THREE.Vector3, boost: number) {
      mat.uniforms.uCam.value.copy(cam)
      mat.uniforms.uVel.value.copy(vel)
      mat.uniforms.uAlpha.value = 0.35 + boost * 0.9
    },
  }
}
