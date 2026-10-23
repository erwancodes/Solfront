import { useEffect, useState } from 'react'
import { translateAIState, translateEnemy, useI18n } from '@/i18n'
import { useGameStore } from '@/stores/gameStore'
import { worldRegistry } from '@/systems/worldRegistry'
import type { AIState, EnemyType } from '@/types/game'

interface TargetInfo {
  type: EnemyType
  distance: number
  health: number
  state: AIState
}

export function TargetIndicator() {
  const { language, t } = useI18n()
  const targetId = useGameStore((state) => state.lockedTargetId)
  const [info, setInfo] = useState<TargetInfo | null>(null)

  useEffect(() => {
    const update = () => {
      const target = targetId ? worldRegistry.enemies.get(targetId) : null
      if (!target) {
        setInfo(null)
        return
      }
      setInfo({
        type: target.type,
        distance: target.position.distanceTo(worldRegistry.playerPosition),
        health: Math.max(0, (target.health / target.maxHealth) * 100),
        state: target.state,
      })
    }

    update()
    const timer = window.setInterval(update, 90)
    return () => window.clearInterval(timer)
  }, [targetId])

  if (!info) return <div className="target-prompt">{t('target.acquire')}</div>

  const label = translateEnemy(info.type, language)
  return (
    <div className="target-lock" aria-label={`${t('target.locked')} ${label}`}>
      <span className="target-lock__corner target-lock__corner--tl" /><span className="target-lock__corner target-lock__corner--tr" />
      <span className="target-lock__corner target-lock__corner--bl" /><span className="target-lock__corner target-lock__corner--br" />
      <span className="target-lock__label">{t('target.locked')} // {label}</span>
      <span className="target-lock__distance">{info.distance.toFixed(1)} KM</span>
      <span className="target-lock__health"><i style={{ width: `${info.health}%` }} /></span>
      <span className="target-lock__state">{translateAIState(info.state, language)}</span>
    </div>
  )
}
