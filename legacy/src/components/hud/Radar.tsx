import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n'
import { MathUtils, Quaternion, Vector3 } from 'three'
import { useGameStore } from '@/stores/gameStore'
import { worldRegistry } from '@/systems/worldRegistry'
import type { RadarContact } from '@/types/game'

const radarRange = 520
const offset = new Vector3()
const inverse = new Quaternion()

interface RadarSnapshot {
  contacts: RadarContact[]
  station: { x: number; z: number }
  targetAngle: number | null
}

export function Radar() {
  const { t } = useI18n()
  const lockedTargetId = useGameStore((state) => state.lockedTargetId)
  const [snapshot, setSnapshot] = useState<RadarSnapshot>({ contacts: [], station: { x: 0, z: 0 }, targetAngle: null })

  useEffect(() => {
    const update = () => {
      inverse.copy(worldRegistry.playerQuaternion).invert()
      const contacts = Array.from(worldRegistry.enemies.values()).map((enemy) => {
        offset.copy(enemy.position).sub(worldRegistry.playerPosition).applyQuaternion(inverse)
        return {
          id: enemy.id,
          type: enemy.type,
          x: MathUtils.clamp((offset.x / radarRange) * 43, -43, 43),
          z: MathUtils.clamp((-offset.z / radarRange) * 43, -43, 43),
          selected: enemy.id === lockedTargetId,
        }
      })

      offset.copy(worldRegistry.stationPosition).sub(worldRegistry.playerPosition).applyQuaternion(inverse)
      const station = {
        x: MathUtils.clamp((offset.x / radarRange) * 43, -43, 43),
        z: MathUtils.clamp((-offset.z / radarRange) * 43, -43, 43),
      }

      const selected = lockedTargetId ? worldRegistry.enemies.get(lockedTargetId) : null
      let targetAngle: number | null = null
      if (selected) {
        offset.copy(selected.position).sub(worldRegistry.playerPosition).applyQuaternion(inverse)
        targetAngle = Math.atan2(offset.x, -offset.z) * (180 / Math.PI)
      }

      setSnapshot({ contacts, station, targetAngle })
    }

    update()
    const timer = window.setInterval(update, 120)
    return () => window.clearInterval(timer)
  }, [lockedTargetId])

  return (
    <div className="radar-shell" aria-label={t('radar.title')}>
      <div className="radar-shell__header">
        <span>{t('radar.title')}</span>
        <span>{radarRange} KM</span>
      </div>
      <div className="radar">
        <span className="radar__ring radar__ring--inner" />
        <span className="radar__ring radar__ring--outer" />
        <span className="radar__axis radar__axis--x" />
        <span className="radar__axis radar__axis--y" />
        {snapshot.targetAngle !== null ? (
          <span className="radar__bearing" style={{ transform: `translateX(-50%) rotate(${snapshot.targetAngle}deg)` }} />
        ) : null}
        <span
          className="radar__contact radar__contact--station"
          style={{ left: `calc(50% + ${snapshot.station.x}%)`, top: `calc(50% + ${snapshot.station.z}%)` }}
        />
        {snapshot.contacts.map((contact) => (
          <span
            key={contact.id}
            className={`radar__contact radar__contact--enemy radar__contact--${contact.type}${contact.selected ? ' is-selected' : ''}`}
            style={{ left: `calc(50% + ${contact.x}%)`, top: `calc(50% + ${contact.z}%)` }}
          />
        ))}
        <span className="radar__player" />
      </div>
    </div>
  )
}
