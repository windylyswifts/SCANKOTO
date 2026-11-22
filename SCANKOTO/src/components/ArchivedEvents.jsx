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

  const handleUnarchive = async (eventId) => {
    const { data, error } = await supabase
      .from('events')
      .update({ is_archived: false })
      .eq('event_id', eventId)
      .select();

    if (error) {
      alert('Failed to unarchive event: ' + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert('Action Denied: You do not have permission to modify this event.');
      return;
    }

    setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
    setSelectedEvent(null);
  };

  const handleDelete = async (eventId) => {
    const confirmDelete = window.confirm(
      'Permanently delete this archived event? This cannot be undone.'
    );
    if (!confirmDelete) return;

    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('event_id', eventId)
      .select();

    if (!error && data && data.length > 0) {
      setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
      setSelectedEvent(null);
    } else {
      alert('Delete failed. You may not have permission.');
    }
  };

  const handleExport = async (event) => {
    if (!event?.event_id) return;
    setExporting(true);
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
      alert('Failed to export data.');
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
                    onClick={() => setSelectedEvent(evt)}
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
      <dialog className={`modal ${selectedEvent ? 'modal-open' : ''}`}>
        <div className="modal-box p-0 max-w-lg overflow-hidden bg-white rounded-3xl border border-slate-200 animate-scale-in">
          <div className="bg-slate-900 p-6 text-white relative">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-slate-300 hover:bg-white/10"
              onClick={() => setSelectedEvent(null)}
            >
              ✕
            </button>
            <div className="flex items-center gap-2 mb-2 text-slate-400">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                ARCHIVED RECORD // COLD STORAGE
              </span>
            </div>
            <h2 className="text-xl font-bold pr-8">{selectedEvent?.event_name}</h2>
          </div>

          <div className="p-6">
            <p className="text-xs text-slate-600 mb-6 border-l-2 border-slate-900 pl-3">
              {selectedEvent?.description || 'No specific description attached to this session.'}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                  Date Started
                </span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {selectedEvent && new Date(selectedEvent.start_time).toLocaleDateString()}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                  Render Threshold
                </span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {selectedEvent?.min_duration_minutes} Mins
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                  Expected Roster
                </span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {selectedEvent?.expected_headcount} Users
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                  Session ID
                </span>
                <span className="text-xs font-mono font-bold text-slate-900 truncate block">
                  {selectedEvent?.event_id}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleExport(selectedEvent)}
                disabled={exporting}
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
                  className="btn bg-slate-100 hover:bg-slate-200 active:scale-[0.98] flex-1 border-none text-slate-800 rounded-xl font-semibold text-xs transition-transform"
                >
                  Restore Session
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedEvent.event_id)}
                  className="btn bg-rose-50 hover:bg-rose-600 active:scale-[0.98] border-none text-rose-700 hover:text-white flex-1 rounded-xl font-semibold text-xs transition-all"
                >
                  Purge Record
                </button>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop bg-slate-900/40">
          <button type="button" onClick={() => setSelectedEvent(null)}>
            close
          </button>
        </form>
      </dialog>
    </main>
  );
};

export default ArchivedEvents;