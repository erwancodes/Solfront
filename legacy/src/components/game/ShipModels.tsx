import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { AdditiveBlending, Box3, Color, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { EnemyType } from '@/types/game'

const MODEL_PATHS = {
  martian: '/models/ships/martian-fighter.glb',
  fighter: '/models/ships/earth-fighter.glb',
  interceptor: '/models/ships/earth-interceptor.glb',
  bomber: '/models/ships/earth-bomber.glb',
  boss: '/models/ships/earth-boss.glb',
} as const

function usePreparedShip(path: string, targetSize: number, faction: 'martian' | 'earth') {
  const { scene } = useGLTF(path)

  return useMemo(() => {
    const clone = scene.clone(true)
    const factionColor = new Color(faction === 'martian' ? '#8e3f2c' : '#748b9c')

    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return
      child.frustumCulled = true
      child.castShadow = false
      child.receiveShadow = false

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
      const materials = sourceMaterials.map((source, index) => {
        const material = source.clone()
        if ('color' in material && material.color instanceof Color) {
          const strength = faction === 'martian' ? 0.42 : 0.62
          material.color.lerp(factionColor, strength + (index % 2) * 0.08)
        }
        if (material instanceof MeshStandardMaterial) {
          material.roughness = Math.min(0.58, material.roughness + 0.04)
          material.metalness = Math.max(0.42, material.metalness)
          material.envMapIntensity = 0.8
          material.emissive.copy(factionColor)
          material.emissiveIntensity = faction === 'martian' ? 0.1 : 0.07
        }
        return material
      })
      child.material = Array.isArray(child.material) ? materials : materials[0]
    })

    const box = new Box3().setFromObject(clone)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const normalizationScale = targetSize / maxDimension
    clone.scale.setScalar(normalizationScale)
    clone.position.copy(center).multiplyScalar(-normalizationScale)

    return clone
  }, [faction, scene, targetSize])
}

function EngineFlare({ color, size = 1 }: { color: string; size?: number }) {
  return (
    <group position={[0, 0, 2.25 * size]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28 * size, 2.5 * size, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={10 * size} distance={9 * size} decay={2} />
    </group>
  )
}

export function MartianShipModel({ preview = false }: { preview?: boolean }) {
  const model = usePreparedShip(MODEL_PATHS.martian, preview ? 8.4 : 5.6, 'martian')

  return (
    <group rotation={[0, Math.PI, 0]}>
      <primitive object={model} />
      <EngineFlare color="#dc6832" size={preview ? 1.25 : 1} />
    </group>
  )
}

export function EarthShipModel({ type }: { type: EnemyType }) {
  const size = type === 'boss' ? 24 : type === 'bomber' ? 8.2 : type === 'interceptor' ? 4.6 : 5.8
  const model = usePreparedShip(MODEL_PATHS[type], size, 'earth')

  return (
    <group rotation={[0, Math.PI, 0]}>
      <primitive object={model} />
      <EngineFlare color="#6eaedf" size={type === 'boss' ? 2.5 : type === 'bomber' ? 1.3 : 0.9} />
    </group>
  )
}

Object.values(MODEL_PATHS).forEach((path) => useGLTF.preload(path))
