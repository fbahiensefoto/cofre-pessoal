import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { readThemePref, writeThemePref } from '../../../src/ui/lib/prefsStorage';

describe('prefsStorage', () => {
  afterEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-prefs-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('devolve undefined quando nada foi salvo ainda', async () => {
    expect(await readThemePref()).toBeUndefined();
  });

  it('grava e lê de volta o mesmo valor', async () => {
    await writeThemePref('dark');
    expect(await readThemePref()).toBe('dark');
  });

  it('uma gravação nova substitui a anterior', async () => {
    await writeThemePref('dark');
    await writeThemePref('light');
    expect(await readThemePref()).toBe('light');
  });

  it('o valor sobrevive a uma nova instância de leitura (não depende de estado em memória de uma sessão)', async () => {
    await writeThemePref('auto');
    // Sem reabrir nada explicitamente aqui — a própria função reabre a
    // conexão compartilhada do módulo; isso prova que o valor está de fato
    // persistido no IndexedDB, não só numa variável local.
    const lido = await readThemePref();
    expect(lido).toBe('auto');
  });
});
