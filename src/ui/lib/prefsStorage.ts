/**
 * Guarda preferências de interface (hoje só o tema) num banco IndexedDB
 * separado do cofre — não é dado sensível, não precisa (nem pode, já que
 * tem que estar disponível antes de desbloquear) estar dentro do payload
 * cifrado.
 *
 * Existe como reforço do localStorage, não substituto: localStorage é
 * síncrono (necessário pro script inline em index.html decidir o tema antes
 * da primeira pintura) e continua sendo a leitura/escrita principal. Mas
 * href relatou a preferência voltando pro tema claro sozinha depois de
 * fechar o app — o que bate com iOS às vezes limpando dados de site com
 * mais agressividade sobre localStorage do que sobre IndexedDB. Gravar nos
 * dois e, ao montar, usar o IndexedDB pra "curar" um localStorage que
 * esvaziou sozinho, sem depender de entender exatamente por que isso
 * aconteceu no aparelho dele.
 */
const DB_NAME = 'cofre-pessoal-prefs-db';
const DB_VERSION = 1;
const STORE_NAME = 'prefs';
const THEME_KEY = 'theme';

let dbPromise: Promise<IDBDatabase> | null = null;

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

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb().then((db) => {
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      return db;
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function readThemePref(): Promise<string | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(THEME_KEY);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function writeThemePref(valor: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(valor, THEME_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
