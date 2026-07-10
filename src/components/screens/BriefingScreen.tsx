import { useI18n } from '@/i18n'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { clearWorldRegistry } from '@/systems/worldRegistry'

export function BriefingScreen() {
  const { t } = useI18n()
  const startMission = useGameStore((state) => state.startMission)
  const mainMenu = useGameStore((state) => state.mainMenu)

  const launch = () => {
    clearWorldRegistry()
    usePlayerStore.getState().reset()
    startMission()
  }

  return (
    <main className="screen screen--briefing">
      <section className="briefing-card">
        <div className="briefing-card__header"><span>{t('brief.classified')}</span><strong>2189.187</strong></div>
        <div className="briefing-card__grid">
          <div className="briefing-card__copy">
            <span className="section-index">{t('brief.index')}</span>
            <h1>{t('brief.title')}</h1>
            <div className="briefing-text">
              <p>{t('brief.year')}</p><p>{t('brief.independence')}</p><p>{t('brief.fleet')}</p><p>{t('brief.mission')}</p>
            </div>
          </div>
          <div className="briefing-card__objectives">
            <span className="section-index">{t('brief.directives')}</span>
            <ol>
              <li><span>01</span><p>{t('brief.protect')}</p></li><li><span>02</span><p>{t('brief.survive')}</p></li><li><span>03</span><p>{t('brief.destroy')}</p></li>
            </ol>
            <div className="briefing-warning"><i />{t('brief.loss')}</div>
          </div>
        </div>
        <div className="briefing-card__actions">
          <button className="text-button" type="button" onClick={mainMenu}>{t('brief.return')}</button>
          <button className="action-button action-button--primary" type="button" onClick={launch}><span>{t('brief.ready')}</span> {t('brief.deploy')} <i /></button>
        </div>
      </section>
    </main>
  )
}
