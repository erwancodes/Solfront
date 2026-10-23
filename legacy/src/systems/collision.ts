import type { Vector3 } from 'three'

export function sphereCollision(a: Vector3, aRadius: number, b: Vector3, bRadius: number) {
  const radius = aRadius + bRadius
  return a.distanceToSquared(b) <= radius * radius
}

export function keepOutsideSphere(position: Vector3, center: Vector3, radius: number) {
  const offset = position.clone().sub(center)
  const distance = offset.length()
  if (distance >= radius || distance === 0) return
  position.copy(center).add(offset.normalize().multiplyScalar(radius))
}
