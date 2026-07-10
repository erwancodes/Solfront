import type { Group, Quaternion, Vector3 } from 'three'

export type GameScreen = 'menu' | 'briefing' | 'playing' | 'paused' | 'gameover' | 'victory'

export type EnemyType = 'fighter' | 'interceptor' | 'bomber' | 'boss'

export type AIState = 'PATROL' | 'CHASE' | 'ATTACK' | 'EVADE' | 'DESTROYED'

export type VectorTuple = [number, number, number]

export interface EnemyStats {
  label: string
  hull: number
  speed: number
  damage: number
  fireRange: number
  fireCooldown: number
  reward: number
  radius: number
  accuracy: number
}

export interface EnemySpawn {
  id: string
  type: EnemyType
  position: VectorTuple
  level: number
}

export interface WaveDefinition {
  wave: number
  fighter: number
  interceptor: number
  bomber: number
  preparation: number
}

export interface RuntimeEnemy {
  id: string
  type: EnemyType
  group: Group | null
  position: Vector3
  velocity: Vector3
  quaternion: Quaternion
  health: number
  maxHealth: number
  state: AIState
  radius: number
  lastShot: number
  level: number
  destroyed: boolean
}

export interface ProjectileRequest {
  owner: 'martian' | 'earth'
  position: Vector3
  direction: Vector3
  speed: number
  damage: number
  color: string
  target: 'player' | 'station' | 'enemy'
}

export interface ExplosionRequest {
  position: Vector3
  color: string
  size: number
  kind: 'explosion' | 'impact'
}

export interface RadarContact {
  id: string
  type: EnemyType
  x: number
  z: number
  selected: boolean
}
