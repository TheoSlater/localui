import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Settings, defaultSettings } from '@/config/settings';

interface SettingsStore extends Settings {
  setSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setSettings: (partial) => set(partial),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'settings',
    },
  ),
);
