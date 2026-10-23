import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { WAVE_DEFINITIONS } from '@/data/waves'
import { useGameStore } from '@/stores/gameStore'

export function GameplayDirector() {
  const screen = useGameStore((state) => state.screen)
  const currentWave = useGameStore((state) => state.currentWave)
  const waveStatus = useGameStore((state) => state.waveStatus)
  const countdown = useGameStore((state) => state.countdown)
  const enemiesRemaining = useGameStore((state) => state.enemiesRemaining)
  const survivalAccumulator = useRef(0)

  useEffect(() => {
    if (screen !== 'playing') return
    const game = useGameStore.getState()

    if (waveStatus === 'idle' && currentWave === 0) {
      game.prepareWave(1, WAVE_DEFINITIONS[0].preparation)
      return
    }

    if (waveStatus === 'incoming') {
      if (countdown <= 0) {
        if (currentWave === 11) game.spawnBoss()
        else game.spawnWave(currentWave)
        return
      }

      const timer = window.setTimeout(() => {
        useGameStore.getState().setCountdown(Math.max(0, countdown - 1))
      }, 1000)
      return () => window.clearTimeout(timer)
    }

    if (waveStatus === 'active' && enemiesRemaining === 0) {
      if (currentWave < 10) {
        const nextWave = currentWave + 1
        game.prepareWave(nextWave, WAVE_DEFINITIONS[nextWave - 1].preparation)
      } else {
        game.prepareWave(11, 7)
      }
    }
  }, [countdown, currentWave, enemiesRemaining, screen, waveStatus])

  useFrame((_, delta) => {
    if (useGameStore.getState().screen !== 'playing') return
    survivalAccumulator.current += Math.min(delta, 0.05)
    if (survivalAccumulator.current >= 0.25) {
      useGameStore.getState().tickSurvival(survivalAccumulator.current)
      survivalAccumulator.current = 0
    }
  })

  return null
}
