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
    const { error } = await supabase.from('events').update({ is_archived: false }).eq('event_id', eventId);
    if (!error) {
      setEvents(prev => prev.filter(e => e.event_id !== eventId));
      setSelectedEvent(null);
    }
  };

  const handleDelete = async (eventId) => {
    const confirmDelete = window.confirm("Permanently delete this archived event? This cannot be undone.");
    if (!confirmDelete) return;

    const { data, error } = await supabase.from('events').delete().eq('event_id', eventId).select();
    if (!error && data && data.length > 0) {
      setEvents(prev => prev.filter(e => e.event_id !== eventId));
      setSelectedEvent(null);
    } else {
      alert("Delete failed. You may not have permission.");
    }
  };

  const handleExport = async (event) => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('event_id', event.event_id);

      if (error) throw error;

      // Format for the existing export function
      const formattedLogs = data.map(row => ({
        id: row.record_id,
        studentId: row.student_id,
        timestamp: new Date(row.check_in_time).getTime(),
        syncStatus: 'synced (Archived)',
        status: row.status
      }));

      exportToCSV(formattedLogs, event.min_duration_minutes, event.event_name);
    } catch (err) {
      alert("Failed to export data.");
    }
    setExporting(false);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-base-200 p-4 md:p-8 flex flex-col relative w-full pb-24">
      <div className="max-w-4xl mx-auto w-full">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Archived Events</h1>
          <p className="text-sm text-base-content/60 mt-1">Hidden from main dashboard. Click an event to view details, export data, or restore it.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden">
            {events.length === 0 ? (
              <div className="text-center py-16">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-base-content/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                <h3 className="font-semibold text-slate-600">Archive is empty</h3>
              </div>
            ) : (
              <ul className="divide-y divide-base-200">
                {events.map(evt => (
                  <li 
                    key={evt.event_id} 
                    className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => setSelectedEvent(evt)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-base-200 p-3 rounded-xl text-base-content/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{evt.event_name}</h3>
                        <p className="text-xs text-base-content/50 font-mono mt-0.5">ID: {evt.event_id}</p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-slate-500 pr-4">
                      {new Date(evt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </div>

      {/* GUI Modal Details Panel */}
      <dialog className={`modal ${selectedEvent ? 'modal-open' : ''}`}>
        <div className="modal-box p-0 max-w-lg overflow-hidden bg-base-100 rounded-2xl">
          
          {/* Modal Header */}
          <div className="bg-slate-800 p-6 text-white relative">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-white hover:bg-white/20" onClick={() => setSelectedEvent(null)}>✕</button>
            <div className="flex items-center gap-2 mb-2 opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              <span className="text-xs font-bold uppercase tracking-wider">Archived File</span>
            </div>
            <h2 className="text-2xl font-bold pr-8">{selectedEvent?.event_name}</h2>
          </div>

          {/* Modal Body / Info Details */}
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-6 border-l-4 border-slate-300 pl-3">
              {selectedEvent?.description || "No specific description attached to this event."}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-base-200 p-3 rounded-lg">
                <span className="text-xs text-base-content/50 uppercase block font-semibold">Date Started</span>
                <span className="text-sm font-medium">{selectedEvent && new Date(selectedEvent.start_time).toLocaleDateString()}</span>
              </div>
              <div className="bg-base-200 p-3 rounded-lg">
                <span className="text-xs text-base-content/50 uppercase block font-semibold">Target Time</span>
                <span className="text-sm font-medium">{selectedEvent?.min_duration_minutes} Minutes</span>
              </div>
              <div className="bg-base-200 p-3 rounded-lg">
                <span className="text-xs text-base-content/50 uppercase block font-semibold">Headcount Goal</span>
                <span className="text-sm font-medium">{selectedEvent?.expected_headcount} Users</span>
              </div>
              <div className="bg-base-200 p-3 rounded-lg">
                <span className="text-xs text-base-content/50 uppercase block font-semibold">Event ID</span>
                <span className="text-xs font-mono font-medium">{selectedEvent?.event_id}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleExport(selectedEvent)} 
                disabled={exporting}
                className="btn btn-success text-white w-full shadow-sm"
              >
                {exporting ? <span className="loading loading-spinner loading-sm"></span> : (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Export CSV/XLSX Data</>
                )}
              </button>

              <div className="flex gap-3">
                <button 
                  onClick={() => handleUnarchive(selectedEvent.event_id)}
                  className="btn btn-outline flex-1 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg> Unarchive
                </button>
                <button 
                  onClick={() => handleDelete(selectedEvent.event_id)}
                  className="btn btn-outline btn-error flex-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop bg-black/40">
          <button onClick={() => setSelectedEvent(null)}>close</button>
        </form>
      </dialog>

    </main>
  );
};

export default ArchivedEvents;