import { useCallback, useEffect, useState } from 'preact/hooks';
import { readThemePref, writeThemePref } from './prefsStorage';

export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'cofre-pessoal-theme';

export function ehPreferenciaValida(valor: unknown): valor is ThemePreference {
  return valor === 'light' || valor === 'dark' || valor === 'auto';
}

function aplicarMetaParaEscuro(escuro: boolean) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0C0C0D' : '#F1F1EF');
  document
    .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', escuro ? 'black' : 'default');
}

// Só existe um listener de tema do sistema por vez — cada chamada de
// applyTheme remove o anterior antes de, condicionalmente, registrar um novo
// (nunca só "registrar" isoladamente), senão cada troca de preferência vaza
// um listener a mais na media query.
let removerListenerTema: (() => void) | null = null;

export function applyTheme(preference: ThemePreference) {
  if (preference === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = preference;
  }

  removerListenerTema?.();
  removerListenerTema = null;

  // O jsdom deste projeto não implementa matchMedia — toda leitura dele fica
  // atrás desta guarda, só aqui.
  if (preference === 'auto') {
    if (typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const escutar = () => aplicarMetaParaEscuro(mql.matches);
      mql.addEventListener('change', escutar);
      removerListenerTema = () => mql.removeEventListener('change', escutar);
      aplicarMetaParaEscuro(mql.matches);
    }
  } else {
    aplicarMetaParaEscuro(preference === 'dark');
  }
}

/**
 * Roda uma vez, no carregamento do app (chamada em main.tsx) — não presa ao
 * ciclo de vida de nenhum componente. Relatado no aparelho real: a
 * preferência de tema volta pro claro sozinha depois de fechar e reabrir o
 * app, ou seja, o localStorage não está sobrevivendo entre sessões nesse
 * navegador, mesmo com a escolha salva corretamente na hora. O IndexedDB
 * usado pelo cofre já provou ser resistente a isso; guardamos a preferência
 * lá também (writeThemePref, em setPreference) e usamos aqui pra "curar" o
 * localStorage se ele tiver esvaziado sozinho.
 *
 * Antes vivia como useEffect dentro de useTheme(), mas só SettingsScreen usa
 * esse hook — a cura só rodava se a pessoa abrisse Configurações depois de
 * reabrir o app, não no carregamento em si. Ficar fora do ciclo de
 * montagem/desmontagem de componente também evita ter que reconciliar uma
 * leitura assíncrona de IndexedDB com o React desmontando a árvore no meio
 * do caminho (foi exatamente isso que expôs uma corrida nos testes de
 * SettingsScreen).
 */
export async function reconcileThemeFromIndexedDB(): Promise<void> {
  let salvo: string | undefined;
  try {
    salvo = await readThemePref();
  } catch {
    return;
  }
  if (!ehPreferenciaValida(salvo)) return;

  try {
    const noLocalStorage = localStorage.getItem(STORAGE_KEY);
    if (noLocalStorage === salvo) return;
    localStorage.setItem(STORAGE_KEY, salvo);
  } catch {
    // Sem conseguir gravar no localStorage agora, ainda aplicamos o tema
    // certo nesta carga da página via applyTheme abaixo.
  }
  applyTheme(salvo);
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      // Sem preferência salva: padrão é escuro (pedido explícito), não
      // acompanhar o tema do sistema — "Automático" continua disponível nas
      // configurações pra quem quiser esse comportamento.
      return ehPreferenciaValida(salvo) ? salvo : 'dark';
    } catch {
      // Navegador configurado para bloquear dados de site: localStorage lança
      // ao ser acessado. Isso roda dentro do inicializador de useState (ou
      // seja, durante a renderização) — sem o try/catch, derrubaria a
      // renderização inicial do app inteiro.
      return 'dark';
    }
  });

  // Aplica no <html> a cada mudança de preference, incluindo a montagem
  // inicial — sem indexedDB nem promise aqui dentro, só a mutação de DOM
  // síncrona; isso nunca foi a causa da corrida vista nos testes (essa era
  // só a reconciliação assíncrona, já movida pra reconcileThemeFromIndexedDB).
  // Fora dos testes, o script inline em index.html já aplicou o tema certo
  // antes desta primeira renderização — isso aqui só faz o hook não depender
  // dele pra ficar coerente em qualquer contexto que use o hook sozinho.
  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      // Grava mesmo 'auto' explicitamente: sem isso, "sem preferência salva"
      // e "escolheu Automático de propósito" ficam indistinguíveis, e o
      // padrão de primeiro acesso (escuro) sobrescreveria uma escolha real.
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Falha ao persistir não é motivo para bloquear a troca de tema nesta
      // sessão — só significa que a escolha não sobrevive entre sessões
      // neste navegador.
    }
    writeThemePref(next).catch(() => {
      // Mesma lógica: se nem o reforço no IndexedDB conseguir gravar, o
      // tema ainda troca normalmente nesta sessão.
    });
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
