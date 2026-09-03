// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useTheme } from '../../../src/ui/lib/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
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
});
