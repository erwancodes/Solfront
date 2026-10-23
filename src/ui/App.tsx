import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Game, gameRef } from '../game/Game'
import type { Difficulty } from '../game/types'
import { t, type I18nKey } from '../i18n'
import { useGame, write, type Line, type PerkId, type SectorId, type Settings } from '../store'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const isKey = (v: unknown): v is I18nKey => typeof v === 'string' && t(v as I18nKey) !== v

/** Translate a line, translating param values that are keys themselves. */
function tl(line: Line) {
  const params: Record<string, string | number> = {}
  for (const k in line.params ?? {}) {
    const v = line.params![k]
    params[k] = isKey(v) ? t(v) : v
  }
  return t(line.key, params)
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const fmtNum = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')
const game = () => gameRef.get()
const click = (fn: () => void) => () => {
  game()?.click()
  fn()
}

const SECTOR_N: Record<SectorId, number> = { ares: 1, selene: 2, gaia: 3 }

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export function App() {
  const stage = useRef<HTMLDivElement>(null)
  const hud = useRef<HTMLCanvasElement>(null)
  const screen = useGame((s) => s.screen)
  const overlay = useGame((s) => s.overlay)
  // re-render the whole tree when the language changes
  useGame((s) => s.settings.lang)

  useEffect(() => {
    if (!stage.current || !hud.current) return
    const g = new Game(stage.current, hud.current)
    gameRef.set(g)
    // handle for poking at the running game from the dev console
    if (import.meta.env.DEV) Object.assign(window, { solfront: g })
    void g.boot()
    return () => {
      g.dispose()
      gameRef.set(null)
    }
  }, [])

  return (
    <div className={`app is-${screen}`}>
      <div className="stage" ref={stage} />
      <canvas className="hud-canvas" ref={hud} />
      {screen === 'loading' && <Loading />}
      {screen === 'menu' && !overlay && <Menu />}
      {screen === 'briefing' && <Briefing />}
      {(screen === 'playing' || screen === 'perk' || screen === 'pause') && <Hud />}
      {screen === 'perk' && <Perks />}
      {screen === 'pause' && !overlay && <Pause />}
      {screen === 'warp' && <Warp />}
      {screen === 'gameover' && <GameOver />}
      {screen === 'victory' && <Victory />}
      {overlay === 'options' && <Options />}
      {overlay === 'controls' && <Controls />}
      {overlay === 'credits' && <Credits />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Loading and menu                                                    */
/* ------------------------------------------------------------------ */

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`wordmark ${className}`} aria-hidden="true">
      {'SOLFRONT'.split('').map((c, i) => (
        <span key={i} style={{ animationDelay: `${i * 55}ms` }}>
          {c}
        </span>
      ))}
    </div>
  )
}

function Loading() {
  return (
    <section className="screen loading">
      <p className="loading-line">{t('loading')}</p>
      <div className="loading-bar">
        <span />
      </div>
      <Wordmark />
    </section>
  )
}

function Menu() {
  const saved = useGame((s) => s.saved)
  const best = useGame((s) => s.best)
  const set = useGame((s) => s.set)
  const [diff, setDiff] = useState<Difficulty>(saved?.difficulty ?? 'pilot')
  const diffs: Difficulty[] = ['recruit', 'pilot', 'ace']

  return (
    <section className="screen menu">
      <h1 className="sr-only">Solfront</h1>
      <p className="menu-lead">{t('menu.lead')}</p>
      <nav className="menu-nav">
        <button className="link" onClick={click(() => set({ overlay: 'controls' }))}>
          {t('menu.controls')}
        </button>
        <button className="link" onClick={click(() => set({ overlay: 'options' }))}>
          {t('menu.options')}
        </button>
        <button className="link" onClick={click(() => set({ overlay: 'credits' }))}>
          {t('menu.credits')}
        </button>
      </nav>

      <div className="menu-launch">
        <div className="diff" role="radiogroup" aria-label="Difficulté">
          {diffs.map((d) => (
            <button key={d} role="radio" aria-checked={diff === d} className={`diff-opt ${diff === d ? 'on' : ''}`} onClick={click(() => setDiff(d))}>
              <span className="diff-name">{t(`diff.${d}`)}</span>
              <span className="diff-desc">{t(`diff.${d}.d`)}</span>
            </button>
          ))}
        </div>
        <div className="launch-row">
          <button className="btn-primary" onClick={() => game()?.startCampaign(diff)}>
            {t('menu.start')}
          </button>
          {saved && saved.sector !== 'ares' && (
            <button className="btn-ghost" onClick={() => game()?.startCampaign(saved.difficulty, saved.sector)}>
              {t('menu.continue')} <b>{t(`sector.${saved.sector}`)}</b>
            </button>
          )}
          {best > 0 && (
            <p className="best">
              {t('menu.best')} <b className="num">{fmtNum(best)}</b>
            </p>
          )}
        </div>
      </div>
      <Wordmark className="menu-mark" />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Briefing                                                            */
/* ------------------------------------------------------------------ */

function Briefing() {
  const sector = useGame((s) => s.sector)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 400)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') game()?.continueFromBriefing()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  return (
    <section className="screen briefing">
      <div className="brief-panel">
        <p className="brief-count">
          <span className="num">{SECTOR_N[sector]}</span> / 3
        </p>
        <h2 className="brief-title">{t(`sector.${sector}`)}</h2>
        <p className="brief-sub">{t(`sector.${sector}.sub`)}</p>
        <p className="brief-text">{t(`brief.${sector}`)}</p>
        <h3 className="brief-h">{t('brief.objectives')}</h3>
        <ul className="brief-obj">
          <li>{t(`obj.${sector}.1`)}</li>
          <li>{t(`obj.${sector}.2`)}</li>
        </ul>
        <button className="btn-primary" disabled={!ready} onClick={() => game()?.continueFromBriefing()}>
          {t('brief.go')}
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

function Meter({ label, value, max, tone = 'ink', alert = false, children }: { label: string; value: number; max: number; tone?: 'ink' | 'accent' | 'blue' | 'rust'; alert?: boolean; children?: ReactNode }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className={`meter tone-${tone} ${alert ? 'alert' : ''}`}>
      <div className="meter-head">
        <span>{label}</span>
        <b className="num">{children ?? Math.ceil(value)}</b>
      </div>
      <div className="meter-track">
        <span style={{ transform: `scaleX(${pct})` }} />
      </div>
    </div>
  )
}

function Hud() {
  const h = useGame((s) => s.hud)
  const comms = useGame((s) => s.comms)
  const kills = useGame((s) => s.kills)
  const needsClick = useGame((s) => s.needsClick)
  const screen = useGame((s) => s.screen)
  const sector = useGame((s) => s.sector)

  return (
    <div className={`hud ${screen !== 'playing' ? 'dim' : ''}`}>
      <div className="hud-tl">
        <p className="hud-sector">{t(`sector.${sector}`)}</p>
        {h.objective.map((l, i) => (
          <p key={i} className={i === 0 ? 'hud-obj' : 'hud-obj2'}>
            {tl(l)}
          </p>
        ))}
      </div>

      {h.bar && (
        <div className={`hud-bar ${h.bar.friendly ? 'friendly' : 'enemy'}`}>
          <p>{isKey(h.bar.label) ? t(h.bar.label) : h.bar.label}</p>
          <div className="hud-bar-track">
            <span style={{ transform: `scaleX(${h.bar.value})` }} />
          </div>
        </div>
      )}

      <div className="hud-tr">
        <p className="hud-score num">{fmtNum(h.score)}</p>
        {h.combo > 1 && <p className="hud-combo">{t('hud.combo', { n: h.combo })}</p>}
        <ul className="feed">
          {kills.map((k) => (
            <li key={k.id} className={k.mine ? 'mine' : ''}>
              {tl(k.line)}
            </li>
          ))}
        </ul>
      </div>

      <ul className="comms">
        {comms.map((c) => (
          <li key={c.id}>
            <b>{t(c.who)}</b>
            <span>{t(c.text)}</span>
          </li>
        ))}
      </ul>

      {h.warnings.length > 0 && (
        <div className="warnings" role="status">
          {h.warnings.map((w) => (
            <p key={w}>{t(w)}</p>
          ))}
        </div>
      )}

      <div className="hud-bl">
        <Meter label={t('hud.shield')} value={h.shield} max={h.maxShield} tone="blue" />
        <Meter label={t('hud.hull')} value={h.hull} max={h.maxHull} tone={h.hull < h.maxHull * 0.3 ? 'rust' : 'ink'} alert={h.hull < h.maxHull * 0.3} />
      </div>

      <div className="hud-br">
        <p className="hud-speed">
          <b className="num">{Math.round(h.speed)}</b> {t('hud.speed')}
        </p>
        <Meter label={t('hud.heat')} value={h.heat} max={100} tone={h.overheated ? 'rust' : 'ink'} alert={h.overheated} />
        <Meter label={t('hud.boost')} value={h.boost} max={100} tone="accent" />
        <div className="pips" aria-label={`${t('hud.missiles')} ${h.missiles}`}>
          <span>{t('hud.missiles')}</span>
          <div>
            {Array.from({ length: h.maxMissiles }, (_, i) => (
              <i key={i} className={i < h.missiles ? 'full' : ''} />
            ))}
          </div>
          {h.locked && <b className="locked">{t('hud.locked')}</b>}
        </div>
      </div>

      {needsClick && screen === 'playing' && (
        <button className="needs-click" onClick={() => game()?.requestLock()}>
          {t('hud.click')}
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Perks, pause, warp                                                  */
/* ------------------------------------------------------------------ */

function Perks() {
  const offered = useGame((s) => s.offered)
  const owned = useGame((s) => s.perks)
  const mid = game()?.perkMode === 'resume'
  return (
    <section className="screen perks">
      <div className="perks-head">
        <h2>{t('perk.title')}</h2>
        <p>{t(mid ? 'perk.mid' : 'perk.lead')}</p>
      </div>
      <div className="perk-row">
        {offered.map((p: PerkId, i) => (
          <button key={p} className="perk" style={{ animationDelay: `${i * 80}ms` }} onClick={() => game()?.choosePerk(p)}>
            <span className="perk-name">{t(`perk.${p}`)}</span>
            <span className="perk-desc">{t(`perk.${p}.d`)}</span>
          </button>
        ))}
      </div>
      {owned.length > 0 && (
        <p className="perks-owned">
          {owned.map((p) => t(`perk.${p}`)).join(', ')}
        </p>
      )}
    </section>
  )
}

function Pause() {
  const set = useGame((s) => s.set)
  return (
    <section className="screen pause">
      <h2 className="pause-title">{t('pause.title')}</h2>
      <div className="pause-actions">
        <button className="btn-primary" onClick={() => game()?.resume()}>
          {t('pause.resume')}
        </button>
        <button className="btn-ghost" onClick={click(() => game()?.restartSector())}>
          {t('pause.restart')}
        </button>
        <button className="btn-ghost" onClick={click(() => set({ overlay: 'options' }))}>
          {t('menu.options')}
        </button>
        <button className="btn-ghost" onClick={click(() => set({ overlay: 'controls' }))}>
          {t('menu.controls')}
        </button>
        <button className="btn-ghost" onClick={click(() => game()?.quitToMenu())}>
          {t('pause.quit')}
        </button>
      </div>
    </section>
  )
}

function Warp() {
  const sector = useGame((s) => s.sector)
  return (
    <section className="screen warp">
      <p className="warp-line">{t('warp', { sector: t(`sector.${sector}`) })}</p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* End screens                                                         */
/* ------------------------------------------------------------------ */

function StatsGrid() {
  const s = useGame((x) => x.stats)
  const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0
  return (
    <dl className="stats">
      <div>
        <dt>{t('stats.score')}</dt>
        <dd className="num">{fmtNum(s.score)}</dd>
      </div>
      <div>
        <dt>{t('stats.kills')}</dt>
        <dd className="num">{s.kills}</dd>
      </div>
      <div>
        <dt>{t('stats.accuracy')}</dt>
        <dd className="num">{acc}%</dd>
      </div>
      <div>
        <dt>{t('stats.time')}</dt>
        <dd className="num">{fmtTime(s.time)}</dd>
      </div>
      <div>
        <dt>{s.newBest ? t('stats.newBest') : t('stats.best')}</dt>
        <dd className="num">{fmtNum(s.best)}</dd>
      </div>
    </dl>
  )
}

function GameOver() {
  const reason = useGame((s) => s.stats.reason)
  const sector = useGame((s) => s.sector)
  return (
    <section className="screen field rust">
      <h2 className="field-title">{t(reason === 'station' ? 'over.station' : 'over.player')}</h2>
      <p className="field-lead">{t(reason === 'station' ? 'over.lead.station' : 'over.lead.player', { sector: t(`sector.${sector}`) })}</p>
      <StatsGrid />
      <div className="field-actions">
        <button className="btn-ink" onClick={click(() => game()?.restartSector())}>
          {t('over.retry')}
        </button>
        <button className="btn-line" onClick={click(() => game()?.quitToMenu())}>
          {t('over.menu')}
        </button>
      </div>
    </section>
  )
}

function Victory() {
  const difficulty = useGame((s) => s.difficulty)
  return (
    <section className="screen field yellow">
      <h2 className="field-title">{t('win.title')}</h2>
      <p className="field-lead">{t('win.lead')}</p>
      <StatsGrid />
      <div className="field-actions">
        <button className="btn-ink" onClick={click(() => game()?.startCampaign(difficulty))}>
          {t('win.again')}
        </button>
        <button className="btn-line" onClick={click(() => game()?.quitToMenu())}>
          {t('over.menu')}
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const set = useGame((s) => s.set)
  const close = () => {
    game()?.click()
    set({ overlay: null })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') set({ overlay: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [set])
  return (
    <section className="screen sheet" role="dialog" aria-label={title}>
      <div className="sheet-inner">
        <h2 className="sheet-title">{title}</h2>
        {children}
        <button className="btn-primary sheet-back" onClick={close}>
          {t('back')}
        </button>
      </div>
    </section>
  )
}

function Options() {
  const s = useGame((x) => x.settings)
  const set = useGame((x) => x.set)
  const update = (p: Partial<Settings>) => {
    const next = { ...s, ...p }
    set({ settings: next })
    write('settings', next)
    game()?.applySettings(next)
  }
  const Toggle = ({ on, a, b, onPick }: { on: boolean; a: string; b: string; onPick: (v: boolean) => void }) => (
    <div className="toggle">
      <button className={on ? 'on' : ''} aria-pressed={on} onClick={() => onPick(true)}>
        {a}
      </button>
      <button className={!on ? 'on' : ''} aria-pressed={!on} onClick={() => onPick(false)}>
        {b}
      </button>
    </div>
  )
  const Range = ({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) => (
    <label className="opt">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b className="num">{Math.round(value * 100)}</b>
    </label>
  )
  return (
    <Sheet title={t('opt.title')}>
      <div className="opts">
        <Range label={t('opt.sensitivity')} value={s.sensitivity} min={0.3} max={2.5} step={0.05} onChange={(v) => update({ sensitivity: v })} />
        <Range label={t('opt.volume')} value={s.volume} min={0} max={1} step={0.05} onChange={(v) => update({ volume: v })} />
        <Range label={t('opt.music')} value={s.music} min={0} max={1} step={0.05} onChange={(v) => update({ music: v })} />
        <div className="opt">
          <span>{t('opt.invert')}</span>
          <Toggle on={s.invert} a={t('opt.on')} b={t('opt.off')} onPick={(v) => update({ invert: v })} />
        </div>
        <div className="opt">
          <span>{t('opt.quality')}</span>
          <Toggle on={s.quality === 'high'} a={t('opt.quality.high')} b={t('opt.quality.low')} onPick={(v) => update({ quality: v ? 'high' : 'low' })} />
        </div>
        <div className="opt">
          <span>{t('opt.lang')}</span>
          <Toggle on={s.lang === 'fr'} a="Français" b="English" onPick={(v) => update({ lang: v ? 'fr' : 'en' })} />
        </div>
      </div>
    </Sheet>
  )
}

function Controls() {
  const rows: [I18nKey, string][] = [
    ['ctl.aim', t('ctl.aim.k')],
    ['ctl.fire', t('ctl.fire.k')],
    ['ctl.missile', t('ctl.missile.k', { f: 'F' })],
    ['ctl.throttle', 'W  S'],
    ['ctl.roll', 'A  D'],
    ['ctl.boost', t('ctl.boost.k')],
    ['ctl.dodge', t('ctl.dodge.k')],
    ['ctl.target', 'R'],
    ['ctl.pause', t('ctl.pause.k')],
  ]
  return (
    <Sheet title={t('ctl.title')}>
      <dl className="keys">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{t(k)}</dt>
            <dd>
              <kbd>{v}</kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="sheet-note">{t('ctl.pad')}</p>
    </Sheet>
  )
}

function Credits() {
  return (
    <Sheet title={t('cr.title')}>
      <p className="sheet-lead">{t('cr.lead')}</p>
      <ul className="credits">
        <li>{t('cr.textures')}</li>
        <li>{t('cr.sky')}</li>
        <li>{t('cr.fonts')}</li>
      </ul>
    </Sheet>
  )
}
