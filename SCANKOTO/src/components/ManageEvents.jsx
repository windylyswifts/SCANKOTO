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
        console.error("Error fetching events:", error);
      } else if (data) {
        setEvents(data);
      }
      setLoading(false);
    };

    if (user) fetchEvents();
  }, [user]);

  const handleArchive = async (eventId, eventName) => {
    const confirmArchive = window.confirm(`Archive "${eventName}"?\n\nThis will remove the event from your main dashboard, but keep all data safe in the Archived section.`);
    if (!confirmArchive) return;

    const { error } = await supabase.from('events').update({ is_archived: true }).eq('event_id', eventId);
    if (error) {
      alert("Failed to archive event: " + error.message);
      return;
    }
    
    // Remove from local UI state
    setEvents(prev => prev.map(e => e.event_id === eventId ? { ...e, is_archived: true } : e));
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

    const { data, error } = await supabase.from('events').delete().eq('event_id', eventId).select();

    if (error) {
      alert("Failed to delete event: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert("Action Denied: You do not have permission to delete this event, or it has already been removed.");
      return;
    }

    setEvents(prev => prev.filter(e => e.event_id !== eventId));

    try {
      const db = await initDB();
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').delete(eventId);
    } catch (err) {}

    if (localStorage.getItem('scankoto_active_event') === eventId) {
      localStorage.removeItem('scankoto_active_event');
    }
  };

  // Only show active (unarchived) events
  const activeEvents = events.filter(e => e.is_archived !== true);
  const filteredEvents = activeEvents.filter(evt => 
    evt.event_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    evt.event_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex-1 overflow-y-auto bg-base-200 p-4 md:p-8 flex flex-col relative w-full pb-24">
      
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Manage Events</h1>
            <p className="text-sm text-base-content/60 mt-1">Review active events, archive them, or delete old records.</p>
          </div>
          
          <input
            type="text"
            placeholder="Search active events..."
            className="input input-bordered w-full md:w-64 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {!loading && filteredEvents.length === 0 && (
              <div className="col-span-full text-center py-16 bg-base-100 rounded-2xl border border-base-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-700">No active events found</h3>
              </div>
            )}

            {filteredEvents.map(evt => {
              const isEnded = new Date() > new Date(evt.end_time);
              const startDate = new Date(evt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              
              return (
                <div key={evt.event_id} className="card bg-base-100 shadow-sm border border-base-200 transition-shadow hover:shadow-md">
                  <div className="card-body p-6 flex flex-col h-full">
                    
                    <div className="flex justify-between items-start mb-2">
                      <div className={`badge badge-sm font-semibold ${isEnded ? 'bg-base-200 text-base-content/60' : 'bg-success/10 text-success border-success/20'}`}>
                        {isEnded ? 'Ended' : 'Active'}
                      </div>
                      <span className="text-xs font-mono text-base-content/40 truncate max-w-[100px]">{evt.event_id}</span>
                    </div>

                    <h2 className="card-title text-lg font-bold text-slate-800 line-clamp-1 mb-1">{evt.event_name}</h2>
                    <p className="text-sm text-base-content/60 line-clamp-2 flex-grow mb-4">{evt.description || "No description provided."}</p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-base-200">
                      <div className="text-xs font-medium text-slate-500">
                        {startDate}
                      </div>
                      
                      <div className="flex gap-2">
                        {/* NEW: Light Blue Archive Button */}
                        <button 
                          onClick={() => handleArchive(evt.event_id, evt.event_name)}
                          className="btn btn-ghost btn-sm text-[#60a5fa] hover:bg-blue-50"
                          title="Archive Event"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        </button>
                        
                        {/* Red Delete Button */}
                        <button 
                          onClick={() => handleDelete(evt.event_id, evt.event_name)}
                          className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                          title="Delete Event"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
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