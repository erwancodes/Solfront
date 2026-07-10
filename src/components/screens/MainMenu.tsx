import { useState } from 'react'
import { useI18n } from '@/i18n'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore, type Language } from '@/stores/settingsStore'

type MenuPanel = 'controls' | 'options' | 'about' | null

export function MainMenu() {
  const showBriefing = useGameStore((state) => state.showBriefing)
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  const { language, t } = useI18n()
  const [panel, setPanel] = useState<MenuPanel>(null)
  const controls = [
    ['W / Z', t('controls.accelerate')], ['S', t('controls.brake')], ['A / Q + D', t('controls.strafe')],
    ['Mouse', t('controls.aim')], ['Left click', t('controls.fire')], ['Right click', t('controls.lock')],
    ['Shift', t('controls.boost')], ['Space', t('controls.evade')], ['R', t('controls.nearest')], ['Esc', t('controls.pause')],
  ]

  const chooseLanguage = (nextLanguage: Language) => setLanguage(nextLanguage)

  return (
    <main className="screen screen--menu">
      <div className="menu-rail" aria-hidden="true"><span>{t('menu.rail')}</span><i /></div>
      <section className="menu-hero">
        <div className="menu-hero__eyebrow"><span>SF // 2189</span><i />{t('menu.command')}</div>
        <h1>SOL<span>FRONT</span></h1>
        <p className="menu-hero__tagline">{t('menu.tagline')}</p>
        <p className="menu-hero__copy">{t('menu.copy')}</p>
        <div className="menu-actions">
          <button className="action-button action-button--primary" type="button" onClick={showBriefing}><span>01</span> {t('menu.start')} <i /></button>
          <button className="action-button" type="button" onClick={() => setPanel('controls')}><span>02</span> {t('menu.controls')}</button>
          <button className="action-button" type="button" onClick={() => setPanel('options')}><span>03</span> {t('menu.options')}</button>
          <button className="action-button" type="button" onClick={() => setPanel('about')}><span>04</span> {t('menu.about')}</button>
        </div>
      </section>

      <aside className="menu-dossier">
        <div className="menu-dossier__index">{t('menu.mission')}</div>
        <div className="menu-dossier__status"><i />{t('menu.threat')}</div>
        <dl>
          <div><dt>{t('menu.theatre')}</dt><dd>{t('menu.orbit')}</dd></div>
          <div><dt>{t('menu.hostiles')}</dt><dd>{t('menu.fleet')}</dd></div>
          <div><dt>{t('menu.objective')}</dt><dd>{t('menu.hold')}</dd></div>
          <div><dt>{t('menu.survival')}</dt><dd>{t('menu.waves')}</dd></div>
        </dl>
        <div className="menu-dossier__visual">
          <span className="orbit orbit--one" /><span className="orbit orbit--two" /><span className="orbit__mars" />
          <span className="orbit__station" /><span className="orbit__fleet" /><small>{t('menu.scale')}</small>
        </div>
      </aside>

      <footer className="menu-footer"><span>{t('menu.nasa')}</span><span>{t('menu.poly')}</span><span>BUILD 0.2 // WEBGL</span></footer>

      {panel ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPanel(null)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-label={panel} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-panel__header"><span>{t('modal.manual')}</span><button type="button" onClick={() => setPanel(null)}>{t('modal.close')}</button></div>
            {panel === 'controls' ? (
              <><h2>{t('controls.title')}</h2><p>{t('controls.help')}</p><div className="controls-grid">{controls.map(([key, action]) => <div key={key}><kbd>{key}</kbd><span>{action}</span></div>)}</div></>
            ) : null}
            {panel === 'options' ? (
              <><h2>{t('options.title')}</h2><p>{t('options.copy')}</p><div className="settings-row"><div><strong>{t('options.language')}</strong><small>EN / FR</small></div><div className="language-switch" role="group" aria-label={t('options.language')}>
                <button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => chooseLanguage('en')} aria-pressed={language === 'en'}>EN <span>{t('options.english')}</span></button>
                <button className={language === 'fr' ? 'is-active' : ''} type="button" onClick={() => chooseLanguage('fr')} aria-pressed={language === 'fr'}>FR <span>{t('options.french')}</span></button>
              </div></div></>
            ) : null}
            {panel === 'about' ? (
              <><h2>{t('about.title')}</h2><p>{t('about.copy')}</p><div className="about-facts"><span>{t('about.noBackend')}</span><span>{t('about.noAccount')}</span><span>{t('about.local')}</span><span>{t('about.realtime')}</span></div></>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  )
}
