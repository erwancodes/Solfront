import { useI18n } from '@/i18n'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { clearWorldRegistry } from '@/systems/worldRegistry'

export function PauseScreen() {
  const { t } = useI18n()
  const resume = useGameStore((state) => state.resume)
  const restart = useGameStore((state) => state.restart)
  const mainMenu = useGameStore((state) => state.mainMenu)

  const restartMission = () => {
    clearWorldRegistry()
    usePlayerStore.getState().reset()
    restart()
  }

  return (
    <main className="screen screen--pause">
      <section className="pause-panel">
        <span className="section-index">{t('pause.link')}</span>
        <h1>{t('pause.title')}</h1>
        <p>{t('pause.copy')}</p>
        <div className="pause-panel__actions">
          <button className="action-button action-button--primary" type="button" onClick={resume}><span>01</span> {t('pause.resume')} <i /></button>
          <button className="action-button" type="button" onClick={restartMission}><span>02</span> {t('pause.restart')}</button>
          <button className="action-button" type="button" onClick={mainMenu}><span>03</span> {t('pause.menu')}</button>
        </div>
      </section>
    </main>
  )
}
