import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, MeshBasicMaterial, type Group, type Mesh } from 'three'
import { drainExplosionQueue } from '@/systems/worldRegistry'

const POOL_SIZE = 28

interface RuntimeExplosion {
  active: boolean
  age: number
  duration: number
  size: number
  kind: 'explosion' | 'impact'
  color: string
}

function createExplosion(): RuntimeExplosion {
  return { active: false, age: 0, duration: 0.8, size: 1, kind: 'explosion', color: '#f07836' }
}

function updateGroupMaterials(group: Group, color: string, opacity: number) {
  group.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as MeshBasicMaterial
    material.color.set(color)
    material.opacity = opacity
  })
}

export function ExplosionPool() {
  const groups = useRef<Array<Group | null>>(Array.from({ length: POOL_SIZE }, () => null))
  const pool = useRef<Array<RuntimeExplosion>>(Array.from({ length: POOL_SIZE }, createExplosion))
  const cursor = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)

    for (const request of drainExplosionQueue()) {
      const index = cursor.current
      cursor.current = (cursor.current + 1) % POOL_SIZE
      const effect = pool.current[index]
      const group = groups.current[index]

      effect.active = true
      effect.age = 0
      effect.duration = request.kind === 'impact' ? 0.42 : 1.05
      effect.size = request.size
      effect.kind = request.kind
      effect.color = request.color

      if (group) {
        group.visible = true
        group.position.copy(request.position)
        group.scale.setScalar(request.kind === 'impact' ? 0.15 : 0.05)
        updateGroupMaterials(group, request.color, 0.92)
      }
    }

    pool.current.forEach((effect, index) => {
      if (!effect.active) return
      const group = groups.current[index]
      effect.age += delta
      const progress = effect.age / effect.duration
      if (progress >= 1) {
        effect.active = false
        if (group) group.visible = false
        return
      }

      if (group) {
        const eased = 1 - Math.pow(1 - progress, 3)
        const scale = effect.kind === 'impact'
          ? effect.size * (0.15 + eased * 0.9)
          : effect.size * (0.08 + eased)
        group.scale.setScalar(scale)
        group.rotation.x += delta * 1.7
        group.rotation.y -= delta * 2.1
        updateGroupMaterials(group, effect.color, (1 - progress) * 0.82)
      }
    })
  })

  return (
    <group>
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <group key={index} ref={(group) => { groups.current[index] = group }} visible={false}>
          <mesh>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial color="#f07836" wireframe transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.8, 0.08, 6, 20]} />
            <meshBasicMaterial color="#f4b078" transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
