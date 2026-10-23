import * as THREE from 'three'
import { makeRadialTexture } from '../materials'
import { Particles } from './particles'

interface Flash {
  light: THREE.PointLight
  life: number
  max: number
  power: number
}
interface Wave {
  mesh: THREE.Mesh
  life: number
  max: number
  size: number
}
interface Debris {
  alive: boolean
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: THREE.Euler
  spin: THREE.Vector3
  scale: number
  life: number
}

const FIRE = new THREE.Color(6, 3.2, 1.1)
const FIRE_END = new THREE.Color(1.2, 0.25, 0.05)
const SPARK = new THREE.Color(8, 6, 3.5)
const BLUE = new THREE.Color(2, 4.5, 9)

/** Explosions, impacts and engine exhaust built on two particle systems. */
export class Effects {
  readonly group = new THREE.Group()
  readonly glow = new Particles(9000)
  readonly smoke = new Particles(3000, true)
  private flashes: Flash[] = []
  private waves: Wave[] = []
  private debris: Debris[] = []
  private debrisMesh: THREE.InstancedMesh
  private dummy = new THREE.Object3D()

  constructor() {
    this.group.add(this.glow.points, this.smoke.points)
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffa860, 0, 0, 1.6)
      this.group.add(light)
      this.flashes.push({ light, life: 0, max: 1, power: 0 })
    }
    const ringTex = makeRadialTexture(256, [
      [0, 'rgba(255,255,255,0)'],
      [0.62, 'rgba(255,255,255,0)'],
      [0.86, 'rgba(255,255,255,0.9)'],
      [1, 'rgba(255,255,255,0)'],
    ])
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(3, 2, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      )
      mesh.visible = false
      this.group.add(mesh)
      this.waves.push({ mesh, life: 0, max: 1, size: 1 })
    }
    const rock = new THREE.DodecahedronGeometry(1, 0)
    this.debrisMesh = new THREE.InstancedMesh(rock, new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.6, metalness: 0.6, emissive: new THREE.Color(0.6, 0.2, 0.05) }), 220)
    this.debrisMesh.count = 0
    this.debrisMesh.frustumCulled = false
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.group.add(this.debrisMesh)
    for (let i = 0; i < 220; i++) {
      this.debris.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), scale: 1, life: 0 })
    }
  }

  setViewport(h: number, fov: number) {
    this.glow.setViewport(h, fov)
    this.smoke.setViewport(h, fov)
  }

  private flash(pos: THREE.Vector3, power: number, life: number, color?: THREE.Color) {
    let f = this.flashes[0]
    for (const x of this.flashes) if (x.life <= 0 || x.power < f.power) f = x
    f.light.position.copy(pos)
    f.light.color.copy(color ?? new THREE.Color(1, 0.62, 0.32))
    f.power = power
    f.life = life
    f.max = life
  }

  private wave(pos: THREE.Vector3, size: number, life: number, camera: THREE.Camera, color?: THREE.Color) {
    const w = this.waves.find((x) => x.life <= 0) ?? this.waves[0]
    w.mesh.visible = true
    w.mesh.position.copy(pos)
    w.mesh.quaternion.copy(camera.quaternion)
    ;(w.mesh.material as THREE.MeshBasicMaterial).color.copy(color ?? new THREE.Color(3, 2, 1.2))
    w.size = size
    w.life = life
    w.max = life
  }

  /** size: roughly the radius of what blew up. */
  explode(pos: THREE.Vector3, size: number, camera: THREE.Camera, vel?: THREE.Vector3, terran = false) {
    const k = size
    this.glow.emit({ count: Math.round(40 + k * 6), pos, vel, speed: [k * 2, k * 9], life: [0.35, 1.1], size: [k * 1.4, k * 3.2], grow: 0.3, color: FIRE, color2: FIRE_END, drag: 2.4 })
    this.glow.emit({ count: Math.round(30 + k * 4), pos, vel, speed: [k * 8, k * 22], life: [0.4, 1.6], size: [0.6, 1.6], grow: 0.2, color: SPARK, color2: FIRE_END, drag: 0.9 })
    this.glow.emit({ count: 6, pos, speed: [0, 1], life: [0.12, 0.2], size: [k * 7, k * 10], grow: 1.6, color: terran ? BLUE : new THREE.Color(10, 8, 6), drag: 0 })
    this.smoke.emit({ count: Math.round(14 + k * 2), pos, vel, speed: [k * 1, k * 4], life: [1.6, 3.5], size: [k * 2, k * 3.5], grow: 3, color: new THREE.Color(0.12, 0.1, 0.09), color2: new THREE.Color(0.05, 0.05, 0.055), drag: 1.2 })
    this.flash(pos, 600 * k * k, 0.5 + k * 0.03)
    this.wave(pos, k * 14, 0.7, camera)
    const chunks = Math.min(14, Math.round(k * 1.5))
    for (let i = 0; i < chunks; i++) {
      const d = this.debris.find((x) => !x.alive)
      if (!d) break
      d.alive = true
      d.pos.copy(pos)
      d.vel.randomDirection().multiplyScalar(k * (3 + Math.random() * 8))
      if (vel) d.vel.addScaledVector(vel, 0.6)
      d.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      d.spin.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3)
      d.scale = k * (0.08 + Math.random() * 0.14)
      d.life = 3 + Math.random() * 3
    }
  }

  /** Huge multi-stage blast for capital ships and stations. */
  bigExplosion(pos: THREE.Vector3, size: number, camera: THREE.Camera) {
    this.explode(pos, size * 0.2, camera)
    this.glow.emit({ count: 400, pos, speed: [size * 0.5, size * 2.2], life: [1, 3], size: [size * 0.15, size * 0.4], grow: 0.4, color: FIRE, color2: FIRE_END, drag: 0.8 })
    this.glow.emit({ count: 10, pos, speed: [0, 1], life: [0.4, 0.7], size: [size * 2, size * 3], grow: 2, color: new THREE.Color(12, 10, 8), drag: 0 })
    this.smoke.emit({ count: 260, pos, speed: [size * 0.2, size * 1.2], life: [3, 6], size: [size * 0.2, size * 0.5], grow: 3, color: new THREE.Color(0.16, 0.12, 0.1), color2: new THREE.Color(0.05, 0.05, 0.06), drag: 0.6 })
    this.flash(pos, 4e6 * (size / 100), 2.2)
    this.wave(pos, size * 6, 2.4, camera, new THREE.Color(4, 3, 2))
    this.wave(pos, size * 3.5, 1.6, camera, new THREE.Color(1.6, 2.6, 5))
  }

  impact(pos: THREE.Vector3, normal: THREE.Vector3 | null, terran: boolean) {
    const c = terran ? new THREE.Color(2, 4.5, 9) : new THREE.Color(9, 4.2, 1.2)
    this.glow.emit({ count: 10, pos, dir: normal ?? undefined, spread: normal ? 0.9 : 1, speed: [20, 90], life: [0.15, 0.45], size: [0.4, 1.0], color: c, color2: FIRE_END, drag: 3 })
    this.glow.emit({ count: 2, pos, speed: [0, 1], life: [0.08, 0.14], size: [5, 8], grow: 1.4, color: c, drag: 0 })
  }

  shieldHit(pos: THREE.Vector3) {
    this.glow.emit({ count: 14, pos, speed: [10, 50], life: [0.2, 0.5], size: [0.6, 1.4], color: new THREE.Color(1.4, 3.4, 7), color2: new THREE.Color(0.1, 0.3, 0.8), drag: 3 })
  }

  muzzle(pos: THREE.Vector3, vel: THREE.Vector3, terran: boolean) {
    this.glow.emit({ count: 1, pos, vel, speed: [0, 1], life: [0.05, 0.07], size: [3.5, 4.5], grow: 0.5, color: terran ? new THREE.Color(2, 5, 10) : new THREE.Color(10, 5, 1.5), drag: 0 })
  }

  exhaust(pos: THREE.Vector3, vel: THREE.Vector3, back: THREE.Vector3, color: THREE.Color, power: number) {
    this.glow.emit({ count: 1, pos, vel, dir: back, spread: 0.1, speed: [30 * power, 60 * power], life: [0.08, 0.16], size: [1.4 * power, 2.2 * power], grow: 0.2, color, drag: 0.5 })
  }

  warpFlash(pos: THREE.Vector3, size: number, camera: THREE.Camera) {
    this.glow.emit({ count: 3, pos, speed: [0, 1], life: [0.3, 0.5], size: [size * 4, size * 6], grow: 0.2, color: new THREE.Color(3, 6, 12), drag: 0 })
    this.glow.emit({ count: 40, pos, speed: [size * 2, size * 8], life: [0.3, 0.8], size: [0.6, 1.4], color: new THREE.Color(3, 6, 12), color2: new THREE.Color(0.2, 0.4, 1), drag: 2 })
    this.wave(pos, size * 8, 0.5, camera, new THREE.Color(1.5, 3, 6))
    this.flash(pos, 2000 * size, 0.4, new THREE.Color(0.5, 0.75, 1))
  }

  update(dt: number) {
    this.glow.update(dt)
    this.smoke.update(dt)
    for (const f of this.flashes) {
      if (f.life <= 0) {
        f.light.intensity = 0
        continue
      }
      f.life -= dt
      const t = Math.max(0, f.life / f.max)
      f.light.intensity = f.power * t * t
    }
    for (const w of this.waves) {
      if (w.life <= 0) {
        w.mesh.visible = false
        continue
      }
      w.life -= dt
      const t = 1 - w.life / w.max
      w.mesh.scale.setScalar(w.size * (0.2 + Math.sqrt(t) * 0.8) * 2)
      ;(w.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t
    }
    let n = 0
    for (const d of this.debris) {
      if (!d.alive) continue
      d.life -= dt
      if (d.life <= 0) {
        d.alive = false
        continue
      }
      d.pos.addScaledVector(d.vel, dt)
      d.rot.x += d.spin.x * dt
      d.rot.y += d.spin.y * dt
      d.rot.z += d.spin.z * dt
      this.dummy.position.copy(d.pos)
      this.dummy.rotation.copy(d.rot)
      this.dummy.scale.setScalar(d.scale * Math.min(1, d.life))
      this.dummy.updateMatrix()
      this.debrisMesh.setMatrixAt(n++, this.dummy.matrix)
      if (Math.random() < 0.15) this.smoke.emit({ count: 1, pos: d.pos, speed: [0, 2], life: [0.6, 1.2], size: [d.scale * 2, d.scale * 3], grow: 2.5, color: new THREE.Color(0.14, 0.12, 0.1), drag: 1 })
    }
    this.debrisMesh.count = n
    this.debrisMesh.instanceMatrix.needsUpdate = true
  }

  clear() {
    this.glow.clear()
    this.smoke.clear()
    for (const d of this.debris) d.alive = false
    for (const w of this.waves) w.life = 0
    for (const f of this.flashes) f.life = 0
  }
}
