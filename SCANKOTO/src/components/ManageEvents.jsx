import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { initDB } from '../utils/db';

const ManageEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching events:', error);
      } else if (data) {
        setEvents(data);
      }
      setLoading(false);
    };

    if (user) fetchEvents();
  }, [user]);

  const handleArchive = async (eventId, eventName) => {
    const confirmArchive = window.confirm(
      `Archive "${eventName}"?\n\nThis will remove the event from your main dashboard, but keep all data safe in the Archived section.`
    );
    if (!confirmArchive) return;

    const { data, error } = await supabase
      .from('events')
      .update({ is_archived: true })
      .eq('event_id', eventId)
      .select();

    if (error) {
      alert('Failed to archive event: ' + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert('Action Denied: You do not have permission to modify this event.');
      return;
    }

    setEvents((prev) =>
      prev.map((e) => (e.event_id === eventId ? { ...e, is_archived: true } : e))
    );
    if (localStorage.getItem('scankoto_active_event') === eventId) {
      localStorage.removeItem('scankoto_active_event');
    }
  };

  const handleDelete = async (eventId, eventName) => {
    const confirmDelete = window.confirm(
      `⚠️ WARNING: Are you absolutely sure you want to delete "${eventName}"?\n\n` +
        `This will permanently erase the event, all its attendance logs, and any tracked anomalies. This action cannot be undone.`
    );

    if (!confirmDelete) return;

    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('event_id', eventId)
      .select();

    if (error) {
      alert('Failed to delete event: ' + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert('Action Denied: You do not have permission to delete this event, or it has already been removed.');
      return;
    }

    setEvents((prev) => prev.filter((e) => e.event_id !== eventId));

    try {
      const db = await initDB();
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').delete(eventId);
    } catch (err) {}

    if (localStorage.getItem('scankoto_active_event') === eventId) {
      localStorage.removeItem('scankoto_active_event');
    }
  };

  const activeEvents = events.filter((e) => e.is_archived !== true);
  const filteredEvents = activeEvents.filter(
    (evt) =>
      evt.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.event_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/90 p-4 md:p-8 flex flex-col relative w-full pb-24 text-slate-900">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Sessions</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Audit active sessions, move completed events to archive, or purge records.
            </p>
          </div>

          <input
            type="text"
            placeholder="Filter sessions by title or ID..."
            className="input input-sm input-bordered w-full md:w-72 bg-white border-slate-200 text-slate-800 text-xs focus:border-slate-900 focus:outline-none rounded-xl shadow-2xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg text-slate-900"></span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredEvents.length === 0 && (
              <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <h3 className="text-sm font-mono uppercase tracking-wider font-semibold text-slate-400">
                  No active sessions found
                </h3>
              </div>
            )}

            {filteredEvents.map((evt) => {
              const isEnded = new Date() > new Date(evt.end_time);
              const startDate = new Date(evt.start_time).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={evt.event_id}
                  className="bg-white shadow-2xs border border-slate-200/90 rounded-2xl transition-all hover:border-slate-300 flex flex-col justify-between p-6"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                          isEnded
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isEnded ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                        />
                        {isEnded ? 'ENDED' : 'ACTIVE'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 truncate max-w-[130px]">
                        {evt.event_id}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">
                      {evt.event_name}
                    </h2>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-5">
                      {evt.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="text-xs font-mono text-slate-500">
                      {startDate} · {evt.expected_headcount || 0} PAX
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleArchive(evt.event_id, evt.event_name)}
                        className="btn btn-xs btn-square bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white border-none rounded-lg"
                        title="Archive Session"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(evt.event_id, evt.event_name)}
                        className="btn btn-xs btn-square bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border-none rounded-lg"
                        title="Delete Session"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default ManageEvents;