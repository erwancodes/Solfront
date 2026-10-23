import { create } from 'zustand'
import type { I18nKey } from './i18n'
import type { Difficulty, Lang, Quality } from './game/types'

export type Screen = 'loading' | 'menu' | 'briefing' | 'playing' | 'perk' | 'pause' | 'gameover' | 'victory' | 'warp'
export type SectorId = 'ares' | 'selene' | 'gaia'
export type PerkId = 'overclock' | 'cryo' | 'hardened' | 'aegis' | 'swarm' | 'afterburner' | 'vampire' | 'piercer' | 'wingmen' | 'reflex'
export type Params = Record<string, string | number>

export interface Line {
  key: I18nKey
  params?: Params
}

export interface Comm {
  id: number
  who: I18nKey
  text: I18nKey
}

export interface Kill {
  id: number
  line: Line
  mine: boolean
}

export interface Hud {
  hull: number
  maxHull: number
  shield: number
  maxShield: number
  heat: number
  overheated: boolean
  boost: number
  missiles: number
  maxMissiles: number
  speed: number
  score: number
  combo: number
  objective: Line[]
  /** Big bar at the top: station hull, boss hull. */
  bar: { label: string; value: number; friendly: boolean } | null
  warnings: I18nKey[]
  locked: boolean
}

export interface Stats {
  score: number
  kills: number
  shots: number
  hits: number
  time: number
  best: number
  newBest: boolean
  reason: 'player' | 'station'
}

export interface Settings {
  sensitivity: number
  invert: boolean
  volume: number
  music: number
  quality: Quality
  lang: Lang
}

export interface Progress {
  sector: SectorId
  difficulty: Difficulty
}

interface State {
  screen: Screen
  /** Screen to return to when an overlay (options, controls) closes. */
  overlay: 'options' | 'controls' | 'credits' | null
  sector: SectorId
  difficulty: Difficulty
  progress: number
  hud: Hud
  comms: Comm[]
  kills: Kill[]
  perks: PerkId[]
  offered: PerkId[]
  stats: Stats
  settings: Settings
  needsClick: boolean
  saved: Progress | null
  best: number
  set: (p: Partial<State>) => void
}

const SETTINGS_KEY = 'solfront.settings.v2'
const SAVE_KEY = 'solfront.progress.v2'
const BEST_KEY = 'solfront.best.v2'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function write(key: 'settings' | 'progress' | 'best', value: unknown) {
  const k = key === 'settings' ? SETTINGS_KEY : key === 'progress' ? SAVE_KEY : BEST_KEY
  try {
    if (value === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(value))
  } catch {
    // storage blocked: settings just won't persist
  }
}

const browserLang: Lang = typeof navigator !== 'undefined' && !navigator.language.startsWith('fr') ? 'en' : 'fr'

const defaultSettings: Settings = { sensitivity: 1, invert: false, volume: 0.8, music: 0.55, quality: 'high', lang: browserLang }

const emptyHud: Hud = {
  hull: 100,
  maxHull: 100,
  shield: 60,
  maxShield: 60,
  heat: 0,
  overheated: false,
  boost: 100,
  missiles: 6,
  maxMissiles: 6,
  speed: 0,
  score: 0,
  combo: 1,
  objective: [],
  bar: null,
  warnings: [],
  locked: false,
}

function readSave(): Progress | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as Progress) : null
  } catch {
    return null
  }
}

export const useGame = create<State>((set) => ({
  screen: 'loading',
  overlay: null,
  sector: 'ares',
  difficulty: 'pilot',
  progress: 0,
  hud: emptyHud,
  comms: [],
  kills: [],
  perks: [],
  offered: [],
  stats: { score: 0, kills: 0, shots: 0, hits: 0, time: 0, best: 0, newBest: false, reason: 'player' },
  settings: read(SETTINGS_KEY, defaultSettings),
  needsClick: false,
  saved: readSave(),
  best: read(BEST_KEY, { v: 0 }).v,
  set: (p) => set(p),
}))
