import { useEffect, useState } from 'react'
import { translateMissionMessage, useI18n } from '@/i18n'
import { Crosshair } from '@/components/hud/Crosshair'
import { Radar } from '@/components/hud/Radar'
import { TargetIndicator } from '@/components/hud/TargetIndicator'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'

interface MeterProps {
  label: string
  value: number
  tone: 'hull' | 'shield' | 'energy' | 'heat' | 'station'
}

function Meter({ label, value, tone }: MeterProps) {
  return (
    <div className={`hud-meter hud-meter--${tone}`}>
      <div className="hud-meter__label">
        <span>{label}</span>
        <strong>{Math.round(value).toString().padStart(3, '0')}</strong>
      </div>
      <div className="hud-meter__track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  )
}

export function GameHUD() {
  const { language, t } = useI18n()
  const hull = usePlayerStore((state) => state.hull)
  const shield = usePlayerStore((state) => state.shield)
  const energy = usePlayerStore((state) => state.energy)
  const heat = usePlayerStore((state) => state.heat)
  const speed = usePlayerStore((state) => state.speed)
  const overHeated = usePlayerStore((state) => state.overHeated)
  const currentWave = useGameStore((state) => state.currentWave)
  const waveStatus = useGameStore((state) => state.waveStatus)
  const countdown = useGameStore((state) => state.countdown)
  const enemiesRemaining = useGameStore((state) => state.enemiesRemaining)
  const score = useGameStore((state) => state.score)
  const missionMessage = useGameStore((state) => state.missionMessage)
  const stationHealth = useGameStore((state) => state.stationHealth)
  const stationMaxHealth = useGameStore((state) => state.stationMaxHealth)
  const pause = useGameStore((state) => state.pause)
  const [linked, setLinked] = useState(Boolean(document.pointerLockElement))

  useEffect(() => {
    const update = () => setLinked(Boolean(document.pointerLockElement))
    document.addEventListener('pointerlockchange', update)
    return () => document.removeEventListener('pointerlockchange', update)
  }, [])

  const handlePause = () => {
    if (document.pointerLockElement) document.exitPointerLock()
    pause()
  }

  return (
    <div className="hud" aria-label="Martian combat heads-up display">
      <div className="hud__topline">
        <div className="hud__brand"><span>SF-07</span><strong>SOLFRONT</strong></div>
        <div className="hud__mission-message">{translateMissionMessage(missionMessage, language)}</div>
        <button className="hud__pause" type="button" onClick={handlePause}>{t('hud.pause')}</button>
      </div>

      <div className="hud__wave-block">
        <span>{currentWave === 11 ? t('hud.final') : t('hud.wave')}</span>
        <strong>{currentWave === 11 ? t('hud.boss') : currentWave.toString().padStart(2, '0')}</strong>
        <small>{enemiesRemaining.toString().padStart(2, '0')} {t('hud.hostiles')}</small>
      </div>

      <div className="hud__score-block">
        <span>{t('hud.score')}</span>
        <strong>{score.toLocaleString('en-US').padStart(7, '0')}</strong>
      </div>

      <div className="hud__left-stack">
        <div className="hud-panel-title">{t('hud.fighter')}</div>
        <Meter label={t('hud.hull')} value={hull} tone="hull" />
        <Meter label={t('hud.shield')} value={shield} tone="shield" />
        <Meter label={t('hud.energy')} value={energy} tone="energy" />
        <Meter label={overHeated ? t('hud.overheat') : t('hud.heat')} value={heat} tone="heat" />
      </div>

      <div className="hud__station-panel">
        <div className="hud-panel-title">{t('hud.station')}</div>
        <Meter label={t('hud.structure')} value={(stationHealth / stationMaxHealth) * 100} tone="station" />
        <div className="hud__station-meta"><span>{t('hud.defend')}</span><strong>{Math.ceil(stationHealth)} HP</strong></div>
      </div>

      <div className="hud__speed">
        <span>{t('hud.velocity')}</span>
        <strong>{Math.round(speed).toString().padStart(3, '0')}</strong>
        <small>KM/S</small>
      </div>

      <div className="hud__controls-strip">
        <span>{t('hud.thrust')}</span><span>{t('hud.strafe')}</span><span>{t('hud.boost')}</span><span>{t('hud.evade')}</span><span>{t('hud.fire')}</span><span>{t('hud.lock')}</span>
      </div>

      {!linked ? <button className="hud__link-hint" type="button">{t('hud.link')}</button> : null}
      {waveStatus === 'incoming' && countdown > 0 ? (
        <div className="hud__countdown"><span>{t('hud.prepare')}</span><strong>{countdown}</strong></div>
      ) : null}

      <Crosshair />
      <TargetIndicator />
      <Radar />
      <div className={`hud__damage-vignette${hull < 35 ? ' is-critical' : ''}`} />
    </div>
  )
}
