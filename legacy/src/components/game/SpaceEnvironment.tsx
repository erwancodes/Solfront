import { useLayoutEffect, useMemo, useRef } from 'react'
import { Sparkles, Stars } from '@react-three/drei'
import { Color, Matrix4, Object3D, type InstancedMesh } from 'three'
import { Planet } from '@/components/game/Planet'

const asteroidCount = 92

function AsteroidField() {
  const mesh = useRef<InstancedMesh>(null)
  const asteroids = useMemo(() => Array.from({ length: asteroidCount }, (_, index) => ({
    position: [
      (Math.random() - 0.5) * 760,
      (Math.random() - 0.5) * 380,
      (Math.random() - 0.5) * 900,
    ] as [number, number, number],
    scale: 0.7 + Math.random() * 3.6,
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, index * 0.19] as [number, number, number],
  })), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    const dummy = new Object3D()
    const matrix = new Matrix4()

    asteroids.forEach((asteroid, index) => {
      dummy.position.set(...asteroid.position)
      dummy.rotation.set(...asteroid.rotation)
      dummy.scale.setScalar(asteroid.scale)
      dummy.updateMatrix()
      matrix.copy(dummy.matrix)
      mesh.current?.setMatrixAt(index, matrix)
      mesh.current?.setColorAt(index, new Color(index % 4 === 0 ? '#6f5145' : '#302a28'))
    })

    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [asteroids])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, asteroidCount]} frustumCulled>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={1} metalness={0.06} vertexColors />
    </instancedMesh>
  )
}

export function SpaceEnvironment() {
  return (
    <>
      <color attach="background" args={['#0b1118']} />
      <fogExp2 attach="fog" args={['#101720', 0.00048]} />
      <Stars radius={780} depth={520} count={6200} factor={3.8} saturation={0.15} fade speed={0.12} />
      <Sparkles count={260} scale={[760, 380, 900]} size={1.5} speed={0.07} opacity={0.42} color="#ead8c6" />
      <ambientLight intensity={0.34} color="#b8c5d4" />
      <hemisphereLight args={['#9fb4cc', '#44261f', 0.72]} />
      <directionalLight position={[-80, 120, 90]} intensity={1.85} color="#ffd4aa" />
      <directionalLight position={[90, 35, 35]} intensity={0.72} color="#9db9d0" />
      <pointLight position={[-420, 180, -650]} intensity={11200} distance={1500} decay={1.8} color="#ffd6a7" />
      <mesh position={[-420, 180, -650]}>
        <sphereGeometry args={[27, 48, 32]} />
        <meshBasicMaterial color="#ffd3a0" toneMapped={false} />
      </mesh>
      <mesh position={[-420, 180, -650]}>
        <sphereGeometry args={[34, 32, 24]} />
        <meshBasicMaterial color="#d98248" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <Planet
        name="Mars"
        position={[0, -68, -108]}
        radius={55}
        textureUrl="/textures/planets/mars.jpg"
        atmosphereColor="#b84f2e"
        rotationSpeed={0.007}
      />
      <Planet
        name="Earth"
        position={[162, 60, -350]}
        radius={19}
        textureUrl="/textures/planets/earth.jpg"
        cloudTextureUrl="/textures/planets/earth-clouds.png"
        atmosphereColor="#4f8fb5"
        rotationSpeed={0.018}
      />
      <Planet
        name="Moon"
        position={[130, 40, -320]}
        radius={5.4}
        textureUrl="/textures/planets/moon.jpg"
        atmosphereColor="#9aa2a9"
        rotationSpeed={0.004}
      />
      <AsteroidField />
    </>
  )
}
