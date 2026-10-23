import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Effects } from '@react-three/drei'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Group,
} from 'three'
import { EnemyShip } from '@/components/game/EnemyShip'
import { ExplosionPool } from '@/components/game/Explosion'
import { GameplayDirector } from '@/components/game/GameplayDirector'
import { MarsStation } from '@/components/game/MarsStation'
import { PlayerShip } from '@/components/game/PlayerShip'
import { ProjectilePool } from '@/components/game/Projectile'
import { MartianShipModel } from '@/components/game/ShipModels'
import { SpaceEnvironment } from '@/components/game/SpaceEnvironment'
import { useGameStore } from '@/stores/gameStore'

const cinematicTarget = new Vector3(0, -19, -58)
const desiredCamera = new Vector3()

function CinematicRig() {
  const { camera } = useThree()
  const ship = useRef<Group>(null)

  useFrame((state, delta) => {
    const screen = useGameStore.getState().screen
    if (screen === 'playing' || screen === 'paused') return
    const time = state.clock.elapsedTime
    desiredCamera.set(
      38 + Math.sin(time * 0.11) * 9,
      21 + Math.cos(time * 0.13) * 4,
      98 + Math.sin(time * 0.08) * 6,
    )
    camera.position.lerp(desiredCamera, 1 - Math.exp(-1.5 * Math.min(delta, 0.05)))
    camera.lookAt(cinematicTarget)

    if (ship.current) {
      ship.current.position.y = 8 + Math.sin(time * 0.55) * 1.2
      ship.current.rotation.z = Math.sin(time * 0.35) * 0.06
      ship.current.rotation.y = -0.28 + Math.sin(time * 0.18) * 0.08
    }
  })

  return (
    <group ref={ship} position={[13, 8, 44]} rotation={[0.04, -0.28, 0]}>
      <MartianShipModel preview />
    </group>
  )
}

function SubtleBloom() {
  const bloom = useMemo(() => new UnrealBloomPass(new Vector2(512, 512), 0.36, 0.32, 0.82), [])

  useEffect(() => () => bloom.dispose(), [bloom])

  return (
    <Effects multisamping={0} disableGamma>
      <primitive object={bloom} />
    </Effects>
  )
}

function GameWorld() {
  const screen = useGameStore((state) => state.screen)
  const enemySpawns = useGameStore((state) => state.enemySpawns)
  const inMission = screen === 'playing' || screen === 'paused'

  return (
    <Suspense fallback={null}>
      <SpaceEnvironment />
      <MarsStation />
      {inMission ? <PlayerShip /> : <CinematicRig />}
      {inMission ? enemySpawns.map((spawn) => <EnemyShip key={spawn.id} spawn={spawn} />) : null}
      <ProjectilePool />
      <ExplosionPool />
      <GameplayDirector />
      <SubtleBloom />
    </Suspense>
  )
}

export function GameCanvas() {
  const missionRun = useGameStore((state) => state.missionRun)

  return (
    <div className="game-canvas" aria-label="Solfront three dimensional combat zone">
      <Canvas
        dpr={[1, 1.65]}
        camera={{ fov: 60, near: 0.1, far: 1800, position: [38, 21, 98] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.42
          gl.outputColorSpace = SRGBColorSpace
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.65))
        }}
      >
        <GameWorld key={missionRun} />
      </Canvas>
    </div>
  )
}
