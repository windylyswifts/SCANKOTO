import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { 
  saveAttendanceLog, 
  updateAttendanceLog, 
  getPendingLogs, 
  getAllLogs, 
  cacheEventData, 
  getLocalEvent, 
  getLocalStudent,
  initDB
} from '../utils/db'; 
import { syncPendingRecords } from '../utils/sync'; 

const triggerBeep = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); 
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime); 

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15); 
  } catch (error) {
    console.error("Native audio failed to play:", error);
  }
};

const AttendanceScanner = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  const [activeEvent, setActiveEvent] = useState(() => {
    if (eventId) {
      localStorage.setItem('scankoto_active_event', eventId);
      return eventId;
    }
    return localStorage.getItem('scankoto_active_event') || 'unknown-event';
  });

  const [facingMode, setFacingMode] = useState('environment');
  const [isScanning, setIsScanning] = useState(true); 
  const [scanResult, setScanResult] = useState(null); 
  
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  
  const [networkStatus, setNetworkStatus] = useState(navigator.onLine ? 'online' : 'offline');
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isCaching, setIsCaching] = useState(false);
  const [cachedStudentCount, setCachedStudentCount] = useState(null);

  const scannedIdsRef = useRef({});

  // Direct fetch function to guarantee accurate pending counts
  const refreshPendingCount = async () => {
    try {
      const logs = await getPendingLogs();
      setPendingCount(logs.length);
    } catch (err) {
      console.error("Failed to refresh pending count:", err);
    }
  };

  useEffect(() => {
    const checkLocalCacheState = async () => {
      try {
        const db = await initDB();
        const tx = db.transaction('students', 'readonly');
        const countRequest = tx.objectStore('students').count();
        countRequest.onsuccess = () => {
          if (countRequest.result > 0) {
            setCachedStudentCount(countRequest.result);
          }
        };
      } catch (err) {}
    };
    checkLocalCacheState();
    refreshPendingCount(); // Initial load
  }, []);

  useEffect(() => {
    if (activeEvent !== 'unknown-event' && !eventId) {
      navigate(`/scan/${activeEvent}`, { replace: true });
    }
  }, [activeEvent, eventId, navigate]);

  useEffect(() => {
    const storedCooldowns = localStorage.getItem('scankoto_cooldowns');
    if (storedCooldowns) {
      try {
        const parsed = JSON.parse(storedCooldowns);
        const now = Date.now();
        const THROTTLE_MS = 5 * 60 * 1000; 
        const validEntries = {};
        for (const id in parsed) {
          if (now - parsed[id] < THROTTLE_MS) {
            validEntries[id] = parsed[id];
          }
        }
        scannedIdsRef.current = validEntries;
        localStorage.setItem('scankoto_cooldowns', JSON.stringify(validEntries));
      } catch (error) {}
    }
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setNetworkStatus('online');
      setIsSyncing(true);
      const success = await syncPendingRecords();
      setIsSyncing(false);
      // STRICT REFRESH: Force UI to re-read the database after sync finishes
      if (success) refreshPendingCount();
    };

    const handleOffline = () => setNetworkStatus('offline');
    const handleDbUpdate = () => refreshPendingCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Listen for custom db updates just in case Dashboard writes something
    window.addEventListener('db-updated', handleDbUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('db-updated', handleDbUpdate);
    };
  }, []);

  const handlePreCache = async () => {
    if (!navigator.onLine) {
      alert("An active internet connection is required to download event data for offline mode.");
      return;
    }
    setIsCaching(true);
    const result = await cacheEventData(activeEvent);
    setIsCaching(false);

    if (result.success) {
      setCachedStudentCount(result.count);
      alert(`Event offline cache ready! ${result.count} students and event duration rules saved locally.`);
    } else {
      alert(`Caching failed: ${result.error?.message || 'Unable to reach cloud server.'}`);
    }
  };

  const processAttendance = async (scannedStudentId) => {
    triggerBeep(); 
    setIsScanning(false);

    const now = Date.now();
    const studentIdClean = scannedStudentId.trim();
    const THROTTLE_MS = 5 * 60 * 1000; 
    
    const lastScanTime = scannedIdsRef.current[studentIdClean];
    if (lastScanTime && (now - lastScanTime < THROTTLE_MS)) {
      const formattedTime = new Date().toLocaleTimeString('en-US', { 
        hour12: true, hour: 'numeric', minute: 'numeric', second: 'numeric' 
      });

      setScanResult({
        type: 'Throttled',
        studentId: studentIdClean,
        studentName: 'N/A',
        timestamp: formattedTime,
        isDuplicate: true,
        message: 'Scan throttled. Please wait 5 minutes between scans.'
      });
      setIsManualModalOpen(false); 
      setManualId(''); 
      return;
    }

    scannedIdsRef.current[studentIdClean] = now;
    localStorage.setItem('scankoto_cooldowns', JSON.stringify(scannedIdsRef.current));

    let studentName = 'Unknown Student';
    let isAnomaly = true; 
    try {
      const localStudent = await getLocalStudent(studentIdClean);
      if (localStudent?.full_name) {
        studentName = localStudent.full_name;
        isAnomaly = false;
      }
    } catch (err) {}

    let existingLogs = [];
    try {
      existingLogs = await getAllLogs();
    } catch (err) {}

    const existingLog = existingLogs.find(
      log => log.eventId === activeEvent && log.studentId === studentIdClean
    );

    let resultPayload = {};
    const formattedTime = new Date(now).toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: 'numeric' });

    if (!existingLog) {
      const initialStatus = isAnomaly ? 'Anomaly / Not on Masterlist' : 'Checked-In';
      const newLog = {
        studentId: studentIdClean,
        studentName,
        eventId: activeEvent,
        timestamp: now,
        checkInTime: now,
        checkOutTime: null,
        status: initialStatus,
        syncStatus: 'pending'
      };

      await saveAttendanceLog(newLog);

      resultPayload = {
        type: 'Check-In',
        studentId: studentIdClean,
        studentName,
        timestamp: formattedTime,
        status: initialStatus,
        badgeColor: isAnomaly ? 'bg-error/20 text-error' : 'bg-info/20 text-info',
        message: isAnomaly 
          ? 'Warning: ID not found on masterlist. Allowed as Anomaly.'
          : 'Initial Check-In Logged'
      };

    } else if (!existingLog.checkOutTime) {
      const checkInTime = existingLog.checkInTime || existingLog.timestamp;
      const elapsedMs = now - checkInTime;
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      let minDurationMinutes = 0;
      try {
        const localEvent = await getLocalEvent(activeEvent);
        if (localEvent?.min_duration_minutes != null) {
          minDurationMinutes = localEvent.min_duration_minutes;
        }
      } catch (err) {}

      let finalStatus = '';
      let badgeColor = '';
      let message = '';

      if (isAnomaly) {
        finalStatus = 'Anomaly / Checked-Out';
        badgeColor = 'bg-error/20 text-error';
        message = 'Anomaly Check-Out Logged. Manual review required by host.';
      } else {
        const isValid = elapsedMinutes >= minDurationMinutes;
        finalStatus = isValid ? 'Completed / Valid' : 'Incomplete / Invalid';
        badgeColor = isValid ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning';
        message = isValid 
          ? `Check-Out Validated (${elapsedMinutes}m / ${minDurationMinutes}m required)`
          : `Early Check-Out (${elapsedMinutes}m / ${minDurationMinutes}m required)`;
      }

      const updatedLog = {
        ...existingLog,
        checkOutTime: now,
        durationMinutes: elapsedMinutes,
        status: finalStatus,
        syncStatus: 'pending'
      };

      await updateAttendanceLog(updatedLog);

      resultPayload = {
        type: 'Check-Out',
        studentId: studentIdClean,
        studentName,
        timestamp: formattedTime,
        status: finalStatus,
        elapsedMinutes,
        minDurationMinutes,
        badgeColor,
        message
      };

    } else {
      resultPayload = {
        type: 'Completed',
        studentId: studentIdClean,
        studentName,
        timestamp: formattedTime,
        status: existingLog.status || 'Completed',
        badgeColor: 'bg-neutral/20 text-neutral',
        message: 'Student has already completed Check-In & Check-Out for this event.'
      };
    }

    refreshPendingCount();

    if (navigator.onLine) {
      setIsSyncing(true);
      const success = await syncPendingRecords();
      setIsSyncing(false);
      if (success) refreshPendingCount();
    }

    setScanResult(resultPayload);
    setIsManualModalOpen(false); 
    setManualId(''); 
  };

  const handleManualSubmit = () => {
    if (manualId.trim() !== '') {
      processAttendance(manualId.trim());
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
      
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          
          <div className="w-full flex justify-between items-center mb-4">
            <div className="text-left">
              <h2 className="card-title text-2xl font-bold text-primary mb-1">
                SCANKOTO
              </h2>
              <div className="flex items-center gap-2 text-sm text-base-content/70">
                <span className={`badge badge-xs ${networkStatus === 'online' ? 'badge-success' : 'badge-error'}`}></span>
                {networkStatus === 'online' ? 'Online' : 'Offline'}
                
                {pendingCount > 0 && (
                  <span className="badge badge-neutral badge-sm ml-1 font-medium">
                    {isSyncing && <span className="loading loading-spinner loading-xs mr-1"></span>}
                    {pendingCount} Pending
                  </span>
                )}
              </div>
            </div>
            
            <button 
              type="button"
              onClick={toggleCamera} 
              className="btn btn-circle btn-ghost"
              title="Switch Camera"
              disabled={!isScanning}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="w-full mb-4 bg-base-200/60 p-2.5 rounded-xl border border-base-200 flex items-center justify-between">
            <div className="text-left text-xs">
              <span className="font-semibold block text-slate-700">Offline Preparedness</span>
              <span className="text-base-content/60">
                {cachedStudentCount !== null 
                  ? `${cachedStudentCount} students cached` 
                  : 'Ready to cache event data'}
              </span>
            </div>
            <button 
              type="button"
              onClick={handlePreCache} 
              disabled={isCaching || networkStatus === 'offline'}
              className="btn btn-xs btn-outline btn-primary"
            >
              {isCaching ? <span className="loading loading-spinner loading-xs"></span> : 'Cache Event'}
            </button>
          </div>

          <div className="w-full aspect-square rounded-2xl overflow-hidden border-4 border-primary/20 bg-black relative shadow-inner flex items-center justify-center">
             {isScanning ? (
               <Scanner
                  onScan={(detectedCodes) => {
                    let scannedText = null;
                    if (Array.isArray(detectedCodes) && detectedCodes.length > 0 && detectedCodes[0].rawValue) {
                      scannedText = detectedCodes[0].rawValue;
                    } else if (typeof detectedCodes === 'string') {
                      scannedText = detectedCodes;
                    }

                    if (scannedText) {
                      processAttendance(scannedText);
                    }
                  }}
                  onError={(error) => console.error(error?.message)}
                  constraints={{ facingMode: facingMode }}
                  components={{ audio: false, onOff: true, finder: true }}
               />
             ) : (
               <div className="text-white/50 flex flex-col items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9V5a2 2 0 00-2-2H6a2 2 0 00-2-2v14a2 2 0 002 2h2a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                 </svg>
                 <span>Processing Scan...</span>
               </div>
             )}
          </div>

          <div className="w-full mt-6">
            <button 
              type="button"
              className="btn btn-outline btn-primary w-full"
              onClick={() => setIsManualModalOpen(true)}
              disabled={!isScanning}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Enter ID Manually
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <span className="text-xs text-base-content/50 font-mono">Event ID: {activeEvent}</span>
          </div>

        </div>
      </div>

      <dialog className={`modal modal-bottom sm:modal-middle ${scanResult ? 'modal-open' : ''}`}>
        <div className="modal-box text-center">
          
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${scanResult?.badgeColor || 'bg-success/20 text-success'}`}>
             {scanResult?.isDuplicate ? (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
             ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
               </svg>
             )}
          </div>
          
          {scanResult?.studentName && (
            <h4 className={`font-medium text-sm mb-1 ${scanResult.studentName === 'Unknown Student' ? 'text-error' : 'text-base-content/60'}`}>
              {scanResult.studentName}
            </h4>
          )}

          <h3 className="font-bold text-2xl mb-1">
            {scanResult?.studentId}
          </h3>

          <div className="inline-block px-3 py-1 rounded-full font-semibold text-xs mb-3 bg-base-200">
            Action: <span className="uppercase">{scanResult?.type}</span>
          </div>

          <p className="font-semibold text-sm mb-1 text-slate-700 px-4">
            {scanResult?.message}
          </p>

          <div className="text-xs opacity-70 mb-6">
            Timestamp: {scanResult?.timestamp}
          </div>

          <div className="modal-action mt-0 justify-center">
            <button type="button" className="btn btn-primary btn-wide" onClick={resetScanner}>
              Scan Next
            </button>
          </div>
        </div>
      </dialog>

      <dialog className={`modal ${isManualModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Manual Entry</h3>
          <p className="py-4 text-sm text-base-content/70">Enter the Student ID below if the QR code is damaged or unreadable.</p>
          <input 
            type="text" 
            placeholder="e.g. CSU-000001" 
            className="input input-bordered w-full mb-4 font-mono" 
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            autoFocus={isManualModalOpen}
          />
          <div className="modal-action mt-0">
            <button type="button" className="btn" onClick={() => setIsManualModalOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleManualSubmit}>Submit</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setIsManualModalOpen(false)}>close</button>
        </form>
      </dialog>

    </div>
  );
};

export default AttendanceScanner;