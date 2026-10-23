import { useGameStore } from '@/stores/gameStore'
import { useI18n } from '@/i18n'

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`
}

export function VictoryScreen() {
  const { language, t } = useI18n()
  const score = useGameStore((state) => state.score)
  const kills = useGameStore((state) => state.kills)
  const survivalTime = useGameStore((state) => state.survivalTime)
  const mainMenu = useGameStore((state) => state.mainMenu)

  return (
    <main className="screen screen--outcome screen--victory">
      <section className="outcome-panel">
        <div className="victory-signal"><i /><span>{t('victory.signal')}</span><i /></div>
        <span className="section-index">{t('victory.eliminated')}</span>
        <h1>{t('victory.title')}</h1>
        <p className="outcome-panel__reason">{t('victory.copy')}</p>
        <dl className="outcome-stats">
          <div><dt>{t('out.score')}</dt><dd>{score.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</dd></div>
          <div><dt>{t('victory.ships')}</dt><dd>{kills.toString().padStart(2, '0')}</dd></div>
          <div><dt>{t('victory.time')}</dt><dd>{formatTime(survivalTime)}</dd></div>
        </dl>
        <div className="outcome-panel__actions">
          <button className="action-button action-button--primary" type="button" onClick={mainMenu}><span>{t('victory.done')}</span> {t('victory.return')} <i /></button>
        </div>
      </section>
    </main>
  )
}
