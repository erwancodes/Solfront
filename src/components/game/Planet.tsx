import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { AdditiveBlending, BackSide, FrontSide, SRGBColorSpace, type Group } from 'three'
import type { VectorTuple } from '@/types/game'

interface PlanetProps {
  name: string
  position: VectorTuple
  radius: number
  textureUrl: string
  atmosphereColor?: string
  cloudTextureUrl?: string
  rotationSpeed?: number
}

function CloudLayer({ url, radius }: { url: string; radius: number }) {
  const texture = useTexture(url)
  const mesh = useRef<Group>(null)

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
  }, [texture])

  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.012
  })

  return (
    <group ref={mesh}>
      <mesh>
        <sphereGeometry args={[radius * 1.012, 48, 32]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.3}
          blending={AdditiveBlending}
          depthWrite={false}
          side={FrontSide}
        />
      </mesh>
    </group>
  )
}

export function Planet({
  name,
  position,
  radius,
  textureUrl,
  atmosphereColor = '#c96c3d',
  cloudTextureUrl,
  rotationSpeed = 0.01,
}: PlanetProps) {
  const texture = useTexture(textureUrl)
  const group = useRef<Group>(null)

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
  }, [texture])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * rotationSpeed
  })

  return (
    <group ref={group} position={position} name={name}>
      <mesh>
        <sphereGeometry args={[radius, 64, 48]} />
        <meshStandardMaterial map={texture} roughness={0.84} metalness={0.02} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.045, 48, 32]} />
        <meshBasicMaterial
          color={atmosphereColor}
          transparent
          opacity={0.2}
          side={BackSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {cloudTextureUrl ? <CloudLayer url={cloudTextureUrl} radius={radius} /> : null}
    </group>
  )
}
