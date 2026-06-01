import type { DepartmentTemplate, InspectionDraft, SyncQueueEntry } from '../types';

const DB_NAME = 'ys-security-inspection';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'clientId' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'departmentId' });
      }
    };
  });
}

async function tx<T>(
  store: 'drafts' | 'syncQueue' | 'catalog',
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const objectStore = transaction.objectStore(store);
    const result = fn(objectStore);
    transaction.oncomplete = () => {
      if (result && 'result' in result) resolve((result as IDBRequest<T>).result);
      else resolve(undefined);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveDraft(draft: InspectionDraft): Promise<void> {
  await tx('drafts', 'readwrite', (s) => s.put(draft));
}

export async function getDraft(clientId: string): Promise<InspectionDraft | undefined> {
  const v = await tx<InspectionDraft>('drafts', 'readonly', (s) => s.get(clientId));
  return v ?? undefined;
}

/** Khôi phục phiên checklist đang dở cho cùng QR/tài sản */
export async function getDraftByAsset(
  assetId: number,
  qrCode: string
): Promise<InspectionDraft | undefined> {
  const all = await listDrafts();
  return all
    .filter((d) => d.assetId === assetId && d.qrCode === qrCode)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export async function listDrafts(): Promise<InspectionDraft[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('drafts', 'readonly');
    const req = t.objectStore('drafts').getAll();
    req.onsuccess = () => resolve(req.result as InspectionDraft[]);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSync(entry: SyncQueueEntry): Promise<void> {
  await tx('syncQueue', 'readwrite', (s) => s.put(entry));
}

export async function listSyncQueue(): Promise<SyncQueueEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('syncQueue', 'readonly');
    const req = t.objectStore('syncQueue').getAll();
    req.onsuccess = () => resolve(req.result as SyncQueueEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeSyncEntry(id: string): Promise<void> {
  await tx('syncQueue', 'readwrite', (s) => s.delete(id));
}

export async function cacheTemplate(departmentId: number, template: DepartmentTemplate): Promise<void> {
  await tx('catalog', 'readwrite', (s) => s.put({ departmentId, template, cachedAt: new Date().toISOString() }));
}

export async function getCachedTemplate(
  departmentId: number
): Promise<DepartmentTemplate | undefined> {
  const row = await tx<{ departmentId: number; template: DepartmentTemplate }>(
    'catalog',
    'readonly',
    (s) => s.get(departmentId)
  );
  return row?.template;
}
