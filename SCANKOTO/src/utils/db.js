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
      syncStatus: logData.syncStatus || 'pending',
      savedAt: Date.now()
    });

    request.onsuccess = () => {
      window.dispatchEvent(new Event('db-updated'));
      resolve(request.result);
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

export const updateAttendanceLog = async (logData) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put({
      ...logData,
      updatedAt: Date.now()
    });

    request.onsuccess = () => {
      window.dispatchEvent(new Event('db-updated'));
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
      const pending = (request.result || []).filter((log) => log.syncStatus === 'pending');
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
    const [{ data: eventData, error: eventError }, { data: rosterRows, error: rosterError }] =
      await Promise.all([
        supabase.from('events').select('*').eq('event_id', eventId).single(),
        supabase.from('event_roster').select('student_id, students (*)').eq('event_id', eventId)
      ]);

    if (eventError) throw eventError;
    if (rosterError) throw rosterError;

    let rawStudents = (rosterRows || []).map((row) => row.students).filter(Boolean);

    // Fallback for legacy events created before event_roster existed
    if (rawStudents.length === 0 && (eventData?.expected_headcount || 0) > 0) {
      const { data: legacyStudents, error: legacyError } = await supabase
        .from('students')
        .select('*');
      if (legacyError) throw legacyError;
      rawStudents = legacyStudents || [];
    }

    const validStudentMap = new Map();
    rawStudents.forEach((student) => {
      if (student?.student_id && student.qr_hash !== 'anomaly') {
        validStudentMap.set(student.student_id, {
          ...student,
          cachedEventId: eventId
        });
      }
    });
    const cleanStudents = Array.from(validStudentMap.values());

    const db = await initDB();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(['events', 'students'], 'readwrite');
      tx.objectStore('events').put(eventData);

      const studentStore = tx.objectStore('students');
      studentStore.clear();
      cleanStudents.forEach((student) => studentStore.put(student));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return { success: true, count: cleanStudents.length, event: eventData };
  } catch (error) {
    return { success: false, error };
  }
};

export const getEventCacheStatus = async (eventId) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['events', 'students'], 'readonly');
    const eventReq = tx.objectStore('events').get(eventId);
    const studentsReq = tx.objectStore('students').getAll();

    tx.oncomplete = () => {
      const localEvent = eventReq.result || null;
      const validStudents = (studentsReq.result || []).filter(
        (s) => s.qr_hash !== 'anomaly' && s.cachedEventId === eventId
      );
      const isEventCached = Boolean(localEvent && validStudents.length > 0);

      resolve({
        isCached: isEventCached,
        count: isEventCached ? validStudents.length : 0,
        event: localEvent
      });
    };
    tx.onerror = () => reject(tx.error);
  });
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
    request.onsuccess = () => {
      const student = request.result;
      resolve(student && student.qr_hash !== 'anomaly' ? student : undefined);
    };
    request.onerror = () => reject(tx.error);
  });
};

export const getStudentAttendanceRecord = async (eventId, studentId) => {
  const logs = await getAllLogs();
  const matches = logs.filter((log) => log.eventId === eventId && log.studentId === studentId);
  if (matches.length === 0) return undefined;

  return matches.sort((a, b) => {
    if (Boolean(b.checkOutTime) !== Boolean(a.checkOutTime)) {
      return b.checkOutTime ? 1 : -1;
    }
    return (b.updatedAt || b.savedAt || 0) - (a.updatedAt || a.savedAt || 0);
  })[0];
};