// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  });

  it('começa em "auto" quando não há preferência salva', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('auto');
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
});
