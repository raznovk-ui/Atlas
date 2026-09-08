import type { Observation } from "../../domain/types.js";

/**
 * Local-first persistence. Everything the user contributes lives in the
 * browser; the domain types are storage-agnostic, so a server can be added
 * later without touching them.
 */
const DB_NAME = "mjsl-atlas";
const VERSION = 3;
export const OBSERVATIONS = "observations";
export const OVERPASS = "overpass";
export const PHOTOS = "photos";

/**
 * The single opener for the app's database. Every store must be created here:
 * opening the same database at a lower version from another module throws a
 * VersionError, so the schema cannot be split across files.
 */
export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OVERPASS)) db.createObjectStore(OVERPASS);
      if (!db.objectStoreNames.contains(OBSERVATIONS)) db.createObjectStore(OBSERVATIONS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadObservations(): Promise<Observation[]> {
  try {
    const db = await openDb();
    const all = await new Promise<Observation[]>((resolve, reject) => {
      const request = db.transaction(OBSERVATIONS, "readonly").objectStore(OBSERVATIONS).getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return all;
  } catch (error) {
    console.warn("Observations illisibles.", error);
    return [];
  }
}

export async function saveObservations(observations: Observation[]): Promise<void> {
  if (observations.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OBSERVATIONS, "readwrite");
    const store = transaction.objectStore(OBSERVATIONS);
    for (const observation of observations) store.put(observation);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function deleteObservations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OBSERVATIONS, "readwrite");
    const store = transaction.objectStore(OBSERVATIONS);
    for (const id of ids) store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export interface StoredPhoto {
  id: string;
  filename: string;
  /** Original bytes, kept as uploaded so nothing is lost before export. */
  original: Blob;
  thumbnail: Blob;
  mimeType: string;
  size: number;
}

export async function savePhoto(photo: StoredPhoto): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PHOTOS, "readwrite");
    transaction.objectStore(PHOTOS).put(photo);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadPhotos(): Promise<StoredPhoto[]> {
  try {
    const db = await openDb();
    const all = await new Promise<StoredPhoto[]>((resolve, reject) => {
      const request = db.transaction(PHOTOS, "readonly").objectStore(PHOTOS).getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return all;
  } catch (error) {
    console.warn("Photos illisibles.", error);
    return [];
  }
}

export async function deletePhotos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PHOTOS, "readwrite");
    const store = transaction.objectStore(PHOTOS);
    for (const id of ids) store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
