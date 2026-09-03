const DB_NAME = 'cofre-pessoal-db';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const RECORD_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class VaultStorage {
  async exists(): Promise<boolean> {
    const db = await openDb();
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).count(RECORD_KEY);
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async readBytes(): Promise<Uint8Array> {
    const db = await openDb();
    try {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
        req.onsuccess = () => {
          if (req.result === undefined) {
            reject(new Error('Nenhum cofre encontrado no IndexedDB.'));
          } else {
            resolve(req.result as Uint8Array);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  /**
   * Grava [bytes] numa única transação `readwrite`. O IndexedDB garante
   * atomicidade de transação: se a transação não commitar (aba fechada,
   * exceção, etc.), o registro anterior permanece intacto — não existe um
   * estado "parcialmente escrito" possível, ao contrário de um arquivo em
   * disco.
   */
  async writeAtomic(bytes: Uint8Array): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(bytes, RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}
