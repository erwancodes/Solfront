import { create } from 'zustand'
import { createBossSpawn, createWaveSpawns } from '@/systems/waves'
import type { EnemySpawn, GameScreen } from '@/types/game'

type WaveStatus = 'idle' | 'incoming' | 'active' | 'boss'

interface GameState {
  screen: GameScreen
  missionRun: number
  currentWave: number
  waveStatus: WaveStatus
  countdown: number
  enemySpawns: EnemySpawn[]
  enemiesRemaining: number
  score: number
  kills: number
  stationHealth: number
  stationMaxHealth: number
  survivalTime: number
  lockedTargetId: string | null
  gameOverReason: string | null
  missionMessage: string
}

interface GameActions {
  showBriefing: () => void
  startMission: () => void
  pause: () => void
  resume: () => void
  restart: () => void
  mainMenu: () => void
  prepareWave: (wave: number, seconds: number) => void
  setCountdown: (seconds: number) => void
  spawnWave: (wave: number) => void
  spawnBoss: () => void
  removeEnemy: (id: string, reward: number) => void
  damageStation: (amount: number) => boolean
  selectTarget: (id: string | null) => void
  setMissionMessage: (message: string) => void
  tickSurvival: (delta: number) => void
  lose: (reason: string) => void
  win: () => void
}

const initialMissionState: Omit<GameState, 'screen' | 'missionRun'> = {
  currentWave: 0,
  waveStatus: 'idle',
  countdown: 0,
  enemySpawns: [],
  enemiesRemaining: 0,
  score: 0,
  kills: 0,
  stationHealth: 640,
  stationMaxHealth: 640,
  survivalTime: 0,
  lockedTargetId: null,
  gameOverReason: null,
  missionMessage: 'ORBITAL LINK STANDBY',
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  screen: 'menu',
  missionRun: 0,
  ...initialMissionState,
  showBriefing: () => set({ screen: 'briefing' }),
  startMission: () => set({ screen: 'playing', ...initialMissionState, missionRun: get().missionRun + 1, missionMessage: 'MARS ORBIT SECURED — PREPARE' }),
  pause: () => {
    if (get().screen === 'playing') set({ screen: 'paused' })
  },
  resume: () => {
    if (get().screen === 'paused') set({ screen: 'playing' })
  },
  restart: () => set({ screen: 'playing', ...initialMissionState, missionRun: get().missionRun + 1, missionMessage: 'MISSION RESTARTED' }),
  mainMenu: () => set({ screen: 'menu', ...initialMissionState }),
  prepareWave: (wave, seconds) => set({
    currentWave: wave,
    waveStatus: 'incoming',
    countdown: seconds,
    missionMessage: wave === 11 ? 'COMMAND SHIP SIGNATURE INBOUND' : `WAVE ${wave.toString().padStart(2, '0')} INBOUND`,
  }),
  setCountdown: (countdown) => set({ countdown }),
  spawnWave: (wave) => {
    const enemySpawns = createWaveSpawns(wave)
    set({
      currentWave: wave,
      waveStatus: 'active',
      countdown: 0,
      enemySpawns,
      enemiesRemaining: enemySpawns.length,
      missionMessage: `WAVE ${wave.toString().padStart(2, '0')} — ENGAGE`,
    })
  },
  spawnBoss: () => {
    const boss = createBossSpawn()
    set({
      waveStatus: 'boss',
      enemySpawns: [boss],
      enemiesRemaining: 1,
      lockedTargetId: boss.id,
      missionMessage: 'TERRAN DREADNOUGHT DETECTED',
    })
  },
  removeEnemy: (id, reward) => {
    const state = get()
    if (!state.enemySpawns.some((enemy) => enemy.id === id)) return
    const enemySpawns = state.enemySpawns.filter((enemy) => enemy.id !== id)
    set({
      enemySpawns,
      enemiesRemaining: enemySpawns.length,
      score: state.score + reward,
      kills: state.kills + 1,
      lockedTargetId: state.lockedTargetId === id ? null : state.lockedTargetId,
    })
  },
  damageStation: (amount) => {
    const stationHealth = Math.max(0, get().stationHealth - amount)
    set({ stationHealth, missionMessage: stationHealth <= 0 ? 'STATION SIGNAL LOST' : 'STATION UNDER FIRE' })
    return stationHealth <= 0
  },
  selectTarget: (lockedTargetId) => set({ lockedTargetId }),
  setMissionMessage: (missionMessage) => set({ missionMessage }),
  tickSurvival: (delta) => set((state) => ({ survivalTime: state.survivalTime + delta })),
  lose: (gameOverReason) => set({ screen: 'gameover', gameOverReason, waveStatus: 'idle', lockedTargetId: null }),
  win: () => set({ screen: 'victory', waveStatus: 'idle', lockedTargetId: null }),
}))
