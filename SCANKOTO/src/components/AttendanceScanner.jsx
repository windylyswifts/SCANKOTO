import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '../utils/supabaseClient';
import {
  saveAttendanceLog,
  updateAttendanceLog,
  getPendingLogs,
  getStudentAttendanceRecord,
  cacheEventData,
  getLocalEvent,
  getLocalStudent,
  initDB
} from '../utils/db';
import { syncPendingRecords } from '../utils/sync';

const COOLDOWN_MS = 300000; // 5 minutes

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
    console.error('Native audio failed to play:', error);
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
  const [isEventEnded, setIsEventEnded] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualId, setManualId] = useState('');

  const [networkStatus, setNetworkStatus] = useState(navigator.onLine ? 'online' : 'offline');
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isCaching, setIsCaching] = useState(false);
  const [cachedStudentCount, setCachedStudentCount] = useState(null);

  const scannedIdsRef = useRef({});
  const isProcessingRef = useRef(false);

  const refreshPendingCount = async () => {
    try {
      const logs = await getPendingLogs();
      setPendingCount(logs.length);
    } catch (err) {}
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

    if (navigator.onLine && activeEvent !== 'unknown-event') {
      cacheEventData(activeEvent).then((res) => {
        if (res.success) setCachedStudentCount(res.count);
      });
    }

    const handleOnline = async () => {
      setNetworkStatus('online');
      setIsSyncing(true);
      await syncPendingRecords();
      setIsSyncing(false);
      refreshPendingCount();
    };

    const handleOffline = () => setNetworkStatus('offline');
    const handleDbUpdate = () => refreshPendingCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('db-updated', handleDbUpdate);

    if (navigator.onLine) {
      syncPendingRecords().then(() => refreshPendingCount());
    } else {
      refreshPendingCount();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('db-updated', handleDbUpdate);
    };
  }, [activeEvent]);

  useEffect(() => {
    if (activeEvent === 'unknown-event') return;

    const checkEventStatus = async () => {
      try {
        let eventEndTime = null;
        if (navigator.onLine) {
          const { data, error } = await supabase
            .from('events')
            .select('end_time')
            .eq('event_id', activeEvent)
            .single();
          if (!error && data) eventEndTime = data.end_time;
        } else {
          const localEvent = await getLocalEvent(activeEvent);
          if (localEvent) eventEndTime = localEvent.end_time;
        }

        if (eventEndTime && new Date() > new Date(eventEndTime)) {
          setIsEventEnded(true);
        }
      } catch (err) {
        console.error('Status check failed', err);
      }
    };

    checkEventStatus();

    if (navigator.onLine) {
      const channel = supabase
        .channel(`public:events:status:${activeEvent}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'events',
            filter: `event_id=eq.${activeEvent}`
          },
          (payload) => {
            if (payload.new?.end_time && new Date() > new Date(payload.new.end_time)) {
              setIsEventEnded(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeEvent, networkStatus]);

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
        const validEntries = {};
        for (const id in parsed) {
          if (now - parsed[id] < COOLDOWN_MS) {
            validEntries[id] = parsed[id];
          }
        }
        scannedIdsRef.current = validEntries;
        localStorage.setItem('scankoto_cooldowns', JSON.stringify(validEntries));
      } catch (error) {}
    }
  }, []);

  const handlePreCache = async () => {
    if (!navigator.onLine) {
      alert('An active internet connection is required to download event data for offline mode.');
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

  const resolveStudentInfo = async (studentIdClean) => {
    try {
      const localStudent = await getLocalStudent(studentIdClean);
      if (localStudent?.full_name && localStudent.qr_hash !== 'anomaly') {
        return { studentName: localStudent.full_name, isAnomaly: false };
      }

      if (navigator.onLine) {
        const { data } = await supabase
          .from('students')
          .select('full_name, qr_hash')
          .eq('student_id', studentIdClean)
          .maybeSingle();

        if (data?.full_name && data.qr_hash !== 'anomaly') {
          return { studentName: data.full_name, isAnomaly: false };
        }
      }
    } catch (err) {}

    return { studentName: 'Unknown Student', isAnomaly: true };
  };

  const resolveMinDuration = async () => {
    try {
      const localEvent = await getLocalEvent(activeEvent);
      if (localEvent?.min_duration_minutes != null) {
        return localEvent.min_duration_minutes;
      }

      if (navigator.onLine) {
        const { data } = await supabase
          .from('events')
          .select('min_duration_minutes')
          .eq('event_id', activeEvent)
          .maybeSingle();

        if (data?.min_duration_minutes != null) {
          return data.min_duration_minutes;
        }
      }
    } catch (err) {}

    return 0;
  };

  const processAttendance = async (scannedStudentId) => {
    if (isEventEnded || isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      triggerBeep();
      setIsScanning(false);

      const now = Date.now();
      const studentIdClean = scannedStudentId.trim();
      const cooldownKey = `${activeEvent}:${studentIdClean}`;

      const lastScanTime = scannedIdsRef.current[cooldownKey] || scannedIdsRef.current[studentIdClean];
      if (lastScanTime && now - lastScanTime < COOLDOWN_MS) {
        const formattedTime = new Date(now).toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric'
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

      scannedIdsRef.current[cooldownKey] = now;
      localStorage.setItem('scankoto_cooldowns', JSON.stringify(scannedIdsRef.current));

      const { studentName, isAnomaly } = await resolveStudentInfo(studentIdClean);

      let existingLog = await getStudentAttendanceRecord(activeEvent, studentIdClean);

      if (!existingLog && navigator.onLine) {
        const { data: cloudRow } = await supabase
          .from('attendance_logs')
          .select('check_in_time, check_out_time, status')
          .eq('event_id', activeEvent)
          .eq('student_id', studentIdClean)
          .maybeSingle();

        if (cloudRow) {
          const hydratedRecord = {
            studentId: studentIdClean,
            studentName,
            eventId: activeEvent,
            timestamp: new Date(cloudRow.check_in_time).getTime(),
            checkInTime: new Date(cloudRow.check_in_time).getTime(),
            checkOutTime: cloudRow.check_out_time ? new Date(cloudRow.check_out_time).getTime() : null,
            status: cloudRow.status || 'Checked-In',
            syncStatus: 'synced'
          };
          const insertedId = await saveAttendanceLog(hydratedRecord);
          existingLog = { ...hydratedRecord, id: insertedId };
        }
      }

      let resultPayload = {};
      const formattedTime = new Date(now).toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: 'numeric'
      });

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
          badgeColor: isAnomaly ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600',
          message: isAnomaly
            ? 'Warning: ID not found on masterlist. Allowed as Anomaly.'
            : 'Initial Check-In Logged'
        };
      } else if (!existingLog.checkOutTime) {
        const checkInTime = existingLog.checkInTime || existingLog.timestamp;
        const elapsedMs = Math.max(0, now - checkInTime);
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const minDurationMinutes = await resolveMinDuration();

        let finalStatus = '';
        let badgeColor = '';
        let message = '';

        if (isAnomaly) {
          finalStatus = 'Anomaly / Checked-Out';
          badgeColor = 'bg-rose-50 text-rose-600';
          message = 'Anomaly Check-Out Logged. Manual review required by host.';
        } else {
          const isValid = elapsedMinutes >= minDurationMinutes;
          finalStatus = isValid ? 'Completed / Valid' : 'Incomplete / Invalid';
          badgeColor = isValid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600';
          message = isValid
            ? `Check-Out Validated (${elapsedMinutes}m / ${minDurationMinutes}m required)`
            : `Early Check-Out (${elapsedMinutes}m / ${minDurationMinutes}m required)`;
        }

        const updatedLog = {
          ...existingLog,
          studentName:
            existingLog.studentName !== 'Unknown Student' ? existingLog.studentName : studentName,
          checkInTime,
          checkOutTime: now,
          durationMinutes: elapsedMinutes,
          status: finalStatus,
          syncStatus: 'pending'
        };

        await updateAttendanceLog(updatedLog);

        resultPayload = {
          type: 'Check-Out',
          studentId: studentIdClean,
          studentName: updatedLog.studentName,
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
          studentName: existingLog.studentName || studentName,
          timestamp: formattedTime,
          status: existingLog.status || 'Completed',
          badgeColor: 'bg-sky-50 text-sky-600',
          message: 'Student has already completed Check-In & Check-Out for this event.'
        };
      }

      await refreshPendingCount();

      if (navigator.onLine) {
        setIsSyncing(true);
        await syncPendingRecords();
        setIsSyncing(false);
        refreshPendingCount();
      }

      setScanResult(resultPayload);
      setIsManualModalOpen(false);
      setManualId('');
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleManualSubmit = () => {
    if (manualId.trim() !== '') {
      processAttendance(manualId.trim());
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    if (!isEventEnded) setIsScanning(true);
  };

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-900">
      <div className="w-full max-w-md bg-white shadow-sm border border-slate-200/90 rounded-3xl p-6 relative overflow-hidden">
        {/* Top Terminal Header */}
        <div className="w-full flex justify-between items-center mb-4">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">SCANKOTO</h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                  networkStatus === 'online'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    networkStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-600'
                  }`}
                />
                {networkStatus.toUpperCase()}
              </span>
            </div>

            {pendingCount > 0 && (
              <div className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  {isSyncing && <span className="loading loading-spinner loading-xs mr-1"></span>}
                  {pendingCount} QUEUED FOR SYNC
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleCamera}
            className="btn btn-sm btn-circle bg-slate-100 hover:bg-slate-200 text-slate-800 border-none"
            title="Switch Camera"
            disabled={!isScanning || isEventEnded}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Offline Roster Cache Status */}
        <div className="w-full mb-4 bg-slate-50 px-3.5 py-2.5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold block text-slate-400">
              Offline Cache
            </span>
            <span className="text-xs font-medium text-slate-700">
              {cachedStudentCount !== null
                ? `${cachedStudentCount} roster records cached`
                : 'Ready to cache session'}
            </span>
          </div>
          <button
            type="button"
            onClick={handlePreCache}
            disabled={isCaching || networkStatus === 'offline' || isEventEnded}
            className="btn btn-xs bg-slate-900 hover:bg-slate-800 text-white border-none rounded-lg font-mono"
          >
            {isCaching ? <span className="loading loading-spinner loading-xs"></span> : 'SYNC CACHE'}
          </button>
        </div>

        {/* Optical Viewfinder Frame */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 relative flex items-center justify-center">
          {/* Optical Corner Reticles */}
          <span className="pointer-events-none absolute top-3 left-3 z-10 w-5 h-5 border-t-2 border-l-2 border-white/75 rounded-tl-xs" />
          <span className="pointer-events-none absolute top-3 right-3 z-10 w-5 h-5 border-t-2 border-r-2 border-white/75 rounded-tr-xs" />
          <span className="pointer-events-none absolute bottom-3 left-3 z-10 w-5 h-5 border-b-2 border-l-2 border-white/75 rounded-bl-xs" />
          <span className="pointer-events-none absolute bottom-3 right-3 z-10 w-5 h-5 border-b-2 border-r-2 border-white/75 rounded-br-xs" />

          {isEventEnded ? (
            <div className="text-white flex flex-col items-center text-center p-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="font-bold text-lg mb-1">Session Locked</h3>
              <p className="text-xs text-slate-400">Scanning has been disabled by the host.</p>
            </div>
          ) : isScanning ? (
            <Scanner
              onScan={(detectedCodes) => {
                let scannedText = null;
                if (Array.isArray(detectedCodes) && detectedCodes.length > 0 && detectedCodes[0].rawValue) {
                  scannedText = detectedCodes[0].rawValue;
                } else if (typeof detectedCodes === 'string') {
                  scannedText = detectedCodes;
                }
                if (scannedText) processAttendance(scannedText);
              }}
              onError={(error) => console.error(error?.message)}
              constraints={{ facingMode }}
              components={{ audio: false, onOff: true, finder: true }}
            />
          ) : (
            <div className="text-slate-300 flex flex-col items-center">
              <span className="loading loading-spinner loading-md mb-2"></span>
              <span className="text-xs font-mono uppercase tracking-wider">Processing Scan...</span>
            </div>
          )}
        </div>

        {/* Manual Fallback Button */}
        <div className="w-full mt-5">
          <button
            type="button"
            className="btn bg-slate-900 hover:bg-slate-800 text-white border-none w-full rounded-xl font-semibold text-sm shadow-2xs"
            onClick={() => setIsManualModalOpen(true)}
            disabled={!isScanning || isEventEnded}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Enter ID Manually
          </button>
        </div>

        <div className="mt-4 text-center">
          <span className="text-[11px] text-slate-400 font-mono">SESSION // {activeEvent}</span>
        </div>
      </div>

      {/* Scan Verification Feedback Modal */}
      <dialog className={`modal modal-bottom sm:modal-middle ${scanResult ? 'modal-open' : ''}`}>
        <div className="modal-box text-center rounded-3xl border border-slate-200 bg-white">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              scanResult?.badgeColor || 'bg-amber-50 text-amber-600'
            }`}
          >
            {scanResult?.isDuplicate ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          {scanResult?.studentName && (
            <h4
              className={`font-semibold text-xs mb-1 ${
                scanResult.studentName === 'Unknown Student' ? 'text-rose-600' : 'text-slate-500'
              }`}
            >
              {scanResult.studentName}
            </h4>
          )}

          <h3 className="font-mono font-extrabold text-2xl text-slate-900 mb-2">
            {scanResult?.studentId}
          </h3>

          <div className="inline-block px-3 py-1 rounded-full font-mono font-semibold text-[11px] mb-3 bg-slate-100 text-slate-800">
            ACTION // <span className="uppercase">{scanResult?.type}</span>
          </div>

          <p className="font-medium text-xs mb-1 text-slate-700 px-4">{scanResult?.message}</p>

          <div className="text-[11px] font-mono text-slate-400 mb-6">
            TIME // {scanResult?.timestamp}
          </div>

          <div className="modal-action mt-0 justify-center">
            <button
              type="button"
              className="btn bg-slate-900 hover:bg-slate-800 text-white border-none btn-wide rounded-xl font-semibold"
              onClick={resetScanner}
            >
              Scan Next
            </button>
          </div>
        </div>
      </dialog>

      {/* Manual Entry Modal */}
      <dialog className={`modal ${isManualModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box rounded-3xl border border-slate-200 bg-white">
          <h3 className="font-bold text-lg text-slate-900">Manual ID Input</h3>
          <p className="py-2 text-xs text-slate-500">
            Enter the Student ID below if the QR code is damaged or unreadable.
          </p>
          <input
            type="text"
            placeholder="e.g. CSU-000001"
            className="input input-bordered w-full my-3 font-mono bg-slate-50 focus:bg-white border-slate-200 text-slate-900 focus:border-slate-900 focus:outline-none rounded-xl"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            autoFocus={isManualModalOpen}
          />
          <div className="modal-action mt-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost text-slate-600 rounded-xl"
              onClick={() => setIsManualModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm bg-slate-900 hover:bg-slate-800 text-white border-none rounded-xl px-5"
              onClick={handleManualSubmit}
            >
              Log Scan
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop bg-slate-900/40">
          <button type="button" onClick={() => setIsManualModalOpen(false)}>
            close
          </button>
        </form>
      </dialog>
    </div>
  );
};

export default AttendanceScanner;