import { Matrix4, Quaternion, Vector3 } from 'three'
import { getScaledEnemyStats } from '@/data/enemies'
import { worldRegistry } from '@/systems/worldRegistry'
import type { RuntimeEnemy } from '@/types/game'

const direction = new Vector3()
const desiredVelocity = new Vector3()
const target = new Vector3()
const avoidance = new Vector3()
const lookMatrix = new Matrix4()
const targetQuaternion = new Quaternion()
const marsCenter = new Vector3(0, -58, -92)

export interface EnemyAIResult {
  target: Vector3
  distance: number
  shouldFire: boolean
}

export function updateEnemyAI(enemy: RuntimeEnemy, delta: number, elapsed: number): EnemyAIResult {
  const stats = getScaledEnemyStats(enemy.type, enemy.level)
  const primaryTarget = enemy.type === 'bomber' || enemy.type === 'boss'
    ? worldRegistry.stationPosition
    : worldRegistry.playerPosition

  target.copy(primaryTarget)
  const distance = enemy.position.distanceTo(target)

  if (enemy.destroyed) {
    enemy.state = 'DESTROYED'
    return { target: target.clone(), distance, shouldFire: false }
  }

  if (distance > stats.fireRange * 1.3) enemy.state = 'CHASE'
  else if (distance > stats.radius * 4) enemy.state = 'ATTACK'
  else enemy.state = 'EVADE'

  if (enemy.type === 'interceptor' && enemy.state !== 'EVADE') {
    const side = Math.sin(elapsed * 0.85 + enemy.position.x) > 0 ? 1 : -1
    target.x += side * 34
    target.y += Math.sin(elapsed * 0.55 + enemy.position.z) * 16
    target.z += 12
  }

  if (enemy.state === 'EVADE') {
    target.copy(enemy.position).sub(primaryTarget).normalize().multiplyScalar(30).add(enemy.position)
    target.y += Math.sin(elapsed * 2 + enemy.position.x) * 12
  }

  direction.copy(target).sub(enemy.position).normalize()
  avoidance.set(0, 0, 0)

  const marsDistance = enemy.position.distanceTo(marsCenter)
  if (marsDistance < 54) {
    avoidance.add(enemy.position.clone().sub(marsCenter).normalize().multiplyScalar((54 - marsDistance) / 18))
  }

  for (const other of worldRegistry.enemies.values()) {
    if (other.id === enemy.id || other.destroyed) continue
    const separation = enemy.position.distanceTo(other.position)
    if (separation > 0 && separation < enemy.radius + other.radius + 3) {
      avoidance.add(enemy.position.clone().sub(other.position).normalize().multiplyScalar(0.75))
    }
  }

  direction.add(avoidance).normalize()
  const speedMultiplier = enemy.state === 'EVADE' ? 1.2 : 1
  desiredVelocity.copy(direction).multiplyScalar(stats.speed * speedMultiplier)
  enemy.velocity.lerp(desiredVelocity, 1 - Math.exp(-2.7 * delta))
  enemy.position.addScaledVector(enemy.velocity, delta)

  lookMatrix.lookAt(enemy.position, enemy.position.clone().add(direction), new Vector3(0, 1, 0))
  targetQuaternion.setFromRotationMatrix(lookMatrix)
  enemy.quaternion.slerp(targetQuaternion, 1 - Math.exp(-4.5 * delta))

  const aimDistance = enemy.position.distanceTo(primaryTarget)
  const shouldFire = enemy.state === 'ATTACK'
    && aimDistance < stats.fireRange
    && elapsed - enemy.lastShot > stats.fireCooldown

  return { target: primaryTarget.clone(), distance: aimDistance, shouldFire }
}
