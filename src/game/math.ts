import * as THREE from 'three'

export const V = () => new THREE.Vector3()
export const UP = new THREE.Vector3(0, 1, 0)
export const FORWARD = new THREE.Vector3(0, 0, -1)
export const RIGHT = new THREE.Vector3(1, 0, 0)

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Deterministic PRNG so procedural models look the same on every load. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
export const randSign = () => (Math.random() < 0.5 ? -1 : 1)

export function randomUnit(out: THREE.Vector3) {
  const u = Math.random() * 2 - 1
  const t = Math.random() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return out.set(s * Math.cos(t), u, s * Math.sin(t))
}

const _m = new THREE.Matrix4()
/** Quaternion whose -Z axis points along dir. */
export function quatLookDir(out: THREE.Quaternion, dir: THREE.Vector3, up: THREE.Vector3 = UP) {
  const u = Math.abs(dir.dot(up)) > 0.995 ? RIGHT : up
  _m.lookAt(ZERO, dir, u)
  return out.setFromRotationMatrix(_m)
}
const ZERO = new THREE.Vector3()

/** Rotate quaternion `q` toward `target` by at most maxAngle radians. */
export function rotateTowards(q: THREE.Quaternion, target: THREE.Quaternion, maxAngle: number) {
  const angle = q.angleTo(target)
  if (angle < 1e-5) return q.copy(target)
  return q.slerp(target, Math.min(1, maxAngle / angle))
}

/** First-order intercept: where to aim to hit a target moving at constant velocity. */
export function leadPoint(
  out: THREE.Vector3,
  shooter: THREE.Vector3,
  shooterVel: THREE.Vector3,
  target: THREE.Vector3,
  targetVel: THREE.Vector3,
  projectileSpeed: number,
) {
  const rx = target.x - shooter.x
  const ry = target.y - shooter.y
  const rz = target.z - shooter.z
  const vx = targetVel.x - shooterVel.x
  const vy = targetVel.y - shooterVel.y
  const vz = targetVel.z - shooterVel.z
  const a = vx * vx + vy * vy + vz * vz - projectileSpeed * projectileSpeed
  const b = 2 * (rx * vx + ry * vy + rz * vz)
  const c = rx * rx + ry * ry + rz * rz
  let t = 0
  if (Math.abs(a) < 1e-6) t = -c / b
  else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      const t1 = (-b - s) / (2 * a)
      const t2 = (-b + s) / (2 * a)
      t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2)
    }
  }
  if (!(t > 0) || t > 6) t = Math.sqrt(c) / projectileSpeed
  return out.set(target.x + vx * t, target.y + vy * t, target.z + vz * t)
}

/** Distance squared from point p to segment ab. */
export function segPointDistSq(a: THREE.Vector3, b: THREE.Vector3, p: THREE.Vector3) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const apx = p.x - a.x
  const apy = p.y - a.y
  const apz = p.z - a.z
  const len = abx * abx + aby * aby + abz * abz
  let t = len > 0 ? (apx * abx + apy * aby + apz * abz) / len : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = apx - abx * t
  const dy = apy - aby * t
  const dz = apz - abz * t
  return dx * dx + dy * dy + dz * dz
}
