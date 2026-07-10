import { worldRegistry } from '@/systems/worldRegistry'

export function findNearestEnemyId() {
  let nearestId: string | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const enemy of worldRegistry.enemies.values()) {
    if (enemy.destroyed) continue
    const distance = enemy.position.distanceToSquared(worldRegistry.playerPosition)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestId = enemy.id
    }
  }

  return nearestId
}

export function findEnemyInAimCone(maxAngle = 0.24) {
  const forward = worldRegistry.playerVelocity.clone()
  if (forward.lengthSq() < 0.1) forward.set(0, 0, -1).applyQuaternion(worldRegistry.playerQuaternion)
  forward.normalize()

  let targetId: string | null = null
  let bestAngle = maxAngle
  for (const enemy of worldRegistry.enemies.values()) {
    const direction = enemy.position.clone().sub(worldRegistry.playerPosition).normalize()
    const angle = forward.angleTo(direction)
    if (angle < bestAngle) {
      bestAngle = angle
      targetId = enemy.id
    }
  }

  return targetId
}
