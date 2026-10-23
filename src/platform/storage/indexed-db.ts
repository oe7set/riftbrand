import type { ProfileStore } from './profile-save';
import { browserStore } from './settings';

const DB_NAME = 'riftbrand';
const STORE = 'kv';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Profile storage in IndexedDB (TECH_DESIGN §11): larger quota than localStorage and atomic
 * multi-key writes, so the main slot and its backup never get out of step.
 */
function indexedDbStore(): ProfileStore {
  const db = openDb();
  return {
    async read(key) {
      const tx = (await db).transaction(STORE, 'readonly');
      const value = await request(tx.objectStore(STORE).get(key));
      return typeof value === 'string' ? value : null;
    },
    async write(entries) {
      const tx = (await db).transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const [k, v] of Object.entries(entries)) store.put(v, k);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
}

/** localStorage fallback (e.g. IndexedDB blocked in some private modes). */
function localStore(): ProfileStore | null {
  const ls = browserStore();
  if (!ls) return null;
  const prefix = 'riftbrand.';
  return {
    read: async (key) => ls.getItem(prefix + key),
    write: async (entries) => {
      for (const [k, v] of Object.entries(entries)) ls.setItem(prefix + k, v);
    },
  };
}

export function browserProfileStore(): ProfileStore | null {
  try {
    if (typeof indexedDB !== 'undefined') return indexedDbStore();
  } catch {
    // Fall through to localStorage.
  }
  return localStore();
}

/** Asks the browser not to evict our data under storage pressure (best effort). */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // Not supported: nothing to do.
  }
}

/** Copies text for the export code; resolves false where the clipboard is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
