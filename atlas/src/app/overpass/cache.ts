/**
 * Overpass responses are cached in IndexedDB, not localStorage: a corridor-wide
 * query runs to several megabytes, past localStorage's ~5 MB cap, and its
 * synchronous write would block the first paint.
 */
const DB_NAME = "mjsl-atlas";
const STORE = "overpass";
const VERSION = 1;

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CachedResponse<T> {
  timestamp: number;
  payload: T;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readCache<T>(key: string): Promise<CachedResponse<T> | null> {
  try {
    const db = await openDb();
    const value = await new Promise<CachedResponse<T> | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value && typeof value.timestamp === "number" ? value : null;
  } catch (error) {
    console.warn("Cache Overpass illisible, il sera reconstruit.", error);
    return null;
  }
}

export async function writeCache<T>(key: string, payload: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put({ timestamp: Date.now(), payload }, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (error) {
    // Storage unavailable or over quota: carry on without a cache.
    console.warn("Cache Overpass non enregistre.", error);
  }
}

export function ageLabel(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}
