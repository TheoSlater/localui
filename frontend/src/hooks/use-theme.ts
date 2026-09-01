import * as React from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import type { Theme } from '@/config/settings';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useTheme() {
  const theme = useSettingsStore((s) => s.theme);
  const setSettings = useSettingsStore((s) => s.setSettings);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  React.useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = React.useCallback((t: Theme) => setSettings({ theme: t }), [setSettings]);

  return { theme, setTheme };
}
