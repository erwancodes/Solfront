import type { EnemyStats, EnemyType } from '@/types/game'

export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  fighter: {
    label: 'EARTH FIGHTER',
    hull: 42,
    speed: 24,
    damage: 3.5,
    fireRange: 58,
    fireCooldown: 1.8,
    reward: 320,
    radius: 2.4,
    accuracy: 0.72,
  },
  interceptor: {
    label: 'EARTH INTERCEPTOR',
    hull: 34,
    speed: 34,
    damage: 4.5,
    fireRange: 52,
    fireCooldown: 1.25,
    reward: 460,
    radius: 2.1,
    accuracy: 0.78,
  },
  bomber: {
    label: 'EARTH BOMBER',
    hull: 110,
    speed: 14,
    damage: 9,
    fireRange: 72,
    fireCooldown: 2.6,
    reward: 780,
    radius: 4.4,
    accuracy: 0.68,
  },
  boss: {
    label: 'TERRAN DREADNOUGHT',
    hull: 920,
    speed: 10,
    damage: 13,
    fireRange: 96,
    fireCooldown: 0.85,
    reward: 7200,
    radius: 10,
    accuracy: 0.86,
  },
}

export function getScaledEnemyStats(type: EnemyType, level: number): EnemyStats {
  const base = ENEMY_STATS[type]
  const scale = type === 'boss' ? 1 : 1 + Math.max(0, level - 1) * 0.065

  return {
    ...base,
    hull: Math.round(base.hull * scale),
    damage: base.damage * (1 + Math.max(0, level - 1) * 0.035),
    accuracy: Math.min(0.94, base.accuracy + Math.max(0, level - 1) * 0.018),
  }
}
