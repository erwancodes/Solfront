import * as THREE from 'three'
import { Ship, Structure, clock } from './entities'
import { clamp, damp, leadPoint, quatLookDir, rand, randomUnit, rotateTowards } from './math'
import type { Obstacle } from './world/scenery'
import type { Target } from './types'

export interface AIWorld {
  ships: Ship[]
  structures: Structure[]
  obstacles: Obstacle[]
  arenaCenter: THREE.Vector3
  arenaRadius: number
  player: Ship | null
  /** Structure that bombers go for, when the sector has one. */
  bomberTarget: Target | null
  /** 0..1 global accuracy, set by difficulty. */
  skill: number
  fire(ship: Ship, aimAt: THREE.Vector3): void
  launchMissile(ship: Ship, target: Target): void
  fireTurret(s: Structure, from: THREE.Vector3, dir: THREE.Vector3): void
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _up = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _lead = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _qi = new THREE.Quaternion()

/** Shared flight model: turn toward dir at the ship's turn rate, then move. */
export function flyShip(ship: Ship, dir: THREE.Vector3, dt: number, throttle: number, boost: boolean, turnMul = 1) {
  ship.up(_up)
  quatLookDir(_q, dir, _up)
  rotateTowards(ship.quaternion, _q, ship.stats.turnRate * turnMul * dt)
  // bank into turns: how far the wanted direction is to the side, in ship space
  _qi.copy(ship.quaternion).invert()
  _a.copy(dir).applyQuaternion(_qi)
  const bankTarget = clamp(-_a.x * 2.4, -1.3, 1.3)
  ship.bankAngle = damp(ship.bankAngle, bankTarget, 4, dt)
  ship.bank.rotation.z = ship.bankAngle
  integrate(ship, dt, throttle, boost)
}

export function integrate(ship: Ship, dt: number, throttle: number, boost: boolean) {
  const st = ship.stats
  const want = boost ? st.boostSpeed : st.maxSpeed * clamp(throttle, 0, 1)
  ship.speed = damp(ship.speed, want, st.accel / Math.max(40, st.maxSpeed) * 1.6, dt)
  ship.forward(_fwd)
  _b.copy(_fwd).multiplyScalar(ship.speed)
  // a little slip so hard turns feel heavy
  ship.velocity.lerp(_b, 1 - Math.exp(-3.5 * dt))
  ship.position.addScaledVector(ship.velocity, dt)
}

/** Steer away from anything big along the flight path; returns true when it had to. */
function avoid(pos: THREE.Vector3, fwd: THREE.Vector3, speed: number, obstacles: Obstacle[], out: THREE.Vector3) {
  const look = 120 + speed * 2.2
  let worst = 0
  for (const o of obstacles) {
    _c.copy(o.p).sub(pos)
    const along = _c.dot(fwd)
    const r = o.r + 40
    if (along < -r || along > look + r) continue
    const distSq = _c.lengthSq()
    const perpSq = distSq - along * along
    if (perpSq > r * r) continue
    const urgency = 1 - Math.max(0, along) / (look + r)
    if (urgency <= worst) continue
    worst = urgency
    // push out sideways from the obstacle centre
    out.copy(fwd).multiplyScalar(along).sub(_c)
    if (out.lengthSq() < 1) out.set(0, 1, 0).cross(fwd)
    out.normalize()
  }
  return worst
}

function pickTarget(ship: Ship, w: AIWorld): Target | null {
  const ai = ship.ai!
  if (ai.role === 'bomber' && w.bomberTarget?.alive) return w.bomberTarget
  let best: Target | null = null
  let bestScore = Infinity
  const anchor = ai.role === 'escort' && w.player?.alive ? w.player.position : ship.position
  for (const s of w.ships) {
    if (!s.alive || s.team === ship.team || !s.targetable) continue
    let d = s.position.distanceTo(anchor)
    if (s.lastAttacker === ship.id) d *= 0.6
    // terran fighters like to go for the player, but not exclusively
    if (s.kind === 'player') d *= 0.75
    if (d < bestScore) {
      bestScore = d
      best = s
    }
  }
  if (ai.role === 'escort' && bestScore > 1800) return null
  return best
}

export function updateShipAI(ship: Ship, w: AIWorld, dt: number) {
  const ai = ship.ai
  if (!ai || !ship.alive) return
  ai.timer -= dt
  ai.retarget -= dt
  ai.missileTimer -= dt
  ship.fireTimer -= dt
  if (ai.retarget <= 0 || !ai.target?.alive) {
    ai.target = pickTarget(ship, w)
    ai.retarget = rand(1.2, 2.4)
  }
  ship.forward(_fwd)
  const t = ai.target
  let throttle = 0.85
  let boost = false
  _dir.copy(_fwd)

  if (clock.t - ship.lastHit < 0.25 && ai.mode === 'attack' && Math.random() < 0.6 * ai.skill) {
    ai.mode = 'evade'
    ai.timer = rand(0.8, 1.6)
    randomUnit(ai.jink)
  }

  if (ai.mode === 'break' || ai.mode === 'evade') {
    _dir.copy(ai.jink).addScaledVector(_fwd, 0.6).normalize()
    throttle = 1
    boost = ai.mode === 'evade'
    if (ai.timer <= 0) ai.mode = 'attack'
  } else if (t) {
    const dist = t.position.distanceTo(ship.position)
    const speed = ship.stats.boltSpeed
    leadPoint(_lead, ship.position, ship.velocity, t.position, t.velocity, speed)
    // worse pilots aim sloppier
    const wobble = (1 - ai.skill * w.skill) * 0.08 * dist
    _lead.x += Math.sin(clock.t * 1.7 + ship.id) * wobble
    _lead.y += Math.cos(clock.t * 1.3 + ship.id * 2) * wobble
    _dir.copy(_lead).sub(ship.position).normalize()
    const facing = _dir.dot(_fwd)
    const breakDist = ai.role === 'bomber' ? Math.max(260, t.radius * 1.6) : 150 + t.radius
    if (dist < breakDist && facing > 0) {
      ai.mode = 'break'
      ai.timer = ai.role === 'bomber' ? 3 : 1.5
      randomUnit(ai.jink)
      ai.jink.addScaledVector(_fwd, -ai.jink.dot(_fwd)).normalize()
    }
    throttle = dist > 900 ? 1 : dist < 300 ? 0.6 : 0.85
    boost = dist > 1400 && ai.role !== 'bomber'
    const fireCone = ai.role === 'bomber' ? 0.985 : 0.9945
    const range = ai.role === 'bomber' ? 1300 : 1100
    if (facing > fireCone && dist < range && ship.fireTimer <= 0) {
      ship.fireTimer = ship.stats.fireRate * rand(0.9, 1.4) / (0.5 + w.skill * 0.6)
      w.fire(ship, _lead)
    }
    if (ship.shipKind === 'lance' && ai.missileTimer <= 0 && t.kind === 'player' && dist < 1500 && facing > 0.85) {
      ai.missileTimer = rand(10, 14)
      w.launchMissile(ship, t)
    }
  } else if (ai.role === 'escort' && w.player?.alive) {
    // formation off the player's wing
    const p = w.player
    p.right(_a).multiplyScalar(ship.id % 2 ? 40 : -40)
    p.up(_b).multiplyScalar(8)
    _c.copy(p.position).add(_a).add(_b).addScaledVector(p.velocity, 0.8)
    _dir.copy(_c).sub(ship.position)
    const d = _dir.length()
    _dir.normalize()
    throttle = clamp(d / 120, 0.3, 1.2) * (p.speed / ship.stats.maxSpeed)
    boost = d > 500
    if (d < 60) _dir.lerp(p.forward(_a), 0.7).normalize()
  } else {
    // wander back toward the fight
    _dir.copy(w.arenaCenter).sub(ship.position).normalize()
  }

  const urgency = avoid(ship.position, _fwd, ship.speed, w.obstacles, _a)
  if (urgency > 0) {
    _dir.lerp(_a, clamp(urgency * 1.6, 0, 0.95)).normalize()
    if (urgency > 0.6) throttle = Math.min(throttle, 0.6)
  }
  const fromCenter = ship.position.distanceTo(w.arenaCenter)
  if (fromCenter > w.arenaRadius) {
    _b.copy(w.arenaCenter).sub(ship.position).normalize()
    _dir.lerp(_b, clamp((fromCenter - w.arenaRadius) / 600, 0.2, 0.9)).normalize()
  }
  flyShip(ship, _dir, dt, throttle, boost)
}

const _hp = new THREE.Vector3()
const _hq = new THREE.Quaternion()
const _pm = new THREE.Matrix4()

/** Point a turret head at the nearest hostile and shoot with lead. */
export function updateTurret(s: Structure, w: AIWorld, dt: number) {
  const g = s.gun
  if (!g || !s.alive || !g.head) return
  g.timer -= dt
  g.head.getWorldPosition(_hp)
  let best: Ship | null = null
  let bestD = g.range
  for (const sh of w.ships) {
    if (!sh.alive || sh.team === s.team) continue
    const d = sh.position.distanceTo(_hp)
    if (d < bestD) {
      bestD = d
      best = sh
    }
  }
  if (!best) return
  leadPoint(_lead, _hp, s.velocity, best.position, best.velocity, g.speed)
  const wobble = (1 - w.skill) * 0.05 * bestD
  _lead.x += Math.sin(clock.t * 2.1 + s.id) * wobble
  _lead.y += Math.cos(clock.t * 1.7 + s.id) * wobble
  _dir.copy(_lead).sub(_hp).normalize()
  // aim in the parent's frame so the head stays mounted however the hull moves
  const parent = g.head.parent!
  parent.updateWorldMatrix(true, false)
  _pm.extractRotation(parent.matrixWorld)
  _hq.setFromRotationMatrix(_pm).invert()
  _a.copy(_dir).applyQuaternion(_hq)
  quatLookDir(_q, _a)
  rotateTowards(g.head.quaternion, _q, 1.6 * dt)
  g.head.getWorldDirection(_b).negate()
  if (g.timer <= 0 && _b.dot(_dir) > 0.995) {
    g.burst++
    g.timer = g.burst % 4 === 0 ? g.rate * 6 : g.rate
    _c.copy(g.muzzle).applyMatrix4(g.head.matrixWorld)
    w.fireTurret(s, _c, _b)
  }
}
