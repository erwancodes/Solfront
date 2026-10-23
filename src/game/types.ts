import type * as THREE from 'three'

export type Team = 'mars' | 'terra'

export type TargetKind =
  | 'player'
  | 'wingman'
  | 'fighter'
  | 'interceptor'
  | 'bomber'
  | 'station'
  | 'pylon'
  | 'core'
  | 'turret'
  | 'generator'
  | 'reactor'
  | 'missile'

/** Anything that can be shot, locked and shown on the HUD. */
export interface Target {
  id: number
  team: Team
  kind: TargetKind
  name: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  radius: number
  hp: number
  maxHp: number
  alive: boolean
  /** Can the player lock and bracket it. */
  targetable: boolean
  /** Shots and missiles are absorbed without damage while true. */
  invulnerable?: boolean
  damage(amount: number, point: THREE.Vector3, sourceTeam: Team, sourceId: number): void
}

export type Difficulty = 'recruit' | 'pilot' | 'ace'
export type Quality = 'low' | 'high'
export type Lang = 'fr' | 'en'
