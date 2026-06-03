const DB_NAME    = "slora-offline";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

// ── Caché genérico key-value ──────────────────────────────────────────────────

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache", "readwrite");
    tx.objectStore("cache").put({ key, value, ts: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("cache").objectStore("cache").get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
    req.onerror   = () => reject(req.error);
  });
}

// ── Cola de sincronización ────────────────────────────────────────────────────

export interface SyncItem {
  id: number;
  type: string;
  data: Record<string, unknown>;
  _queued_at: number;
}

export async function queueAdd(type: string, data: Record<string, unknown>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    tx.objectStore("sync_queue").add({ type, data, _queued_at: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function queueGetAll(): Promise<SyncItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("sync_queue").objectStore("sync_queue").getAll();
    req.onsuccess = () => resolve(req.result as SyncItem[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function queueRemove(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    tx.objectStore("sync_queue").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function queueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("sync_queue").objectStore("sync_queue").count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
