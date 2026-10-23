import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, Vector3, type Mesh } from 'three'
import { getScaledEnemyStats } from '@/data/enemies'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { sphereCollision } from '@/systems/collision'
import {
  cameraImpact,
  drainProjectileQueue,
  queueExplosion,
  worldRegistry,
} from '@/systems/worldRegistry'

const POOL_SIZE = 112
const zAxis = new Vector3(0, 0, 1)

interface RuntimeProjectile {
  active: boolean
  owner: 'martian' | 'earth'
  target: 'player' | 'station' | 'enemy'
  position: Vector3
  velocity: Vector3
  life: number
  damage: number
  color: string
}

function makeProjectile(): RuntimeProjectile {
  return {
    active: false,
    owner: 'martian',
    target: 'enemy',
    position: new Vector3(),
    velocity: new Vector3(),
    life: 0,
    damage: 0,
    color: '#f07836',
  }
}

export function ProjectilePool() {
  const meshes = useRef<Array<Mesh | null>>(Array.from({ length: POOL_SIZE }, () => null))
  const pool = useRef<Array<RuntimeProjectile>>(Array.from({ length: POOL_SIZE }, makeProjectile))
  const cursor = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    if (useGameStore.getState().screen !== 'playing') return

    for (const request of drainProjectileQueue()) {
      const index = cursor.current
      cursor.current = (cursor.current + 1) % POOL_SIZE
      const projectile = pool.current[index]
      const mesh = meshes.current[index]

      projectile.active = true
      projectile.owner = request.owner
      projectile.target = request.target
      projectile.position.copy(request.position)
      projectile.velocity.copy(request.direction).multiplyScalar(request.speed)
      projectile.life = 0
      projectile.damage = request.damage
      projectile.color = request.color

      if (mesh) {
        mesh.visible = true
        mesh.position.copy(projectile.position)
        mesh.scale.set(
          request.owner === 'martian' ? 0.19 : 0.15,
          request.owner === 'martian' ? 0.19 : 0.15,
          request.owner === 'martian' ? 2.7 : 2.1,
        )
        mesh.quaternion.setFromUnitVectors(zAxis, request.direction)
        const material = mesh.material as MeshBasicMaterial
        material.color.set(request.color)
      }
    }

    pool.current.forEach((projectile, index) => {
      if (!projectile.active) return
      const mesh = meshes.current[index]
      projectile.life += delta
      projectile.position.addScaledVector(projectile.velocity, delta)
      if (mesh) mesh.position.copy(projectile.position)

      if (projectile.life > 7.5) {
        projectile.active = false
        if (mesh) mesh.visible = false
        return
      }

      if (projectile.owner === 'martian') {
        for (const enemy of worldRegistry.enemies.values()) {
          if (enemy.destroyed || !sphereCollision(projectile.position, 0.42, enemy.position, enemy.radius)) continue

          enemy.health -= projectile.damage
          projectile.active = false
          if (mesh) mesh.visible = false
          queueExplosion({ position: projectile.position, color: '#f5a05e', size: 1.4, kind: 'impact' })

          if (enemy.health <= 0 && !enemy.destroyed) {
            enemy.destroyed = true
            const stats = getScaledEnemyStats(enemy.type, enemy.level)
            queueExplosion({
              position: enemy.position,
              color: enemy.type === 'boss' ? '#c6deec' : '#74b9e2',
              size: enemy.type === 'boss' ? 18 : enemy.type === 'bomber' ? 7 : 4,
              kind: 'explosion',
            })
            useGameStore.getState().removeEnemy(enemy.id, stats.reward)

            if (enemy.type === 'boss') {
              useGameStore.getState().setMissionMessage('DREADNOUGHT CORE COLLAPSE')
              window.setTimeout(() => useGameStore.getState().win(), 950)
            }
          }
          break
        }
        return
      }

      if (projectile.target === 'station') {
        if (!sphereCollision(projectile.position, 0.35, worldRegistry.stationPosition, 8.8)) return
        projectile.active = false
        if (mesh) mesh.visible = false
        queueExplosion({ position: projectile.position, color: '#c56b3b', size: 2.3, kind: 'impact' })
        cameraImpact.amount = Math.max(cameraImpact.amount, 0.08)
        if (useGameStore.getState().damageStation(projectile.damage)) {
          useGameStore.getState().lose('The Martian orbital station was destroyed.')
        }
        return
      }

      if (sphereCollision(projectile.position, 0.35, worldRegistry.playerPosition, 3.2)) {
        projectile.active = false
        if (mesh) mesh.visible = false
        queueExplosion({ position: projectile.position, color: '#78bde6', size: 1.8, kind: 'impact' })
        cameraImpact.amount = Math.max(cameraImpact.amount, 0.42)
        if (usePlayerStore.getState().applyDamage(projectile.damage)) {
          useGameStore.getState().lose('Your fighter hull was breached.')
        }
      }
    })
  })

  return (
    <group>
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => { meshes.current[index] = mesh }}
          visible={false}
          frustumCulled={false}
        >
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color="#f07836" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
