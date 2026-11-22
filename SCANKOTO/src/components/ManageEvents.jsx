import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { initDB } from '../utils/db';

const ManageEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Custom Confirmation Modal State ---
  // modalAction: { type: 'archive' | 'delete', event: object } | null
  const [modalAction, setModalAction] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState('');

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

  // Close modal on Escape key when idle
  useEffect(() => {
    if (!modalAction) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isProcessingAction) {
        setModalAction(null);
        setActionError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalAction, isProcessingAction]);

  const openActionModal = (type, event) => {
    setActionError('');
    setModalAction({ type, event });
  };

  const closeActionModal = () => {
    if (isProcessingAction) return;
    setModalAction(null);
    setActionError('');
  };

  const handleConfirmAction = async () => {
    if (!modalAction || isProcessingAction) return;

    const { type, event } = modalAction;
    const { event_id: eventId } = event;

    setIsProcessingAction(true);
    setActionError('');

    try {
      if (type === 'archive') {
        const { data, error } = await supabase
          .from('events')
          .update({ is_archived: true })
          .eq('event_id', eventId)
          .select();

        if (error) {
          throw new Error(`Failed to archive session: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error('Action Denied: You do not have permission to archive this session.');
        }

        setEvents((prev) =>
          prev.map((e) => (e.event_id === eventId ? { ...e, is_archived: true } : e))
        );
      } else if (type === 'delete') {
        const { data, error } = await supabase
          .from('events')
          .delete()
          .eq('event_id', eventId)
          .select();

        if (error) {
          throw new Error(`Failed to delete session: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error(
            'Action Denied: You do not have permission to delete this session, or it was already removed.'
          );
        }

        setEvents((prev) => prev.filter((e) => e.event_id !== eventId));

        try {
          const db = await initDB();
          const tx = db.transaction('events', 'readwrite');
          tx.objectStore('events').delete(eventId);
        } catch (dbErr) {
          console.warn('Local IndexedDB event cleanup skipped:', dbErr);
        }
      }

      if (localStorage.getItem('scankoto_active_event') === eventId) {
        localStorage.removeItem('scankoto_active_event');
      }

      setModalAction(null);
    } catch (err) {
      setActionError(err.message || 'Unable to complete action. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const activeEvents = events.filter((e) => e.is_archived !== true);
  const filteredEvents = activeEvents.filter(
    (evt) =>
      evt.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.event_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isDeleteModal = modalAction?.type === 'delete';

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/90 p-4 md:p-8 flex flex-col relative w-full pb-24 text-slate-900">
      <div className="max-w-6xl mx-auto w-full animate-panel-enter">
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
            className="input input-sm input-bordered w-full md:w-72 bg-white border-slate-200 text-slate-800 text-xs focus:border-slate-900 focus:outline-none rounded-xl shadow-2xs transition-colors"
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
              <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs animate-scale-in">
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
                  className="bg-white shadow-2xs border border-slate-200/90 rounded-2xl transition-all duration-200 hover:border-slate-300 hover:-translate-y-0.5 flex flex-col justify-between p-6"
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
                        onClick={() => openActionModal('archive', evt)}
                        className="btn btn-xs btn-square bg-slate-100 hover:bg-slate-900 active:scale-95 text-slate-700 hover:text-white border-none rounded-lg transition-all"
                        title="Archive Session"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => openActionModal('delete', evt)}
                        className="btn btn-xs btn-square bg-rose-50 hover:bg-rose-600 active:scale-95 text-rose-600 hover:text-white border-none rounded-lg transition-all"
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

      {/* Custom Archive / Purge Session Confirmation Modal */}
      {modalAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
          onClick={closeActionModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-session-modal-title"
        >
          <div
            className={`w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 md:p-7 shadow-2xl relative overflow-hidden animate-scale-in ${
              actionError ? 'animate-scan-reject border-rose-300' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Optical Viewfinder Corner Reticles */}
            <span
              className={`pointer-events-none absolute top-3.5 left-3.5 w-3.5 h-3.5 border-t-2 border-l-2 rounded-tl-xs ${
                isDeleteModal ? 'border-rose-500/45' : 'border-slate-900/30'
              }`}
            />
            <span
              className={`pointer-events-none absolute top-3.5 right-3.5 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-xs ${
                isDeleteModal ? 'border-rose-500/45' : 'border-slate-900/30'
              }`}
            />
            <span
              className={`pointer-events-none absolute bottom-3.5 left-3.5 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-xs ${
                isDeleteModal ? 'border-rose-500/45' : 'border-slate-900/30'
              }`}
            />
            <span
              className={`pointer-events-none absolute bottom-3.5 right-3.5 w-3.5 h-3.5 border-b-2 border-r-2 rounded-br-xs ${
                isDeleteModal ? 'border-rose-500/45' : 'border-slate-900/30'
              }`}
            />

            {/* Header */}
            <div className="flex items-start gap-3.5 mb-4">
              <div
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center flex-shrink-0 ${
                  isDeleteModal
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                {isDeleteModal ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                )}
              </div>

              <div className="overflow-hidden">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-widest block ${
                    isDeleteModal ? 'text-rose-600' : 'text-slate-500'
                  }`}
                >
                  {isDeleteModal ? 'PURGE RECORD // IRREVERSIBLE' : 'COLD STORAGE // ARCHIVE'}
                </span>
                <h2
                  id="manage-session-modal-title"
                  className="text-lg font-bold text-slate-900 tracking-tight truncate"
                >
                  {isDeleteModal ? 'Permanently Delete Session?' : 'Archive Session?'}
                </h2>
              </div>
            </div>

            {/* Target Session Snapshot */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {modalAction.event.event_name}
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex-shrink-0">
                  {modalAction.event.expected_headcount || 0} PAX
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                ID // {modalAction.event.event_id}
              </p>
            </div>

            {/* Description */}
            {isDeleteModal ? (
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                This will permanently erase{' '}
                <strong className="text-slate-900">{modalAction.event.event_name}</strong>, all
                associated attendance logs, and tracked anomalies. This action cannot be undone.
              </p>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                This will remove{' '}
                <strong className="text-slate-900">{modalAction.event.event_name}</strong> from your
                active scanner console while preserving all attendance records in{' '}
                <span className="font-mono text-[11px] text-slate-800">Archived Sessions</span>.
              </p>
            )}

            {/* Inline Error Alert */}
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3 mb-4 animate-scale-in">
                {actionError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={isProcessingAction}
                className="btn btn-sm btn-ghost text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-xs px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isProcessingAction}
                className={`btn btn-sm active:scale-[0.98] text-white border-none rounded-xl font-semibold text-xs px-5 shadow-2xs transition-all gap-1.5 ${
                  isDeleteModal
                    ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
                    : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300'
                }`}
              >
                {isProcessingAction ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    {isDeleteModal ? 'Purging...' : 'Archiving...'}
                  </>
                ) : isDeleteModal ? (
                  'Confirm & Purge'
                ) : (
                  'Move to Archive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ManageEvents;