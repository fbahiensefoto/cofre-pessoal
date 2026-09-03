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
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      return salvo === 'light' || salvo === 'dark' ? salvo : 'auto';
    } catch {
      // Navegador configurado para bloquear dados de site: localStorage lança
      // ao ser acessado. Isso roda dentro do inicializador de useState (ou
      // seja, durante a renderização) — sem o try/catch, derrubaria a
      // renderização inicial do app inteiro. 'auto' é uma preferência válida.
      return 'auto';
    }
  });

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'auto') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Falha ao persistir não é motivo para bloquear a troca de tema nesta
      // sessão — só significa que a escolha não sobrevive entre sessões
      // neste navegador.
    }
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
