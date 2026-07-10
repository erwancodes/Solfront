import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  Euler,
  MathUtils,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Group,
  type Mesh,
} from 'three'
import { MartianShipModel } from '@/components/game/ShipModels'
import { usePlayerControls } from '@/hooks/usePlayerControls'
import { useTargeting } from '@/hooks/useTargeting'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { keepOutsideSphere } from '@/systems/collision'
import {
  PLAYER_FIRE_INTERVAL,
  PLAYER_LASER_DAMAGE,
  PLAYER_PROJECTILE_SPEED,
  weaponHeatAfterShot,
} from '@/systems/combat'
import { cameraImpact, queueProjectile, worldRegistry } from '@/systems/worldRegistry'

const forward = new Vector3()
const right = new Vector3()
const up = new Vector3()
const cameraOffset = new Vector3()
const cameraTarget = new Vector3()
const desiredCameraPosition = new Vector3()
const desiredQuaternion = new Quaternion()
const orientation = new Euler(0, 0, 0, 'YXZ')
const marsCenter = new Vector3(0, -68, -108)

export function PlayerShip() {
  const group = useRef<Group>(null)
  const shieldMesh = useRef<Mesh>(null)
  const engineTrail = useRef<Group>(null)
  const position = useRef(new Vector3(0, 4, 76))
  const speed = useRef(0)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const roll = useRef(0)
  const lastShot = useRef(-10)
  const lastDodge = useRef(-10)
  const cannonSide = useRef(1)
  const lastTelemetry = useRef(0)
  const lastDamagePulse = useRef(0)
  const shieldPulse = useRef(0)
  const screen = useGameStore((state) => state.screen)
  const controls = usePlayerControls(screen === 'playing')
  const { selectNearest, lockInAim } = useTargeting()
  const { camera } = useThree()

  useEffect(() => {
    position.current.set(0, 4, 76)
    camera.position.set(0, 10, 96)
    worldRegistry.playerPosition.copy(position.current)
    return () => {
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [camera])

  useFrame((state, rawDelta) => {
    if (!group.current || screen !== 'playing') return
    const delta = Math.min(rawDelta, 0.05)
    const elapsed = state.clock.elapsedTime
    const input = controls.current
    const playerState = usePlayerStore.getState()

    const mouseX = MathUtils.clamp(input.mouseX, -90, 90)
    const mouseY = MathUtils.clamp(input.mouseY, -90, 90)
    input.mouseX = 0
    input.mouseY = 0

    yaw.current -= mouseX * 0.00185
    pitch.current = MathUtils.clamp(pitch.current - mouseY * 0.00155, -0.78, 0.78)

    const lateralInput = (input.keys.has('KeyD') ? 1 : 0)
      - (input.keys.has('KeyA') || input.keys.has('KeyQ') ? 1 : 0)
    const targetRoll = -lateralInput * 0.46 + MathUtils.clamp(-mouseX * 0.006, -0.35, 0.35)
    roll.current = MathUtils.lerp(roll.current, targetRoll, 1 - Math.exp(-5.5 * delta))

    orientation.set(pitch.current, yaw.current, roll.current)
    desiredQuaternion.setFromEuler(orientation)
    group.current.quaternion.slerp(desiredQuaternion, 1 - Math.exp(-9 * delta))

    forward.set(0, 0, -1).applyQuaternion(group.current.quaternion).normalize()
    right.set(1, 0, 0).applyQuaternion(group.current.quaternion).normalize()
    up.set(0, 1, 0).applyQuaternion(group.current.quaternion).normalize()

    const accelerating = input.keys.has('KeyW') || input.keys.has('KeyZ')
    const reversing = input.keys.has('KeyS')
    const boosting = accelerating
      && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'))
      && playerState.energy > 1
    const targetSpeed = accelerating
      ? boosting ? 112 : playerState.maxSpeed
      : reversing ? -22 : speed.current * 0.985

    speed.current = MathUtils.lerp(speed.current, targetSpeed, 1 - Math.exp(-3.1 * delta))
    position.current.addScaledVector(forward, speed.current * delta)
    position.current.addScaledVector(right, lateralInput * 31 * delta)

    if (input.dodgeRequested && elapsed - lastDodge.current > 1.4 && playerState.energy >= 16) {
      const dodgeDirection = lateralInput === 0 ? 1 : Math.sign(lateralInput)
      position.current.addScaledVector(right, dodgeDirection * 16)
      usePlayerStore.getState().setTelemetry({ energy: Math.max(0, playerState.energy - 16) })
      cameraImpact.amount = Math.max(cameraImpact.amount, 0.16)
      lastDodge.current = elapsed
      input.dodgeRequested = false
    }

    position.current.x = MathUtils.clamp(position.current.x, -360, 360)
    position.current.y = MathUtils.clamp(position.current.y, -180, 220)
    position.current.z = MathUtils.clamp(position.current.z, -420, 420)
    keepOutsideSphere(position.current, marsCenter, 63)
    keepOutsideSphere(position.current, worldRegistry.stationPosition, 11.5)

    group.current.position.copy(position.current)
    worldRegistry.playerPosition.copy(position.current)
    worldRegistry.playerQuaternion.copy(group.current.quaternion)
    worldRegistry.playerVelocity.copy(forward).multiplyScalar(speed.current)

    if (input.targetRequested) {
      selectNearest()
      input.targetRequested = false
    }
    if (input.lockRequested) {
      lockInAim()
      input.lockRequested = false
    }

    const livePlayerState = usePlayerStore.getState()
    if (input.firing && !livePlayerState.overHeated && elapsed - lastShot.current >= PLAYER_FIRE_INTERVAL) {
      const aimDirection = forward.clone()
      const selectedId = useGameStore.getState().lockedTargetId
      const selected = selectedId ? worldRegistry.enemies.get(selectedId) : null
      if (selected && !selected.destroyed) {
        const targetDirection = selected.position.clone().sub(position.current).normalize()
        if (aimDirection.angleTo(targetDirection) < 0.42) aimDirection.lerp(targetDirection, 0.32).normalize()
      }

      const side = cannonSide.current
      const muzzle = position.current.clone()
        .addScaledVector(forward, 4.1)
        .addScaledVector(right, side * 1.42)
        .addScaledVector(up, -0.08)

      queueProjectile({
        owner: 'martian',
        position: muzzle,
        direction: aimDirection,
        speed: PLAYER_PROJECTILE_SPEED,
        damage: PLAYER_LASER_DAMAGE,
        color: '#f07836',
        target: 'enemy',
      })

      const nextHeat = weaponHeatAfterShot(livePlayerState.heat)
      usePlayerStore.getState().setTelemetry({ heat: nextHeat, overHeated: nextHeat >= 100 })
      cannonSide.current *= -1
      lastShot.current = elapsed
    }

    usePlayerStore.getState().recover(delta, boosting, input.firing)

    if (elapsed - lastTelemetry.current > 0.08) {
      usePlayerStore.getState().setTelemetry({ speed: Math.abs(speed.current) })
      lastTelemetry.current = elapsed
    }

    if (livePlayerState.damagePulse !== lastDamagePulse.current) {
      lastDamagePulse.current = livePlayerState.damagePulse
      shieldPulse.current = 1
    }
    shieldPulse.current = Math.max(0, shieldPulse.current - delta * 2.7)
    if (shieldMesh.current) {
      const material = shieldMesh.current.material as MeshBasicMaterial
      material.opacity = shieldPulse.current * 0.11
      shieldMesh.current.scale.setScalar(1 + shieldPulse.current * 0.045)
    }

    if (engineTrail.current) {
      const thrust = MathUtils.clamp(Math.abs(speed.current) / 60, 0.25, 1.8)
      engineTrail.current.scale.z = MathUtils.lerp(engineTrail.current.scale.z, thrust, 0.16)
    }

    cameraOffset.set(0, 5.4, 17.2).applyQuaternion(group.current.quaternion)
    desiredCameraPosition.copy(position.current).add(cameraOffset)
    camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-5.4 * delta))

    if (cameraImpact.amount > 0.002) {
      camera.position.x += (Math.random() - 0.5) * cameraImpact.amount
      camera.position.y += (Math.random() - 0.5) * cameraImpact.amount
      cameraImpact.amount *= Math.exp(-7.5 * delta)
    }

    cameraTarget.copy(position.current).addScaledVector(forward, 15).addScaledVector(up, 0.7)
    camera.lookAt(cameraTarget)
  })

  return (
    <group ref={group} position={[0, 4, 76]}>
      <MartianShipModel />
      <pointLight position={[0, 4.5, 5.5]} color="#ffd0aa" intensity={72} distance={24} decay={2} />
      <pointLight position={[0, -2, -2]} color="#b5cbe0" intensity={38} distance={17} decay={2} />
      <group ref={engineTrail}>
        {[-1.05, 1.05].map((x) => (
          <mesh key={x} position={[x, -0.12, 3.1]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.24, 3.8, 10]} />
            <meshBasicMaterial
              color="#e86e32"
              transparent
              opacity={0.38}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <mesh ref={shieldMesh}>
        <sphereGeometry args={[3.1, 28, 18]} />
        <meshBasicMaterial color="#e58a55" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}
