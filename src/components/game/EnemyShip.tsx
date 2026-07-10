import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Quaternion, Vector3, type Group } from 'three'
import { EarthShipModel } from '@/components/game/ShipModels'
import { getScaledEnemyStats } from '@/data/enemies'
import { useGameStore } from '@/stores/gameStore'
import { EARTH_PROJECTILE_SPEED } from '@/systems/combat'
import { updateEnemyAI } from '@/systems/enemyAI'
import { queueProjectile, worldRegistry } from '@/systems/worldRegistry'
import type { EnemySpawn, RuntimeEnemy } from '@/types/game'

const fireDirection = new Vector3()
const spread = new Vector3()

export function EnemyShip({ spawn }: { spawn: EnemySpawn }) {
  const group = useRef<Group>(null)
  const screen = useGameStore((state) => state.screen)
  const isSelected = useGameStore((state) => state.lockedTargetId === spawn.id)
  const stats = useMemo(() => getScaledEnemyStats(spawn.type, spawn.level), [spawn.level, spawn.type])
  const runtime = useMemo<RuntimeEnemy>(() => ({
    id: spawn.id,
    type: spawn.type,
    group: null,
    position: new Vector3(...spawn.position),
    velocity: new Vector3(0, 0, 8),
    quaternion: new Quaternion(),
    health: stats.hull,
    maxHealth: stats.hull,
    state: 'PATROL',
    radius: stats.radius,
    lastShot: -Math.random() * 2,
    level: spawn.level,
    destroyed: false,
  }), [spawn.id, spawn.level, spawn.position, spawn.type, stats.hull, stats.radius])

  useEffect(() => {
    runtime.group = group.current
    worldRegistry.enemies.set(runtime.id, runtime)
    return () => {
      worldRegistry.enemies.delete(runtime.id)
    }
  }, [runtime])

  useFrame((state, rawDelta) => {
    if (!group.current || screen !== 'playing' || runtime.destroyed) return
    const delta = Math.min(rawDelta, 0.05)
    const elapsed = state.clock.elapsedTime
    const result = updateEnemyAI(runtime, delta, elapsed)

    group.current.position.copy(runtime.position)
    group.current.quaternion.copy(runtime.quaternion)

    if (result.shouldFire) {
      fireDirection.copy(result.target).sub(runtime.position).normalize()
      const inaccuracy = (1 - stats.accuracy) * 0.24
      spread.set(
        (Math.random() - 0.5) * inaccuracy,
        (Math.random() - 0.5) * inaccuracy,
        (Math.random() - 0.5) * inaccuracy,
      )
      fireDirection.add(spread).normalize()

      queueProjectile({
        owner: 'earth',
        position: runtime.position.clone().addScaledVector(fireDirection, runtime.radius * 1.15),
        direction: fireDirection,
        speed: EARTH_PROJECTILE_SPEED + (spawn.type === 'interceptor' ? 18 : 0),
        damage: stats.damage,
        color: '#6cb4e5',
        target: spawn.type === 'bomber' || spawn.type === 'boss' ? 'station' : 'player',
      })
      runtime.lastShot = elapsed
    }
  })

  return (
    <group ref={group} position={spawn.position}>
      <EarthShipModel type={spawn.type} />
      {isSelected ? (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[stats.radius * 1.65, 0.08, 8, 32]} />
            <meshBasicMaterial color="#9ac9e6" transparent opacity={0.78} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <pointLight color="#80bfe8" intensity={5} distance={12} decay={2} />
        </group>
      ) : null}
    </group>
  )
}
