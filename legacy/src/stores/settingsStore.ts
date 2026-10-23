import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'fr'

interface SettingsState {
  language: Language
  setLanguage: (language: Language) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'solfront-settings' },
  ),
)
