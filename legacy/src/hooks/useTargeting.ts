import { useCallback } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { findEnemyInAimCone, findNearestEnemyId } from '@/systems/targeting'

export function useTargeting() {
  const selectTarget = useGameStore((state) => state.selectTarget)

  const selectNearest = useCallback(() => {
    selectTarget(findNearestEnemyId())
  }, [selectTarget])

  const lockInAim = useCallback(() => {
    selectTarget(findEnemyInAimCone() ?? findNearestEnemyId())
  }, [selectTarget])

  return { selectNearest, lockInAim }
}
