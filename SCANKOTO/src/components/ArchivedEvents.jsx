import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV } from '../utils/export';

const ArchivedEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [inspectorError, setInspectorError] = useState('');

  // --- Custom Purge Confirmation Modal State ---
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState('');

  useEffect(() => {
    const fetchArchived = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_archived', true)
        .order('created_at', { ascending: false });

      if (!error && data) setEvents(data);
      setLoading(false);
    };

    if (user) fetchArchived();
  }, [user]);

  // Close active modal layer on Escape key when idle
  useEffect(() => {
    if (!selectedEvent && !purgeTarget) return;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (purgeTarget) {
        if (!isPurging) {
          setPurgeTarget(null);
          setPurgeError('');
        }
        return;
      }
      if (selectedEvent && !exporting && !restoring) {
        setSelectedEvent(null);
        setInspectorError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEvent, purgeTarget, isPurging, exporting, restoring]);

  const openInspector = (evt) => {
    setInspectorError('');
    setSelectedEvent(evt);
  };

  const closeInspector = () => {
    if (exporting || restoring || isPurging) return;
    setSelectedEvent(null);
    setInspectorError('');
  };

  const openPurgeModal = (evt) => {
    setInspectorError('');
    setPurgeError('');
    setPurgeTarget(evt);
  };

  const closePurgeModal = () => {
    if (isPurging) return;
    setPurgeTarget(null);
    setPurgeError('');
  };

  const handleUnarchive = async (eventId) => {
    if (restoring) return;
    setRestoring(true);
    setInspectorError('');

    const { data, error } = await supabase
      .from('events')
      .update({ is_archived: false })
      .eq('event_id', eventId)
      .select();

    setRestoring(false);

    if (error) {
      setInspectorError(`Failed to restore session: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setInspectorError('Action Denied: You do not have permission to restore this session.');
      return;
    }

    setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
    setSelectedEvent(null);
  };

  const handleConfirmPurge = async () => {
    if (!purgeTarget || isPurging) return;

    setIsPurging(true);
    setPurgeError('');

    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('event_id', purgeTarget.event_id)
      .select();

    setIsPurging(false);

    if (error) {
      setPurgeError(`Purge failed: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setPurgeError('Action Denied: You do not have permission to delete this archived record.');
      return;
    }

    setEvents((prev) => prev.filter((e) => e.event_id !== purgeTarget.event_id));
    setPurgeTarget(null);
    setSelectedEvent(null);
  };

  const handleExport = async (event) => {
    if (!event?.event_id || exporting) return;
    setExporting(true);
    setInspectorError('');

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('record_id, student_id, check_in_time, check_out_time, status')
        .eq('event_id', event.event_id);

      if (error) throw error;

      const formattedLogs = (data || []).map((row) => {
        const checkInMs = new Date(row.check_in_time).getTime();
        const checkOutMs = row.check_out_time ? new Date(row.check_out_time).getTime() : null;

        return {
          id: row.record_id,
          studentId: row.student_id,
          timestamp: checkInMs,
          checkInTime: checkInMs,
          checkOutTime: checkOutMs,
          syncStatus: 'synced (Archived)',
          status: row.status
        };
      });

      await exportToCSV(formattedLogs, event.min_duration_minutes, event.event_name);
    } catch (err) {
      console.error('Archived export error:', err);
      setInspectorError(err.message || 'Failed to export archived session report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/90 p-4 md:p-8 flex flex-col relative w-full pb-24 text-slate-900">
      <div className="max-w-4xl mx-auto w-full animate-panel-enter">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Archived Sessions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cold storage for past sessions. Inspect telemetry, export XLSX sheets, or restore to active console.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg text-slate-900"></span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/90 overflow-hidden">
            {events.length === 0 ? (
              <div className="text-center py-16">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-400">
                  Archive repository empty
                </h3>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {events.map((evt) => (
                  <li
                    key={evt.event_id}
                    className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => openInspector(evt)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-100 p-2.5 rounded-xl text-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{evt.event_name}</h3>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          ID // {evt.event_id}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-slate-500 pr-2">
                      {new Date(evt.start_time).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Archived Session Inspector Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
          onClick={closeInspector}
          role="dialog"
          aria-modal="true"
          aria-labelledby="archived-inspector-title"
        >
          <div
            className="w-full max-w-lg overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-6 text-white relative">
              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-slate-300 hover:bg-white/10"
                onClick={closeInspector}
                disabled={exporting || restoring}
              >
                ✕
              </button>
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                  ARCHIVED RECORD // COLD STORAGE
                </span>
              </div>
              <h2 id="archived-inspector-title" className="text-xl font-bold pr-8">
                {selectedEvent.event_name}
              </h2>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-600 mb-6 border-l-2 border-slate-900 pl-3">
                {selectedEvent.description || 'No specific description attached to this session.'}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    Date Started
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {new Date(selectedEvent.start_time).toLocaleDateString()}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    Render Threshold
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {selectedEvent.min_duration_minutes} Mins
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    Expected Roster
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {selectedEvent.expected_headcount} Users
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    Session ID
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900 truncate block">
                    {selectedEvent.event_id}
                  </span>
                </div>
              </div>

              {/* Inline Error Alert for Export / Restore */}
              {inspectorError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3 mb-4 animate-scale-in">
                  {inspectorError}
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => handleExport(selectedEvent)}
                  disabled={exporting || restoring}
                  className="btn bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white border-none w-full rounded-xl font-semibold text-xs transition-transform"
                >
                  {exporting ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export XLSX Report
                    </>
                  )}
                </button>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleUnarchive(selectedEvent.event_id)}
                    disabled={restoring || exporting}
                    className="btn bg-slate-100 hover:bg-slate-200 active:scale-[0.98] flex-1 border-none text-slate-800 rounded-xl font-semibold text-xs transition-transform"
                  >
                    {restoring ? (
                      <>
                        <span className="loading loading-spinner loading-xs mr-1.5"></span>
                        Restoring...
                      </>
                    ) : (
                      'Restore Session'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openPurgeModal(selectedEvent)}
                    disabled={restoring || exporting}
                    className="btn bg-rose-50 hover:bg-rose-600 active:scale-[0.98] border-none text-rose-700 hover:text-white flex-1 rounded-xl font-semibold text-xs transition-all"
                  >
                    Purge Record
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Purge Archived Record Confirmation Modal */}
      {purgeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px] transition-opacity"
          onClick={closePurgeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-archived-title"
        >
          <div
            className={`w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 md:p-7 shadow-2xl relative overflow-hidden animate-scale-in ${
              purgeError ? 'animate-scan-reject border-rose-300' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Optical Viewfinder Corner Reticles */}
            <span className="pointer-events-none absolute top-3.5 left-3.5 w-3.5 h-3.5 border-t-2 border-l-2 border-rose-500/45 rounded-tl-xs" />
            <span className="pointer-events-none absolute top-3.5 right-3.5 w-3.5 h-3.5 border-t-2 border-r-2 border-rose-500/45 rounded-tr-xs" />
            <span className="pointer-events-none absolute bottom-3.5 left-3.5 w-3.5 h-3.5 border-b-2 border-l-2 border-rose-500/45 rounded-bl-xs" />
            <span className="pointer-events-none absolute bottom-3.5 right-3.5 w-3.5 h-3.5 border-b-2 border-r-2 border-rose-500/45 rounded-br-xs" />

            {/* Header */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-600 block">
                  COLD STORAGE // PURGE RECORD
                </span>
                <h2
                  id="purge-archived-title"
                  className="text-lg font-bold text-slate-900 tracking-tight truncate"
                >
                  Purge Archived Session?
                </h2>
              </div>
            </div>

            {/* Target Session Snapshot */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {purgeTarget.event_name}
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex-shrink-0">
                  {purgeTarget.expected_headcount || 0} USERS
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                ID // {purgeTarget.event_id}
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              This will permanently erase{' '}
              <strong className="text-slate-900">{purgeTarget.event_name}</strong> and all
              historical attendance logs from cold storage. This action cannot be undone.
            </p>

            {/* Inline Error Alert */}
            {purgeError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3 mb-4 animate-scale-in">
                {purgeError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closePurgeModal}
                disabled={isPurging}
                className="btn btn-sm btn-ghost text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-xs px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                disabled={isPurging}
                className="btn btn-sm bg-rose-600 hover:bg-rose-700 active:scale-[0.98] disabled:bg-rose-300 text-white border-none rounded-xl font-semibold text-xs px-5 shadow-2xs transition-all gap-1.5"
              >
                {isPurging ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Purging Record...
                  </>
                ) : (
                  'Confirm & Purge'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ArchivedEvents;