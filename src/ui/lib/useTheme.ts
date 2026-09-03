import { useCallback, useEffect, useState } from 'preact/hooks';

export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'cofre-pessoal-theme';

function applyTheme(preference: ThemePreference) {
  if (preference === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = preference;
  }
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const salvo = localStorage.getItem(STORAGE_KEY);
    return salvo === 'light' || salvo === 'dark' ? salvo : 'auto';
  });

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    if (next === 'auto') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
