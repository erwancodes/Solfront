import * as THREE from 'three'
import type { Trail } from './fx/trails'
import { getShipModel, type ShipKind, type ShipModel } from './models/ships'
import type { Obstacle } from './world/scenery'
import type { Target, TargetKind, Team } from './types'

export const clock = { t: 0 }

let nextId = 1
export const newId = () => nextId++

export interface ShipStats {
  maxSpeed: number
  boostSpeed: number
  accel: number
  turnRate: number
  hp: number
  shield: number
  fireRate: number
  damage: number
  boltSpeed: number
}

export const STATS: Record<ShipKind, ShipStats> = {
  vanguard: { maxSpeed: 160, boostSpeed: 300, accel: 120, turnRate: 2.1, hp: 100, shield: 60, fireRate: 0.085, damage: 9, boltSpeed: 900 },
  wingman: { maxSpeed: 165, boostSpeed: 260, accel: 110, turnRate: 1.9, hp: 220, shield: 80, fireRate: 0.16, damage: 8, boltSpeed: 900 },
  hornet: { maxSpeed: 150, boostSpeed: 230, accel: 100, turnRate: 1.6, hp: 40, shield: 0, fireRate: 0.24, damage: 6, boltSpeed: 760 },
  lance: { maxSpeed: 190, boostSpeed: 280, accel: 130, turnRate: 2.0, hp: 28, shield: 0, fireRate: 0.32, damage: 6, boltSpeed: 800 },
  atlas: { maxSpeed: 95, boostSpeed: 140, accel: 60, turnRate: 0.8, hp: 110, shield: 0, fireRate: 0.55, damage: 16, boltSpeed: 650 },
}

export type AIMode = 'attack' | 'break' | 'evade' | 'return'

export interface AIState {
  mode: AIMode
  timer: number
  target: Target | null
  retarget: number
  jink: THREE.Vector3
  missileTimer: number
  /** 0..1, how hard this pilot tries. */
  skill: number
  role: 'fighter' | 'bomber' | 'escort'
}

export class Ship implements Target {
  id = newId()
  team: Team
  kind: TargetKind
  shipKind: ShipKind
  name: string
  root = new THREE.Group()
  bank = new THREE.Group()
  model: ShipModel
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  velocity = new THREE.Vector3()
  speed = 0
  throttle = 0.6
  radius: number
  stats: ShipStats
  hp: number
  maxHp: number
  shield: number
  maxShield: number
  alive = true
  targetable = true
  invulnerable = false
  lastHit = -10
  lastAttacker = -1
  lastAttackerTeam: Team | null = null
  fireTimer = 0
  muzzleIdx = 0
  trails: (Trail | null)[] = []
  ai: AIState | null = null
  bankAngle = 0
  hitFlash = 0
  /** Set by game code: damage multiplier for incoming damage. */
  armor = 1

  constructor(shipKind: ShipKind, team: Team, kind: TargetKind, name: string) {
    this.shipKind = shipKind
    this.team = team
    this.kind = kind
    this.name = name
    this.model = getShipModel(shipKind)
    this.bank.add(this.model.group)
    this.root.add(this.bank)
    this.position = this.root.position
    this.quaternion = this.root.quaternion
    this.radius = this.model.radius
    this.stats = STATS[shipKind]
    this.maxHp = this.hp = this.stats.hp
    this.maxShield = this.shield = this.stats.shield
  }

  damage(amount: number, _point: THREE.Vector3, sourceTeam: Team, sourceId: number) {
    if (!this.alive || this.invulnerable) return
    amount *= this.armor
    this.lastHit = clock.t
    this.lastAttacker = sourceId
    this.lastAttackerTeam = sourceTeam
    this.hitFlash = 1
    if (this.shield > 0) {
      const s = Math.min(this.shield, amount)
      this.shield -= s
      amount -= s
    }
    this.hp -= amount
  }

  forward(out: THREE.Vector3) {
    return out.set(0, 0, -1).applyQuaternion(this.quaternion)
  }
  up(out: THREE.Vector3) {
    return out.set(0, 1, 0).applyQuaternion(this.quaternion)
  }
  right(out: THREE.Vector3) {
    return out.set(1, 0, 0).applyQuaternion(this.quaternion)
  }

  /** World position of a local point on the hull. */
  local(out: THREE.Vector3, p: THREE.Vector3) {
    return out.copy(p).applyQuaternion(this.quaternion).add(this.position)
  }
}

export interface GunConfig {
  head: THREE.Object3D | null
  range: number
  rate: number
  damage: number
  speed: number
  /** Muzzle offset from the head origin, in head space. */
  muzzle: THREE.Vector3
  timer: number
  burst: number
}

/** Station, pylon, reactor, turret: anything big that doesn't fly. */
export class Structure implements Target {
  id = newId()
  team: Team
  kind: TargetKind
  name: string
  root: THREE.Object3D
  position = new THREE.Vector3()
  velocity = new THREE.Vector3()
  radius: number
  hp: number
  maxHp: number
  alive = true
  targetable: boolean
  invulnerable = false
  localSpheres: Obstacle[]
  spheres: Obstacle[] = []
  gun: GunConfig | null = null
  shieldMesh: THREE.Mesh | null = null
  shieldRadius = 0
  lastHit = -10
  /** Mount offset for structures carried by a parent (turrets on the dreadnought). */
  onDeath: (() => void) | null = null

  constructor(opts: { team: Team; kind: TargetKind; name: string; root: THREE.Object3D; hp: number; radius: number; spheres?: Obstacle[]; targetable?: boolean }) {
    this.team = opts.team
    this.kind = opts.kind
    this.name = opts.name
    this.root = opts.root
    this.hp = this.maxHp = opts.hp
    this.radius = opts.radius
    this.targetable = opts.targetable ?? true
    this.localSpheres = opts.spheres ?? [{ p: new THREE.Vector3(), r: opts.radius }]
    for (const s of this.localSpheres) this.spheres.push({ p: s.p.clone(), r: s.r })
    this.sync()
  }

  damage(amount: number) {
    if (!this.alive || this.invulnerable) return
    this.hp -= amount
    this.lastHit = clock.t
  }

  /** Recompute world positions after the root moved. */
  sync() {
    this.root.updateWorldMatrix(true, false)
    this.root.getWorldPosition(this.position)
    const m = this.root.matrixWorld
    const sc = new THREE.Vector3().setFromMatrixScale(m).x
    for (let i = 0; i < this.localSpheres.length; i++) {
      this.spheres[i].p.copy(this.localSpheres[i].p).applyMatrix4(m)
      this.spheres[i].r = this.localSpheres[i].r * sc
    }
  }
}

export class Missile {
  alive = true
  team: Team
  owner: number
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  target: Target | null
  life = 7
  speed: number
  maxSpeed: number
  turn: number
  damage: number
  trail: Trail | null = null
  mesh: THREE.Object3D
  decoyed = false

  constructor(team: Team, owner: number, target: Target | null, mesh: THREE.Object3D, opts: { speed: number; maxSpeed: number; turn: number; damage: number }) {
    this.team = team
    this.owner = owner
    this.target = target
    this.mesh = mesh
    this.speed = opts.speed
    this.maxSpeed = opts.maxSpeed
    this.turn = opts.turn
    this.damage = opts.damage
  }
}

/** Shared missile mesh: body, fins and a hot nozzle. */
export function makeMissileMesh(team: Team) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: team === 'mars' ? 0xd9d3c9 : 0xbcc5cf, metalness: 0.6, roughness: 0.4 }))
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: team === 'mars' ? 0xa33a1c : 0x24324a, metalness: 0.4, roughness: 0.5 }))
  tip.position.z = -2.6
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: team === 'mars' ? new THREE.Color(10, 5, 1.6) : new THREE.Color(2, 5, 10), toneMapped: false }))
  glow.position.z = 2.2
  g.add(body, tip, glow)
  return g
}
