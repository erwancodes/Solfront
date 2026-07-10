import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Group } from 'three'
import { useGameStore } from '@/stores/gameStore'
import { worldRegistry } from '@/systems/worldRegistry'

export function MarsStation() {
  const ring = useRef<Group>(null)
  const stationHealth = useGameStore((state) => state.stationHealth)
  const stationMaxHealth = useGameStore((state) => state.stationMaxHealth)
  const integrity = stationHealth / stationMaxHealth

  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.09
  })

  return (
    <group position={worldRegistry.stationPosition}>
      <group ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[8.5, 0.48, 10, 48]} />
          <meshStandardMaterial color="#81746a" emissive="#7a3322" emissiveIntensity={0.11} roughness={0.42} metalness={0.8} />
        </mesh>
        {Array.from({ length: 6 }, (_, index) => {
          const angle = (index / 6) * Math.PI * 2
          return (
            <mesh key={angle} position={[Math.cos(angle) * 8.5, Math.sin(angle) * 8.5, 0]} rotation={[0, 0, angle]}>
              <boxGeometry args={[2.8, 0.65, 1.2]} />
              <meshStandardMaterial color="#918278" emissive="#7a3322" emissiveIntensity={0.08} roughness={0.48} metalness={0.7} />
            </mesh>
          )
        })}
      </group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.8, 2.4, 12, 10]} />
        <meshStandardMaterial color="#766a62" emissive="#331610" emissiveIntensity={0.12} roughness={0.4} metalness={0.84} />
      </mesh>
      <mesh position={[0, 0, -7.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.1, 2.1, 4.8, 12]} />
        <meshStandardMaterial color="#615853" emissive="#2b1410" emissiveIntensity={0.12} roughness={0.38} metalness={0.88} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2
        return (
          <mesh key={`beacon-${angle}`} position={[Math.cos(angle) * 8.5, 0.15, Math.sin(angle) * 8.5]}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshBasicMaterial color="#ff9a61" toneMapped={false} />
          </mesh>
        )
      })}
      <mesh>
        <sphereGeometry args={[10.7, 24, 16]} />
        <meshBasicMaterial
          color={integrity > 0.35 ? '#c86432' : '#b73726'}
          transparent
          opacity={0.002 + (1 - integrity) * 0.04}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#ef8a50" intensity={115} distance={34} decay={2} />
      <pointLight position={[0, 8, 5]} color="#c8d8e8" intensity={45} distance={25} decay={2} />
    </group>
  )
}
