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
      version: 1,
      migrate: (persisted: unknown) => {
        const value = persisted as Partial<Settings> & { activeProviderId?: string };
        const providers = value.providers ?? defaultSettings.providers;
        const legacyProvider = providers.find((p) => p.id === value.activeProviderId);
        return {
          ...defaultSettings,
          ...value,
          providers,
          selectedModel:
            value.selectedModel ??
            (legacyProvider?.model?.trim()
              ? { providerId: legacyProvider.id, modelId: legacyProvider.model }
              : undefined),
        };
      },
    },
  ),
);
