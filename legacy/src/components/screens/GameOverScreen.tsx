import { translateGameOverReason, useI18n } from '@/i18n'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { clearWorldRegistry } from '@/systems/worldRegistry'

export function GameOverScreen() {
  const { language, t } = useI18n()
  const reason = useGameStore((state) => state.gameOverReason)
  const score = useGameStore((state) => state.score)
  const kills = useGameStore((state) => state.kills)
  const wave = useGameStore((state) => state.currentWave)
  const restart = useGameStore((state) => state.restart)
  const mainMenu = useGameStore((state) => state.mainMenu)

  const retry = () => {
    clearWorldRegistry()
    usePlayerStore.getState().reset()
    restart()
  }

  return (
    <main className="screen screen--outcome screen--defeat">
      <section className="outcome-panel">
        <div className="outcome-panel__code">{t('out.signalLost')}</div>
        <span className="section-index">{t('out.failure')}</span>
        <h1>{t('out.fallen')}</h1>
        <p className="outcome-panel__reason">{translateGameOverReason(reason, language) ?? t('out.telemetry')}</p>
        <dl className="outcome-stats">
          <div><dt>{t('out.score')}</dt><dd>{score.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</dd></div>
          <div><dt>{t('out.wave')}</dt><dd>{Math.min(wave, 10).toString().padStart(2, '0')}</dd></div>
          <div><dt>{t('out.destroyed')}</dt><dd>{kills.toString().padStart(2, '0')}</dd></div>
        </dl>
        <div className="outcome-panel__actions">
          <button className="action-button action-button--primary" type="button" onClick={retry}><span>01</span> {t('out.again')} <i /></button>
          <button className="action-button" type="button" onClick={mainMenu}><span>02</span> {t('pause.menu')}</button>
        </div>
      </section>
    </main>
  )
}
