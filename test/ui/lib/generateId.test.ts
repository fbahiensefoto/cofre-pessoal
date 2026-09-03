import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId } from '../../../src/ui/lib/generateId';

describe('generateId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('usa crypto.randomUUID quando disponível', () => {
    const spy = vi.spyOn(crypto, 'randomUUID');
    const id = generateId();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(id).toBe(spy.mock.results[0]?.value);
  });

  it('cai para crypto.getRandomValues quando randomUUID não existe (Safari em contexto não seguro)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

    const id = generateId();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('cai para Math.random quando nem getRandomValues existe', () => {
    vi.stubGlobal('crypto', {});

    const id = generateId();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('duas chamadas nunca produzem o mesmo id, em qualquer caminho', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(generateId()).not.toBe(generateId());
  });
});
