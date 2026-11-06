import { supabase } from './supabaseClient';

const DB_NAME = 'ScankotoDB';
const DB_VERSION = 2; 
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

      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'event_id' });
      }

      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: 'student_id' });
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

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const updateAttendanceLog = async (logData) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put(logData);

    request.onsuccess = () => resolve(request.result);
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

    request.onsuccess = () => resolve(true);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const getAllLogs = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const updateLocalLogSyncStatus = async (id, newStatus) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) {
        record.syncStatus = newStatus;
        const putRequest = store.put(record);
        
        putRequest.onsuccess = () => {
          // CRITICAL: Forces React to re-fetch the database live
          window.dispatchEvent(new Event('db-updated')); 
          resolve(true);
        };
        putRequest.onerror = (e) => reject(e.target.error);
      } else {
        resolve(false);
      }
    };
    getRequest.onerror = (e) => reject(e.target.error);
  });
};

export const cacheEventData = async (eventId) => {
  try {
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (eventError) throw eventError;

    const { data: studentsData, error: studentError } = await supabase
      .from('students')
      .select('*');

    if (studentError) throw studentError;

    const db = await initDB();
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').put(eventData);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await new Promise((resolve, reject) => {
      const tx = db.transaction('students', 'readwrite');
      const store = tx.objectStore('students');
      studentsData.forEach(student => store.put(student));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return { success: true, count: studentsData.length };
    
  } catch (error) {
    return { success: false, error };
  }
};

export const getLocalEvent = async (eventId) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readonly');
    const request = tx.objectStore('events').get(eventId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(tx.error);
  });
};

export const getLocalStudent = async (studentId) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('students', 'readonly');
    const request = tx.objectStore('students').get(studentId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(tx.error);
  });
};

export const getStudentAttendanceRecord = async (eventId, studentId) => {
  const logs = await getAllLogs();
  return logs.find(log => log.eventId === eventId && log.studentId === studentId);
};