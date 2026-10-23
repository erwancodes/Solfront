import * as THREE from 'three'
import { randomUnit } from '../math'

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 aColor;
attribute float aSize;
varying vec4 vColor;
uniform float uScale;
void main(){
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  #include <logdepthbuf_vertex>
}`

const FRAG_ADD = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec4 vColor;
void main(){
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor.rgb * a * a * vColor.a, 1.0);
}`

const FRAG_SMOKE = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec4 vColor;
void main(){
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float n = sin(c.x * 17.0 + vColor.a * 9.0) * sin(c.y * 13.0 - vColor.a * 7.0) * 0.08;
  float a = smoothstep(0.5, 0.15, d + n) * vColor.a;
  gl_FragColor = vec4(vColor.rgb, a * 0.8);
}`

export interface EmitOpts {
  count: number
  pos: THREE.Vector3
  vel?: THREE.Vector3
  speed: [number, number]
  life: [number, number]
  size: [number, number]
  /** Final size multiplier. */
  grow?: number
  color: THREE.Color
  color2?: THREE.Color
  drag?: number
  dir?: THREE.Vector3
  spread?: number
}

/**
 * CPU particle system in one Points draw call. Particles live in a ring
 * buffer, so emitting never allocates and the oldest are recycled first.
 */
export class Particles {
  readonly points: THREE.Points
  private n: number
  private head = 0
  private pos: Float32Array
  private vel: Float32Array
  private col: Float32Array
  private col0: Float32Array
  private col1: Float32Array
  private size: Float32Array
  private size0: Float32Array
  private grow: Float32Array
  private life: Float32Array
  private age: Float32Array
  private drag: Float32Array
  private geo: THREE.BufferGeometry
  private mat: THREE.ShaderMaterial
  private smoke: boolean

  constructor(n: number, smoke = false) {
    this.n = n
    this.smoke = smoke
    this.pos = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.col = new Float32Array(n * 4)
    this.col0 = new Float32Array(n * 3)
    this.col1 = new Float32Array(n * 3)
    this.size = new Float32Array(n)
    this.size0 = new Float32Array(n)
    this.grow = new Float32Array(n)
    this.life = new Float32Array(n)
    this.age = new Float32Array(n).fill(1e9)
    this.drag = new Float32Array(n)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: smoke ? FRAG_SMOKE : FRAG_ADD,
      transparent: true,
      depthWrite: false,
      blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(this.geo, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = smoke ? 2 : 3
  }

  setViewport(height: number, fov: number) {
    this.mat.uniforms.uScale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2))
  }

  private static _d = new THREE.Vector3()

  emit(o: EmitOpts) {
    const d = Particles._d
    for (let k = 0; k < o.count; k++) {
      const i = this.head
      this.head = (this.head + 1) % this.n
      if (o.dir) {
        randomUnit(d).multiplyScalar(o.spread ?? 0.3).add(o.dir).normalize()
      } else randomUnit(d)
      const s = o.speed[0] + Math.random() * (o.speed[1] - o.speed[0])
      this.pos[i * 3] = o.pos.x
      this.pos[i * 3 + 1] = o.pos.y
      this.pos[i * 3 + 2] = o.pos.z
      this.vel[i * 3] = d.x * s + (o.vel?.x ?? 0)
      this.vel[i * 3 + 1] = d.y * s + (o.vel?.y ?? 0)
      this.vel[i * 3 + 2] = d.z * s + (o.vel?.z ?? 0)
      const c2 = o.color2 ?? o.color
      this.col0[i * 3] = o.color.r
      this.col0[i * 3 + 1] = o.color.g
      this.col0[i * 3 + 2] = o.color.b
      this.col1[i * 3] = c2.r
      this.col1[i * 3 + 1] = c2.g
      this.col1[i * 3 + 2] = c2.b
      this.size0[i] = o.size[0] + Math.random() * (o.size[1] - o.size[0])
      this.grow[i] = o.grow ?? 1
      this.life[i] = o.life[0] + Math.random() * (o.life[1] - o.life[0])
      this.age[i] = 0
      this.drag[i] = o.drag ?? 1.2
    }
  }

  update(dt: number) {
    const { pos, vel, col, size, age, life } = this
    for (let i = 0; i < this.n; i++) {
      if (age[i] >= life[i]) {
        if (size[i] !== 0) {
          size[i] = 0
          col[i * 4 + 3] = 0
        }
        continue
      }
      age[i] += dt
      const t = Math.min(1, age[i] / life[i])
      const dr = Math.exp(-this.drag[i] * dt)
      vel[i * 3] *= dr
      vel[i * 3 + 1] *= dr
      vel[i * 3 + 2] *= dr
      pos[i * 3] += vel[i * 3] * dt
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      col[i * 4] = this.col0[i * 3] + (this.col1[i * 3] - this.col0[i * 3]) * t
      col[i * 4 + 1] = this.col0[i * 3 + 1] + (this.col1[i * 3 + 1] - this.col0[i * 3 + 1]) * t
      col[i * 4 + 2] = this.col0[i * 3 + 2] + (this.col1[i * 3 + 2] - this.col0[i * 3 + 2]) * t
      col[i * 4 + 3] = this.smoke ? (1 - t) * Math.min(1, t * 6) : 1 - t * t
      size[i] = this.size0[i] * (1 + (this.grow[i] - 1) * t)
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.aColor.needsUpdate = true
    this.geo.attributes.aSize.needsUpdate = true
  }

  clear() {
    this.age.fill(1e9)
    this.size.fill(0)
  }
}
