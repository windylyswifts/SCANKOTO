import { getPendingLogs, deleteLog } from './db';

// Simulated central database API endpoint
const mockApiUpload = async (logs) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`[Network] Successfully synced ${logs.length} records to central database.`);
      resolve({ success: true });
    }, 1500); 
  });
};

export const syncPendingRecords = async () => {
  if (!navigator.onLine) return false;

  try {
    const pendingLogs = await getPendingLogs();
    if (pendingLogs.length === 0) return true; 

    // Notify UI that a background sync is starting
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: true } }));

    // 1. Dispatch payload to server
    // (In production: const response = await fetch('/api/sync', { method: 'POST', body: JSON.stringify(pendingLogs) });)
    const response = await mockApiUpload(pendingLogs);

    if (response.success) {
      // 2. Delete local records ONLY after the server confirms receipt
      for (const log of pendingLogs) {
        await deleteLog(log.id);
      }
      window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: true } }));
      return true;
    }
    throw new Error('Server rejected upload payload');
  } catch (error) {
    console.error("[Network] Background sync failed:", error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: false } }));
    return false;
  }
};