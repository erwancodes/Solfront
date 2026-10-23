import { WAVE_DEFINITIONS } from '@/data/waves'
import type { EnemySpawn, EnemyType } from '@/types/game'

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function spawnFor(type: EnemyType, wave: number, index: number): EnemySpawn {
  const angle = index * 2.399 + wave * 0.47 + randomInRange(-0.22, 0.22)
  const radius = randomInRange(285, 430)

  return {
    id: `${type}-${wave}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    level: wave,
    position: [
      Math.cos(angle) * radius,
      randomInRange(-105, 135),
      Math.sin(angle) * radius,
    ],
  }
}

export function createWaveSpawns(wave: number): EnemySpawn[] {
  const definition = WAVE_DEFINITIONS[wave - 1]
  if (!definition) return []

  const sequence: EnemyType[] = [
    ...Array.from({ length: definition.fighter }, () => 'fighter' as const),
    ...Array.from({ length: definition.interceptor }, () => 'interceptor' as const),
    ...Array.from({ length: definition.bomber }, () => 'bomber' as const),
  ]

  return sequence.map((type, index) => spawnFor(type, wave, index))
}

export function createBossSpawn(): EnemySpawn {
  return {
    id: `boss-${Math.random().toString(36).slice(2, 8)}`,
    type: 'boss',
    level: 10,
    position: [0, 36, -470],
  }
}
