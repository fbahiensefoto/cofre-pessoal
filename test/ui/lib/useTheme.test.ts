// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useTheme, reconcileThemeFromIndexedDB } from '../../../src/ui/lib/useTheme';
import { readThemePref, writeThemePref } from '../../../src/ui/lib/prefsStorage';

async function limparBancoDePrefs() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('cofre-pessoal-prefs-db');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
    await limparBancoDePrefs();
  });

  it('começa em "dark" quando não há preferência salva (padrão pedido pelo usuário)', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('dark');
  });

  it('escolher "auto" explicitamente sobrevive a um remount, em vez de cair pro padrão de novo', () => {
    const primeira = renderHook(() => useTheme());
    act(() => primeira.result.current.setPreference('auto'));
    expect(localStorage.getItem('cofre-pessoal-theme')).toBe('auto');

    const segunda = renderHook(() => useTheme());
    expect(segunda.result.current.preference).toBe('auto');
  });

  it('setPreference salva no localStorage e aplica no documentElement', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference('dark'));

    expect(result.current.preference).toBe('dark');
    expect(localStorage.getItem('cofre-pessoal-theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('carrega a preferência já salva ao montar', () => {
    localStorage.setItem('cofre-pessoal-theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('light');
  });

  it('cai para "dark" sem quebrar quando localStorage.getItem lança (navegador bloqueando dados de site)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('acesso a localStorage bloqueado');
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.preference).toBe('dark');
  });

  it('setPreference não lança quando localStorage.setItem lança', () => {
    const { result } = renderHook(() => useTheme());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('acesso a localStorage bloqueado');
    });

    expect(() => act(() => result.current.setPreference('dark'))).not.toThrow();
    expect(result.current.preference).toBe('dark');
  });

  it('setPreference também grava no IndexedDB, como reforço do localStorage', async () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference('light'));

    await waitFor(async () => expect(await readThemePref()).toBe('light'));
  });
});

describe('reconcileThemeFromIndexedDB', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    await limparBancoDePrefs();
  });

  it('cura um localStorage vazio usando o valor salvo no IndexedDB (relatado: tema volta pro claro sozinho ao reabrir)', async () => {
    // Simula o cenário relatado: uma escolha explícita ("escuro") está
    // salva no IndexedDB (reforço), mas o localStorage esvaziou sozinho
    // entre uma sessão e outra.
    await writeThemePref('dark');
    expect(localStorage.getItem('cofre-pessoal-theme')).toBeNull();

    await reconcileThemeFromIndexedDB();

    expect(localStorage.getItem('cofre-pessoal-theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('não mexe em nada quando o localStorage já bate com o IndexedDB', async () => {
    await writeThemePref('light');
    localStorage.setItem('cofre-pessoal-theme', 'light');

    await reconcileThemeFromIndexedDB();

    expect(localStorage.getItem('cofre-pessoal-theme')).toBe('light');
  });

  it('não faz nada quando não há nada salvo no IndexedDB ainda (primeiro acesso)', async () => {
    await reconcileThemeFromIndexedDB();

    expect(localStorage.getItem('cofre-pessoal-theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
