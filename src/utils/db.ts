import { Spot } from '../types/spot';

const DB_NAME = 'SegnapostoRapidoDB';
const DB_VERSION = 1;
const STORE_NAME = 'spots';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non supportato in questo browser.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    req.onerror = () => {
      reject(req.error || new Error('Impossibile aprire il database locale.'));
    };
  });
}

export async function getAllSpots(): Promise<Spot[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      resolve((req.result as Spot[]) || []);
    };
    req.onerror = () => {
      reject(req.error || new Error('Errore nella lettura dei punti salvati.'));
    };
    tx.oncomplete = () => db.close();
  });
}

export async function putSpot(spot: Spot): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(spot);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Errore nel salvataggio del segnaposto.'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Salvataggio annullato (memoria esaurita?).'));
    };
  });
}

export async function removeSpot(id: number | string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Errore nella rimozione del segnaposto.'));
    };
  });
}
