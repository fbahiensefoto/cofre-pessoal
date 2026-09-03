import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';

function randomBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
}

describe('VaultStorage', () => {
  let storage: VaultStorage;

  beforeEach(() => {
    storage = new VaultStorage();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('exists() é falso antes de qualquer gravação e verdadeiro depois', async () => {
    expect(await storage.exists()).toBe(false);

    await storage.writeAtomic(new Uint8Array([1, 2, 3]));

    expect(await storage.exists()).toBe(true);
  });

  it('writeAtomic seguido de readBytes devolve exatamente os mesmos bytes', async () => {
    const conteudo = randomBytes(500);

    await storage.writeAtomic(conteudo);
    const lido = await storage.readBytes();

    expect(lido).toEqual(conteudo);
  });

  it('writeAtomic sobrescreve completamente o registro anterior', async () => {
    await storage.writeAtomic(new Uint8Array([1, 1, 1]));
    await storage.writeAtomic(new Uint8Array([2, 2, 2, 2]));

    const lido = await storage.readBytes();

    expect(lido).toEqual(new Uint8Array([2, 2, 2, 2]));
  });

  it('readBytes sem cofre existente rejeita a promise', async () => {
    await expect(storage.readBytes()).rejects.toThrow();
  });

  it('uma transação que não commita não altera o registro anterior', async () => {
    await storage.writeAtomic(new Uint8Array([9, 9, 9]));

    // Simula uma "gravação interrompida": abre a mesma transação de baixo
    // nível que writeAtomic usaria, grava um valor novo, mas aborta em vez
    // de deixar commitar — equivalente a app fechado/exceção no meio da
    // gravação, sem precisar depender de timing real.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('cofre-pessoal-db', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('vault', 'readwrite');
        tx.objectStore('vault').put(new Uint8Array([1, 1]), 'current');
        tx.onabort = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
        tx.abort();
      };
      req.onerror = () => reject(req.error);
    });

    const lido = await storage.readBytes();
    expect(lido).toEqual(new Uint8Array([9, 9, 9]));
  });
});
