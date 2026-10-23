import * as THREE from 'three'

const POINTS = 22

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 aColor;
varying vec4 vColor;
void main(){
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`
const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec4 vColor;
void main(){
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(vColor.rgb * vColor.a, 1.0);
}`

export interface Trail {
  slot: number
  color: THREE.Color
  width: number
  pts: THREE.Vector3[]
  head: number
  filled: number
  timer: number
  active: boolean
  intensity: number
}

/** Camera-facing ribbon trails for engines and missiles, batched into one mesh. */
export class TrailSystem {
  readonly mesh: THREE.Mesh
  private trails: (Trail | null)[]
  private pos: Float32Array
  private col: Float32Array
  private geo: THREE.BufferGeometry
  private tmp = new THREE.Vector3()
  private side = new THREE.Vector3()
  private toCam = new THREE.Vector3()

  constructor(max = 96) {
    this.trails = new Array(max).fill(null)
    const verts = max * POINTS * 2
    this.pos = new Float32Array(verts * 3)
    this.col = new Float32Array(verts * 4)
    const idx: number[] = []
    for (let s = 0; s < max; s++) {
      const base = s * POINTS * 2
      for (let i = 0; i < POINTS - 1; i++) {
        const a = base + i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage))
    this.geo.setIndex(idx)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    this.mesh = new THREE.Mesh(this.geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 4
  }

  create(color: THREE.Color, width: number, at: THREE.Vector3): Trail | null {
    const slot = this.trails.indexOf(null)
    if (slot < 0) return null
    const t: Trail = { slot, color: color.clone(), width, pts: [], head: 0, filled: 0, timer: 0, active: true, intensity: 1 }
    for (let i = 0; i < POINTS; i++) t.pts.push(at.clone())
    this.trails[slot] = t
    return t
  }

  release(t: Trail | null) {
    if (!t) return
    this.trails[t.slot] = null
    const base = t.slot * POINTS * 2
    this.col.fill(0, base * 4, (base + POINTS * 2) * 4)
  }

  push(t: Trail, p: THREE.Vector3, dt: number) {
    t.timer += dt
    // the newest point always follows the emitter; older points are dropped at fixed intervals
    if (t.timer > 0.03) {
      t.timer = 0
      t.head = (t.head + 1) % POINTS
      t.filled = Math.min(POINTS, t.filled + 1)
    }
    t.pts[t.head].copy(p)
  }

  update(camera: THREE.Camera) {
    for (const t of this.trails) {
      if (!t) continue
      const base = t.slot * POINTS * 2
      for (let i = 0; i < POINTS; i++) {
        const k = (t.head - i + POINTS) % POINTS
        const kn = (k - 1 + POINTS) % POINTS
        const p = t.pts[k]
        const pn = i < POINTS - 1 ? t.pts[kn] : t.pts[(k + 1) % POINTS]
        this.tmp.subVectors(pn, p)
        if (i === POINTS - 1) this.tmp.negate()
        this.toCam.subVectors(camera.position, p)
        this.side.crossVectors(this.tmp, this.toCam).normalize()
        const f = 1 - i / (POINTS - 1)
        const w = t.width * (0.25 + 0.75 * f)
        const valid = i <= t.filled ? 1 : 0
        // ribbons that sweep past the chase camera would fill the screen, so fade them out up close
        const near = Math.min(1, Math.max(0, (this.toCam.length() - 30) / 50))
        const a = f * f * t.intensity * valid * near
        const v0 = (base + i * 2) * 3
        this.pos[v0] = p.x + this.side.x * w
        this.pos[v0 + 1] = p.y + this.side.y * w
        this.pos[v0 + 2] = p.z + this.side.z * w
        this.pos[v0 + 3] = p.x - this.side.x * w
        this.pos[v0 + 4] = p.y - this.side.y * w
        this.pos[v0 + 5] = p.z - this.side.z * w
        const c0 = (base + i * 2) * 4
        for (let s = 0; s < 2; s++) {
          this.col[c0 + s * 4] = t.color.r
          this.col[c0 + s * 4 + 1] = t.color.g
          this.col[c0 + s * 4 + 2] = t.color.b
          this.col[c0 + s * 4 + 3] = a
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.aColor.needsUpdate = true
  }

  clear() {
    for (const t of this.trails) if (t) this.release(t)
  }
}
