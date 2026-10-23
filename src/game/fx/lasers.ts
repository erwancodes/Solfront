import * as THREE from 'three'
import { quatLookDir } from '../math'
import type { Team } from '../types'

export interface Bolt {
  alive: boolean
  team: Team
  pos: THREE.Vector3
  prev: THREE.Vector3
  vel: THREE.Vector3
  life: number
  damage: number
  owner: number
}

/** Instanced pool of laser bolts: one draw call for every shot in flight. */
export class LaserPool {
  readonly mesh: THREE.InstancedMesh
  readonly bolts: Bolt[] = []
  private max: number
  private dummy = new THREE.Object3D()
  private colors: Record<Team, THREE.Color> = {
    mars: new THREE.Color(9, 4.2, 1.2),
    terra: new THREE.Color(1.2, 4.5, 9),
  }

  constructor(max = 600) {
    this.max = max
    const geo = new THREE.CylinderGeometry(0.22, 0.22, 1, 6, 1)
    geo.rotateX(Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
    this.mesh = new THREE.InstancedMesh(geo, mat, max)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    for (let i = 0; i < max; i++) {
      this.bolts.push({ alive: false, team: 'mars', pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, damage: 0, owner: -1 })
      this.mesh.setColorAt(i, this.colors.mars)
    }
  }

  fire(team: Team, pos: THREE.Vector3, vel: THREE.Vector3, damage: number, owner: number, life = 1.6) {
    let b = this.bolts.find((x) => !x.alive)
    if (!b) b = this.bolts[Math.floor(Math.random() * this.max)]
    b.alive = true
    b.team = team
    b.pos.copy(pos)
    b.prev.copy(pos)
    b.vel.copy(vel)
    b.life = life
    b.damage = damage
    b.owner = owner
    return b
  }

  update(dt: number) {
    let n = 0
    const q = this.dummy.quaternion
    const dir = new THREE.Vector3()
    for (const b of this.bolts) {
      if (!b.alive) continue
      b.prev.copy(b.pos)
      b.pos.addScaledVector(b.vel, dt)
      b.life -= dt
      if (b.life <= 0) {
        b.alive = false
        continue
      }
      dir.copy(b.vel).normalize()
      quatLookDir(q, dir)
      this.dummy.position.copy(b.pos).addScaledVector(dir, -6)
      this.dummy.scale.set(b.team === 'mars' ? 1.25 : 1, b.team === 'mars' ? 1.25 : 1, 14)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(n, this.dummy.matrix)
      this.mesh.setColorAt(n, this.colors[b.team])
      n++
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear() {
    for (const b of this.bolts) b.alive = false
    this.mesh.count = 0
  }
}
