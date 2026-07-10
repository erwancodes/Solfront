import { create } from 'zustand'

interface PlayerTelemetry {
  hull: number
  shield: number
  energy: number
  heat: number
  speed: number
  maxSpeed: number
  overHeated: boolean
  damagePulse: number
}

interface PlayerActions {
  setTelemetry: (telemetry: Partial<Pick<PlayerTelemetry, 'speed' | 'energy' | 'heat' | 'overHeated'>>) => void
  applyDamage: (amount: number) => boolean
  recover: (delta: number, boosting: boolean, firing: boolean) => void
  reset: () => void
}

const initialState: PlayerTelemetry = {
  hull: 100,
  shield: 100,
  energy: 100,
  heat: 0,
  speed: 0,
  maxSpeed: 76,
  overHeated: false,
  damagePulse: 0,
}

export const usePlayerStore = create<PlayerTelemetry & PlayerActions>((set, get) => ({
  ...initialState,
  setTelemetry: (telemetry) => set(telemetry),
  applyDamage: (amount) => {
    const state = get()
    const shieldDamage = Math.min(state.shield, amount)
    const hullDamage = amount - shieldDamage
    const hull = Math.max(0, state.hull - hullDamage)

    set({
      shield: Math.max(0, state.shield - shieldDamage),
      hull,
      damagePulse: state.damagePulse + 1,
    })

    return hull <= 0
  },
  recover: (delta, boosting, firing) => {
    const state = get()
    const energy = Math.min(100, state.energy + (boosting ? -23 : 8.5) * delta)
    const heat = Math.max(0, state.heat - (firing ? 8 : 24) * delta)
    const shield = Math.min(100, state.shield + (state.shield < 100 ? 2.1 : 0) * delta)
    const overHeated = state.overHeated ? heat > 45 : heat >= 100

    set({ energy: Math.max(0, energy), heat, shield, overHeated })
  },
  reset: () => set(initialState),
}))
