export const PLAYER_LASER_DAMAGE = 22
export const PLAYER_FIRE_INTERVAL = 0.145
export const PLAYER_PROJECTILE_SPEED = 150
export const EARTH_PROJECTILE_SPEED = 76

export function weaponHeatAfterShot(current: number) {
  return Math.min(106, current + 8.5)
}
