import { Quaternion, Vector3 } from 'three'
import type { ExplosionRequest, ProjectileRequest, RuntimeEnemy } from '@/types/game'

export const worldRegistry = {
  playerPosition: new Vector3(0, 4, 76),
  playerQuaternion: new Quaternion(),
  playerVelocity: new Vector3(),
  stationPosition: new Vector3(0, 0, 12),
  enemies: new Map<string, RuntimeEnemy>(),
}

const projectileQueue: ProjectileRequest[] = []
const explosionQueue: ExplosionRequest[] = []

export const cameraImpact = { amount: 0 }

export function queueProjectile(request: ProjectileRequest) {
  projectileQueue.push({
    ...request,
    position: request.position.clone(),
    direction: request.direction.clone().normalize(),
  })
}

export function drainProjectileQueue() {
  return projectileQueue.splice(0, projectileQueue.length)
}

export function queueExplosion(request: ExplosionRequest) {
  explosionQueue.push({ ...request, position: request.position.clone() })
}

export function drainExplosionQueue() {
  return explosionQueue.splice(0, explosionQueue.length)
}

export function clearWorldRegistry() {
  worldRegistry.enemies.clear()
  projectileQueue.length = 0
  explosionQueue.length = 0
  worldRegistry.playerPosition.set(0, 4, 76)
  worldRegistry.playerQuaternion.identity()
  worldRegistry.playerVelocity.set(0, 0, 0)
  cameraImpact.amount = 0
}
