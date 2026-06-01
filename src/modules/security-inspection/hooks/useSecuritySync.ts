import { useCallback, useEffect, useState } from 'react';
import { listSyncQueue, removeSyncEntry } from '../offline/idb';
import { securityInspectionAPI } from '../api';
import { useOnlineStatus } from './useOnlineStatus';

export function useSecuritySync() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    const q = await listSyncQueue();
    setPending(q.length);
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const syncNow = useCallback(async () => {
    if (!online) return { ok: false as const, count: 0 };
    const queue = await listSyncQueue();
    if (queue.length === 0) return { ok: true as const, count: 0 };
    setSyncing(true);
    try {
      await securityInspectionAPI.syncBatch(queue.map((e) => e.payload));
      for (const e of queue) await removeSyncEntry(e.id);
      await refreshPending();
      return { ok: true as const, count: queue.length };
    } catch {
      return { ok: false as const, count: 0 };
    } finally {
      setSyncing(false);
    }
  }, [online, refreshPending]);

  useEffect(() => {
    if (online && pending > 0) {
      syncNow();
    }
  }, [online, pending, syncNow]);

  return { online, pending, syncing, syncNow, refreshPending };
}
