import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getPendingLogs } from '../utils/db';
import { exportToCSV } from '../utils/export';
import { useAuth } from '../contexts/AuthContext';

const CONTACTS = [
  { label: 'ISS Secretary', email: 'iss.secretary@csu.edu.ph' },
  { label: 'Organization President', email: 'president@csu.edu.ph' },
  { label: 'System Admin', email: 'admin@csu.edu.ph' }
];

const LOG_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'checked-in', label: 'Checked-In' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending Sync' }
];

const MAX_NOTIFICATIONS = 4;

const formatClockTime = (epochMs) => {
  if (!epochMs) return '—';
  return new Date(epochMs).toLocaleTimeString('en-US', {
    hour12: true,
    hour: 'numeric',
    minute: 'numeric'
  });
};

const getStatusBadgeStyle = (status = '') => {
  const normalized = status.toLowerCase();
  if (normalized.includes('anomaly') || normalized.includes('invalid') || normalized.includes('incomplete')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (normalized.includes('completed') || normalized.includes('valid')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  return 'bg-sky-50 text-sky-700 border-sky-200';
};

const Dashboard = () => {
  const { user } = useAuth();

  // --- Cloud & Event State ---
  const [cloudEvents, setCloudEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);

  // --- Attendance & Activity State ---
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [highlightedStudentId, setHighlightedStudentId] = useState(null);

  // --- UI & Control State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedKey, setCopiedKey] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(296);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isRightPanelOpenMobile, setIsRightPanelOpenMobile] = useState(false);
  const [isRightPanelOpenDesktop, setIsRightPanelOpenDesktop] = useState(true);

  const highlightTimerRef = useRef(null);
  const seededEventIdRef = useRef(null);
  const knownLogStatesRef = useRef(new Map());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // 1. Load non-archived events on mount
  useEffect(() => {
    if (!user) return;

    const loadEventsFromCloud = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      if (data?.length > 0) {
        const activeOnly = data.filter((evt) => evt.is_archived !== true);
        setCloudEvents(activeOnly);
        if (activeOnly.length > 0) setActiveEvent(activeOnly[0]);
      }
    };

    loadEventsFromCloud();
  }, [user]);

  // 2. Hybrid Fetcher: Merges Supabase logs with local IndexedDB pending scans
  const loadMergedLogs = useCallback(async () => {
    const currentEventId = activeEvent?.event_id;
    if (!currentEventId) return;

    try {
      const { data: cloudData, error } = await supabase
        .from('attendance_logs')
        .select('student_id, check_in_time, check_out_time, status')
        .eq('event_id', currentEventId);

      if (error) throw error;

      const formattedCloudLogs = (cloudData || []).map((row) => {
        const checkInMs = new Date(row.check_in_time).getTime();
        const checkOutMs = row.check_out_time ? new Date(row.check_out_time).getTime() : null;

        return {
          id: `cloud-${row.student_id}`,
          studentId: row.student_id,
          timestamp: checkInMs,
          checkInTime: checkInMs,
          checkOutTime: checkOutMs,
          syncStatus: 'synced',
          status: row.status || (checkOutMs ? 'Completed / Valid' : 'Checked-In')
        };
      });

      const localPending = await getPendingLogs();
      const eventPending = localPending.filter((log) => log.eventId === currentEventId);

      const pendingIds = new Set(eventPending.map((l) => l.studentId));
      const finalCloudLogs = formattedCloudLogs.filter((l) => !pendingIds.has(l.studentId));

      const merged = [...finalCloudLogs, ...eventPending];
      merged.sort((a, b) => (b.checkOutTime || b.timestamp) - (a.checkOutTime || a.timestamp));

      // Seed baseline states on initial load of an event so historical rows don't flood the feed
      if (seededEventIdRef.current !== currentEventId) {
        const initialStates = new Map();
        merged.forEach((log) => {
          initialStates.set(log.studentId, log.checkOutTime ? 'checked-out' : 'checked-in');
        });
        knownLogStatesRef.current = initialStates;
        seededEventIdRef.current = currentEventId;
        setLogs(merged);
        return;
      }

      // Detect genuine new check-in / check-out transitions synchronously
      const newlyTriggered = [];
      merged.forEach((log) => {
        const nextPhase = log.checkOutTime ? 'checked-out' : 'checked-in';
        const prevPhase = knownLogStatesRef.current.get(log.studentId);

        if (prevPhase !== nextPhase) {
          knownLogStatesRef.current.set(log.studentId, nextPhase);
          newlyTriggered.push({
            id: `${log.studentId}-${nextPhase}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            studentId: log.studentId,
            text: `${nextPhase === 'checked-out' ? 'Check-out' : 'Check-in'}: ${log.studentId}`,
            time: new Date()
          });
        }
      });

      if (newlyTriggered.length > 0) {
        const latestStudentId = newlyTriggered[0].studentId;
        setHighlightedStudentId(latestStudentId);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => setHighlightedStudentId(null), 1500);

        setNotifications((prev) => [...newlyTriggered, ...prev].slice(0, MAX_NOTIFICATIONS));
      }

      setLogs(merged);
    } catch (err) {
      console.error('Failed to load hybrid logs:', err);
    }
  }, [activeEvent?.event_id]);

  // 3. Subscribe to IndexedDB updates & Supabase Realtime
  useEffect(() => {
    loadMergedLogs();
    window.addEventListener('db-updated', loadMergedLogs);
    return () => window.removeEventListener('db-updated', loadMergedLogs);
  }, [loadMergedLogs]);

  useEffect(() => {
    if (!activeEvent?.event_id) return;

    const channel = supabase
      .channel(`public:attendance_logs:event_id=eq.${activeEvent.event_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_logs',
          filter: `event_id=eq.${activeEvent.event_id}`
        },
        loadMergedLogs
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEvent?.event_id, loadMergedLogs]);

  // 4. Desktop right-panel resize handler
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || isMobile) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 500) {
        setRightPanelWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMobile]);

  // --- Derived Telemetry & Filtered Data ---
  const activeEventId = activeEvent?.event_id || '';
  const activeEventName = activeEvent?.event_name || 'No Active Event';
  const expectedCount = activeEvent?.expected_headcount || 0;
  const targetDuration = activeEvent?.min_duration_minutes || 0;
  const isEventEnded = activeEvent?.end_time ? new Date() > new Date(activeEvent.end_time) : false;

  const telemetry = useMemo(() => {
    const total = logs.length;
    const completed = logs.filter((l) => Boolean(l.checkOutTime)).length;
    const pendingSync = logs.filter((l) => l.syncStatus === 'pending').length;
    const attendanceRate =
      expectedCount > 0 ? Math.min(100, Math.round((total / expectedCount) * 100)) : 0;

    return { total, completed, pendingSync, attendanceRate };
  }, [logs, expectedCount]);

  const filteredTableLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesId = !query || (log.studentId && log.studentId.toLowerCase().includes(query));
      if (!matchesId) return false;

      if (statusFilter === 'checked-in') return !log.checkOutTime;
      if (statusFilter === 'completed') return Boolean(log.checkOutTime);
      if (statusFilter === 'pending') return log.syncStatus === 'pending';
      return true;
    });
  }, [logs, searchQuery, statusFilter]);

  // --- Event & Action Handlers ---
  const handleEventSelection = (selectedEvent) => {
    if (activeEventId === selectedEvent.event_id) return;

    seededEventIdRef.current = null;
    knownLogStatesRef.current = new Map();
    setNotifications([]);
    setActiveEvent(selectedEvent);
    setStatusFilter('all');
    setSearchQuery('');
    setCloudEvents((prev) => [
      selectedEvent,
      ...prev.filter((evt) => evt.event_id !== selectedEvent.event_id)
    ]);

    if (isMobile) setIsRightPanelOpenMobile(false);
  };

  const copyRelativeUrl = (path, key) => {
    if (!activeEventId) return;
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleStopEvent = async () => {
    if (!activeEventId || isEventEnded) return;

    const confirmed = window.confirm(
      `Are you sure you want to STOP "${activeEventName}"?\n\nThis will instantly lock the event and disable all field scanners. Exporting will remain active.`
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('events')
      .update({ end_time: now })
      .eq('event_id', activeEventId);

    if (error) {
      alert('Failed to stop event: ' + error.message);
      return;
    }

    setActiveEvent((prev) => ({ ...prev, end_time: now }));
    setCloudEvents((prev) =>
      prev.map((evt) => (evt.event_id === activeEventId ? { ...evt, end_time: now } : evt))
    );
    setNotifications((prev) =>
      [
        {
          id: `lock-${Date.now()}`,
          text: 'Session stopped & locked',
          time: new Date()
        },
        ...prev
      ].slice(0, MAX_NOTIFICATIONS)
    );
  };

  const handleEmailReport = (emailAddress) => {
    const subject = encodeURIComponent(`Attendance Report: ${activeEventName}`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is the real-time summary for ${activeEventName}:\n\nTotal Headcount: ${telemetry.total}/${expectedCount}\nCompleted Check-Outs: ${telemetry.completed}\nPending Server Sync: ${telemetry.pendingSync}\n\n* Note: To view the raw CSV/XLSX spreadsheet, please click the Export button on the dashboard.\n\nBest,\nSCANKOTO System`
    );
    window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Scanner Telemetry Workspace */}
      <main className="flex-1 overflow-y-auto bg-slate-50/90 p-4 md:p-8 flex flex-col relative w-full text-slate-900">
        {/* Top Command Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Scanner Console</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border transition-colors duration-300 ${
                  !activeEventId
                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                    : isEventEnded
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    !activeEventId
                      ? 'bg-slate-400'
                      : isEventEnded
                      ? 'bg-rose-600'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                {!activeEventId ? 'STANDBY' : isEventEnded ? 'LOCKED' : 'LIVE FEED'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              {activeEventId ? `SESSION // ${activeEventId}` : 'Select or create an event to begin'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Event Selector */}
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-sm bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-800 border border-slate-300 rounded-xl font-semibold text-xs shadow-2xs transition-transform"
              >
                <span className="truncate max-w-[150px] sm:max-w-[210px]">{activeEventName}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 ml-1 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-[20] menu p-1.5 shadow-xl bg-white rounded-2xl w-64 border border-slate-200 mt-2 max-h-64 overflow-y-auto animate-scale-in"
              >
                {cloudEvents.length === 0 ? (
                  <li className="p-3 text-xs text-slate-400 text-center">No Active Events</li>
                ) : (
                  cloudEvents.map((evt) => (
                    <li key={evt.event_id}>
                      <button
                        type="button"
                        onClick={() => handleEventSelection(evt)}
                        className={`rounded-xl text-left text-xs py-2.5 flex items-center justify-between transition-colors ${
                          activeEventId === evt.event_id
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{evt.event_name}</span>
                        {activeEventId === evt.event_id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Primary Export Action */}
            <button
              type="button"
              disabled={!activeEventId}
              onClick={() => exportToCSV(logs, targetDuration, activeEventName)}
              className="btn btn-sm bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:bg-slate-200 text-white border-none rounded-xl font-semibold text-xs shadow-2xs gap-1.5 transition-transform"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export XLSX
            </button>

            {/* Activity Drawer Toggle */}
            <button
              type="button"
              onClick={() => {
                if (isMobile) setIsRightPanelOpenMobile(!isRightPanelOpenMobile);
                else setIsRightPanelOpenDesktop(!isRightPanelOpenDesktop);
              }}
              className="btn btn-sm btn-square bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-300 rounded-xl transition-transform"
              title="Toggle Activity Panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>
        </header>

        {/* Session-Keyed Animated Telemetry & Log Workspace */}
        <div key={activeEventId || 'empty'} className="flex-1 flex flex-col animate-panel-enter">
          {/* Telemetry & Field Links Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
            {/* Optical Telemetry Card (Viewfinder Corner Brackets) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 relative overflow-hidden shadow-2xs flex flex-col justify-between">
              <span className="pointer-events-none absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-slate-900/25 rounded-tl-xs" />
              <span className="pointer-events-none absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-slate-900/25 rounded-tr-xs" />
              <span className="pointer-events-none absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-slate-900/25 rounded-bl-xs" />
              <span className="pointer-events-none absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-slate-900/25 rounded-br-xs" />

              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  Captured Scans
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-600">
                  {telemetry.attendanceRate}% CAPACITY
                </span>
              </div>

              <div className="flex items-baseline gap-2 my-1">
                <span className="text-4xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
                  {telemetry.total}
                </span>
                <span className="text-lg font-mono text-slate-400 tabular-nums">
                  / {expectedCount}
                </span>
              </div>

              {/* Smooth GPU Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-3">
                <div
                  className="h-full bg-slate-900 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${telemetry.attendanceRate}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                <span>OUT: {telemetry.completed}</span>
                <span>REQ: {targetDuration > 0 ? `${targetDuration}M` : 'NONE'}</span>
                <span className={telemetry.pendingSync > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                  {telemetry.pendingSync > 0 ? `${telemetry.pendingSync} QUEUED` : 'CLOUD SYNCED'}
                </span>
              </div>
            </div>

            {/* Field Links & Session Control Stack */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field Scanner Link Card */}
              <button
                type="button"
                disabled={!activeEventId || isEventEnded}
                onClick={() => copyRelativeUrl(`/scan/${activeEventId}`, 'scanner')}
                className={`group text-left rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                  activeEventId && !isEventEnded
                    ? 'bg-white hover:bg-slate-900 hover:text-white active:scale-[0.99] border-slate-200/90 hover:border-slate-900 cursor-pointer shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-55 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="p-2 rounded-xl bg-slate-100 group-hover:bg-white/10 text-slate-800 group-hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </span>
                  <span
                    className={`text-[11px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md transition-colors ${
                      copiedKey === 'scanner'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 group-hover:bg-white/15 text-slate-600 group-hover:text-slate-200'
                    }`}
                  >
                    {copiedKey === 'scanner' ? 'COPIED' : 'COPY URL'}
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight">
                    {copiedKey === 'scanner' ? 'Scanner Link Copied!' : 'Field QR Scanner'}
                  </h2>
                  <p className="text-xs text-slate-500 group-hover:text-slate-300 mt-0.5 transition-colors">
                    Deploy to officer devices for check-in & check-out
                  </p>
                </div>
              </button>

              {/* Student Portal Link Card */}
              <button
                type="button"
                disabled={!activeEventId}
                onClick={() => copyRelativeUrl(`/portal/${activeEventId}`, 'portal')}
                className={`group text-left rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                  activeEventId
                    ? 'bg-white hover:border-slate-400 active:scale-[0.99] border-slate-200/90 cursor-pointer shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-55 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="p-2 rounded-xl bg-slate-100 text-slate-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </span>
                  <span
                    className={`text-[11px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md transition-colors ${
                      copiedKey === 'portal'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {copiedKey === 'portal' ? 'COPIED' : 'PUBLIC'}
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    {copiedKey === 'portal' ? 'Portal Link Copied!' : 'Student Verification Portal'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Self-service lookup for student rendered minutes
                  </p>
                </div>
              </button>

              {/* Session Lock / Stop Event Bar */}
              <div className="sm:col-span-2 bg-white border border-slate-200/90 rounded-2xl px-5 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 block">
                    {isEventEnded ? 'Scanner Session Locked' : 'Session Gate Control'}
                  </span>
                  <span className="text-slate-500">
                    {isEventEnded
                      ? 'Field scanners can no longer submit logs for this event.'
                      : 'Locking immediately disables all active field scanners.'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!activeEventId || isEventEnded}
                  onClick={handleStopEvent}
                  className={`btn btn-xs rounded-lg font-mono uppercase tracking-wider px-3.5 h-8 transition-all ${
                    isEventEnded || !activeEventId
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-rose-50 hover:bg-rose-600 active:scale-95 text-rose-700 hover:text-white border-rose-200 hover:border-rose-600'
                  }`}
                >
                  {isEventEnded ? 'Session Ended' : 'Stop & Lock Event'}
                </button>
              </div>
            </div>
          </section>

          {/* Live Attendance Feed Table */}
          <section className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5 md:p-6 flex-1 flex flex-col min-h-[320px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {LOG_FILTERS.map((filter) => {
                  const isActive = statusFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setStatusFilter(filter.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  placeholder="Filter by Student ID..."
                  className="input input-sm input-bordered w-full bg-slate-50 focus:bg-white border-slate-200 text-slate-800 font-mono text-xs placeholder:font-sans placeholder:text-slate-400 focus:border-slate-900 focus:outline-none rounded-xl pr-8 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto flex-1 border-t border-slate-100">
              <table className="table table-sm table-pin-rows">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-500 font-mono text-[11px] uppercase border-b border-slate-200/80">
                    <th>Student ID</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Status</th>
                    <th>Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTableLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50 border-b border-slate-100/80 transition-colors ${
                        highlightedStudentId === log.studentId ? 'animate-row-flash' : ''
                      }`}
                    >
                      <td className="font-mono font-bold text-slate-900">{log.studentId}</td>
                      <td className="font-mono text-xs text-slate-600">
                        {formatClockTime(log.checkInTime || log.timestamp)}
                      </td>
                      <td className="font-mono text-xs text-slate-600">
                        {formatClockTime(log.checkOutTime)}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeStyle(
                            log.status
                          )}`}
                        >
                          {log.status || 'Checked-In'}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              log.syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {log.syncStatus || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTableLogs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-slate-400 py-12 text-xs font-mono">
                        NO MATCHING SCAN RECORDS
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Mobile Drawer Backdrop */}
      {isRightPanelOpenMobile && isMobile && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40 transition-opacity"
          onClick={() => setIsRightPanelOpenMobile(false)}
        />
      )}

      {/* Resizable Telemetry Activity Sidebar */}
      <div
        className={`
          fixed lg:relative inset-y-0 right-0 z-50 bg-white flex-shrink-0 transition-transform duration-300 ease-out h-full shadow-xl lg:shadow-none
          ${isMobile ? (isRightPanelOpenMobile ? 'translate-x-0' : 'translate-x-full') : isRightPanelOpenDesktop ? 'translate-x-0 flex' : 'hidden'}
        `}
        style={{ width: isMobile ? 296 : rightPanelWidth }}
      >
        {!isMobile && (
          <div
            className="w-1 cursor-col-resize hover:bg-slate-300 absolute left-0 top-0 bottom-0 z-10 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
          />
        )}
        <aside className="w-full h-full border-l border-slate-200 p-6 overflow-y-auto bg-white">
          {/* Fixed-Height Live Feed Container (Prevents Layout Shift) */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Live Feed Events
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {notifications.length}/{MAX_NOTIFICATIONS}
              </span>
            </div>

            <div className="h-[176px] overflow-hidden flex flex-col">
              {notifications.length === 0 ? (
                <div className="h-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-center px-4 text-center">
                  <span className="text-xs text-slate-400">Awaiting scan activity...</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  {notifications.map((notif) => (
                    <li
                      key={notif.id}
                      className="h-[38px] flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-100 px-3 rounded-xl animate-panel-enter"
                    >
                      <span className="font-medium text-slate-700 truncate">{notif.text}</span>
                      <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">
                        {notif.time.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider mb-3 text-slate-400">
              Active Sessions
            </h3>
            <ul className="space-y-1.5">
              {cloudEvents.map((evt) => {
                const isSelected = activeEventId === evt.event_id;
                return (
                  <li key={evt.event_id}>
                    <button
                      type="button"
                      onClick={() => handleEventSelection(evt)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">{evt.event_name}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-2 flex-shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider mb-3 text-slate-400">
              Dispatch Report
            </h3>
            <ul className="space-y-1.5">
              {CONTACTS.map((contact) => (
                <li key={contact.email}>
                  <button
                    type="button"
                    onClick={() => handleEmailReport(contact.email)}
                    className="w-full flex items-center gap-3 hover:bg-slate-50 border border-transparent hover:border-slate-200 p-2 rounded-xl transition-all text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold flex items-center justify-center flex-shrink-0 text-xs uppercase">
                      {contact.label[0]}
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-semibold text-slate-800 block truncate">
                        {contact.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 block truncate">
                        {contact.email}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;