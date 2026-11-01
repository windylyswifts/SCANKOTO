const DB_NAME = 'ScankotoDB';
const DB_VERSION = 1;
const STORE_NAME = 'attendanceLogs';

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('studentId', 'studentId', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const saveAttendanceLog = async (logData) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.add({
      ...logData,
      syncStatus: 'pending',
      savedAt: Date.now()
    });

    request.onsuccess = () => {
      window.dispatchEvent(new Event('db-updated')); // Notify UI to update counter
      resolve(request.result);
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

export const getPendingLogs = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Filter for records waiting to be uploaded
      const pending = (request.result || []).filter(log => log.syncStatus === 'pending');
      resolve(pending);
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

export const deleteLog = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      window.dispatchEvent(new Event('db-updated'));
      resolve(true);
    };
    request.onerror = (event) => reject(event.target.error);
  });
};