import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getPendingLogs } from '../utils/db'; 
import { exportToCSV } from '../utils/export';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  // --- Cloud Data State ---
  const [cloudEvents, setCloudEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);

  // --- Master Log State ---
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isPortalCopied, setIsPortalCopied] = useState(false); 
  const [isDragging, setIsDragging] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isRightPanelOpenMobile, setIsRightPanelOpenMobile] = useState(false);
  const [isRightPanelOpenDesktop, setIsRightPanelOpenDesktop] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Fetch accessible events on mount (Exclude Archived)
  useEffect(() => {
    const loadEventsFromCloud = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching events:", error);
      } else if (data && data.length > 0) {
        const activeOnly = data.filter(evt => evt.is_archived !== true);
        setCloudEvents(activeOnly);
        if (activeOnly.length > 0) setActiveEvent(activeOnly[0]);
      }
    };
    if (user) loadEventsFromCloud();
  }, [user]);

  // 2. The Hybrid Fetcher: Merges Cloud Truth with Local Pending Scans
  const loadMergedLogs = async () => {
    if (!activeEvent?.event_id) return;

    try {
      const { data: cloudData, error } = await supabase
        .from('attendance_logs')
        .select('student_id, check_in_time, check_out_time, status')
        .eq('event_id', activeEvent.event_id);

      if (error) throw error;

      const formattedCloudLogs = (cloudData || []).map(row => ({
        id: `cloud-${row.student_id}`, 
        studentId: row.student_id,
        timestamp: new Date(row.check_in_time).getTime(),
        syncStatus: 'synced',
        status: row.status
      }));

      const localPending = await getPendingLogs();
      const eventPending = localPending.filter(log => log.eventId === activeEvent.event_id);

      const pendingIds = new Set(eventPending.map(l => l.studentId));
      const finalCloudLogs = formattedCloudLogs.filter(l => !pendingIds.has(l.studentId));

      const merged = [...finalCloudLogs, ...eventPending];
      merged.sort((a, b) => b.timestamp - a.timestamp); 

      setLogs(prevLogs => {
        if (merged.length > prevLogs.length && prevLogs.length !== 0) {
          setNotifications(prev => [
            { id: Date.now(), text: 'Live count updated from cloud', time: new Date() },
            ...prev
          ].slice(0, 5));
        }
        return merged;
      });

    } catch (err) {
      console.error("Failed to load hybrid logs:", err);
    }
  };

  useEffect(() => {
    loadMergedLogs();
    window.addEventListener('db-updated', loadMergedLogs);
    return () => window.removeEventListener('db-updated', loadMergedLogs);
  }, [activeEvent]);

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
        (payload) => {
          loadMergedLogs(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEvent]);

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

  // --- Event State Handlers ---
  const activeEventId = activeEvent?.event_id || '';
  const activeEventName = activeEvent?.event_name || 'Loading...';
  const expectedCount = activeEvent?.expected_headcount || 0;
  const targetDuration = activeEvent?.min_duration_minutes || 0;
  
  const isEventEnded = activeEvent?.end_time ? new Date() > new Date(activeEvent.end_time) : false;

  const filteredTableLogs = logs.filter(log =>
    log.studentId && log.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalCount = logs.length;

  // --- NEW: Unified Event Selection Handler ---
  const handleEventSelection = (selectedEvent) => {
    if (activeEventId === selectedEvent.event_id) return;
    
    // Set as active
    setActiveEvent(selectedEvent);
    
    // Reorder the array to bump the selected event to the very top
    setCloudEvents(prev => {
      const filtered = prev.filter(evt => evt.event_id !== selectedEvent.event_id);
      return [selectedEvent, ...filtered];
    });

    // Auto-close panel on mobile for better UX
    if (isMobile) setIsRightPanelOpenMobile(false);
  };

  const handleStopEvent = async () => {
    if (!activeEventId || isEventEnded) return;
    
    const confirmStop = window.confirm(`Are you sure you want to STOP "${activeEventName}"?\n\nThis will instantly lock the event and disable all field scanners. Exporting will remain active.`);
    if (!confirmStop) return;

    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('events')
      .update({ end_time: now })
      .eq('event_id', activeEventId);

    if (error) {
      alert("Failed to stop event: " + error.message);
    } else {
      setActiveEvent(prev => ({ ...prev, end_time: now }));
      setCloudEvents(prev => prev.map(evt => evt.event_id === activeEventId ? { ...evt, end_time: now } : evt));
      
      setNotifications(prev => [
        { id: Date.now(), text: `Event forcefully stopped and locked.`, time: new Date() },
        ...prev
      ].slice(0, 5));
    }
  };

  const handleEmailReport = (emailAddress) => {
    const subject = encodeURIComponent(`Attendance Report: ${activeEventName}`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is the real-time summary for ${activeEventName}:\n\nTotal Headcount: ${totalCount}/${expectedCount}\nPending Server Sync: ${logs.filter(l => l.syncStatus === 'pending').length}\n\n* Note: To view the raw CSV/XLSX spreadsheet, please click the Export button on the dashboard.\n\nBest,\nSCANKOTO System`
    );
    window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
  };

  const handleCopyLink = () => {
    if (!activeEventId) return;
    const url = `${window.location.origin}/scan/${activeEventId}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyPortalLink = () => {
    if (!activeEventId) return;
    const url = `${window.location.origin}/portal/${activeEventId}`;
    navigator.clipboard.writeText(url);
    setIsPortalCopied(true);
    setTimeout(() => setIsPortalCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <main className="flex-1 overflow-y-auto bg-base-100 p-4 md:p-8 flex flex-col relative w-full">

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Overview</h1>
          <div className="flex items-center gap-2">

            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-sm font-semibold uppercase text-xs">
                {activeEventName} <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-200 mt-2 max-h-64 overflow-y-auto">
                {cloudEvents.length === 0 ? (
                  <li className="p-2 text-xs opacity-50 text-center">No Events Found</li>
                ) : (
                  cloudEvents.map(evt => (
                    <li key={evt.event_id}>
                      <a
                        onClick={() => handleEventSelection(evt)} // Hooked up the new handler
                        className={activeEventId === evt.event_id ? "active" : ""}
                      >
                        {evt.event_name}
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <button
              onClick={() => {
                if (isMobile) setIsRightPanelOpenMobile(!isRightPanelOpenMobile);
                else setIsRightPanelOpenDesktop(!isRightPanelOpenDesktop);
              }}
              className="btn btn-ghost btn-sm btn-square ml-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="card bg-[#f0f4ff] border-none shadow-sm rounded-2xl">
            <div className="card-body p-6">
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Live Count</h2>
              <p className="text-4xl font-bold text-slate-800">{totalCount}<span className="text-2xl text-slate-400">/{expectedCount}</span></p>
            </div>
          </div>

          <div
            className={`card border-none shadow-sm rounded-2xl transition-colors ${activeEventId ? 'bg-[#fcf0ff] hover:bg-[#f3d9ff] cursor-pointer' : 'bg-base-200 opacity-50 cursor-not-allowed'}`}
            onClick={handleCopyPortalLink}
          >
            <div className="card-body p-6 flex flex-col justify-center">
              <h2 className="text-sm font-semibold text-slate-600 mb-2">
                {isPortalCopied ? <span className="text-primary font-bold">Link Copied!</span> : 'Student Portal'}
              </h2>
              <p className="text-slate-500 text-sm">Copy link for students' rendered hours</p>
            </div>
          </div>

          <div
            className="card bg-[#eef6ff] border-none shadow-sm rounded-2xl cursor-pointer hover:bg-[#e0efff] transition-colors"
            onClick={() => exportToCSV(logs, targetDuration, activeEventName)}
          >
            <div className="card-body p-6">
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Export to <span className="font-bold">XLSX</span></h2>
              <p className="text-slate-500 text-sm">Turn Raw Data To Excel File</p>
            </div>
          </div>
        </div>

        <div className="card bg-base-50/50 border border-base-200 shadow-sm rounded-2xl mb-8 flex-shrink-0">
          <div className="card-body p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold">Total Users</h2>
              <input
                type="text"
                placeholder="Search ID..."
                className="input input-sm input-bordered w-full max-w-xs focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto h-64 border-t border-base-200 pt-2">
              <table className="table table-sm table-pin-rows">
                <thead>
                  <tr className="bg-base-100">
                    <th>Student ID</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTableLogs.map(log => (
                    <tr key={log.id}>
                      <td className="font-mono">{log.studentId}</td>
                      <td className="text-xs">{new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: 'numeric' })}</td>
                      <td>
                        <span className={`w-2 h-2 rounded-full inline-block mr-2 ${log.syncStatus === 'synced' ? 'bg-success' : 'bg-warning'}`}></span>
                        <span className="text-xs opacity-70 capitalize">{log.syncStatus || 'pending'}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredTableLogs.length === 0 && (
                    <tr><td colSpan="3" className="text-center opacity-50 py-8">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-auto">
          <div className="card bg-[#f0f4ff] border-none shadow-sm rounded-2xl">
            <div className="card-body p-6">
              <h2 className="text-xs font-semibold text-slate-600 uppercase mb-2">Target Duration</h2>
              <p className="text-2xl font-bold text-slate-800">
                {targetDuration > 0 ? `${targetDuration} Mins` : 'N/A'}
              </p>
            </div>
          </div>

          <div
            onClick={handleCopyLink}
            className={`card border-none shadow-sm rounded-2xl transition-colors ${activeEventId && !isEventEnded ? 'bg-[#eef6ff] hover:bg-[#e0efff] cursor-pointer' : 'bg-base-200 opacity-50 cursor-not-allowed'}`}
          >
            <div className="card-body p-6 flex flex-col items-center justify-center text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <p className="text-sm font-bold text-primary uppercase tracking-wide">
                {isCopied ? "Link Copied!" : "Copy Scanner Link"}
              </p>
            </div>
          </div>

          <div 
            onClick={handleStopEvent}
            className={`card border-none shadow-sm rounded-2xl transition-colors ${isEventEnded ? 'bg-base-300 cursor-not-allowed' : 'bg-[#ff0000] hover:bg-red-700 cursor-pointer'}`}
          >
            <div className="card-body p-6 flex items-center justify-center text-center">
              <p className={`text-xl font-bold uppercase tracking-wider ${isEventEnded ? 'text-base-content/50' : 'text-white'}`}>
                {isEventEnded ? 'Event Ended' : 'Stop Event'}
              </p>
            </div>
          </div>
        </div>
      </main>

      {isRightPanelOpenMobile && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsRightPanelOpenMobile(false)}
        />
      )}

      <div className={`
        fixed lg:relative inset-y-0 right-0 z-50 bg-base-100 flex-shrink-0 transition-transform duration-300 ease-in-out h-full shadow-2xl lg:shadow-none
        ${isMobile ? (isRightPanelOpenMobile ? 'translate-x-0' : 'translate-x-full') : (isRightPanelOpenDesktop ? 'translate-x-0 flex' : 'hidden')}
      `}
        style={{ width: isMobile ? 288 : rightPanelWidth }}
      >
        {!isMobile && (
          <div
            className="w-1.5 cursor-col-resize hover:bg-primary/50 absolute left-0 top-0 bottom-0 z-10 transition-colors"
            onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
          />
        )}
        <aside className="w-full h-full border-l border-base-200 p-6 overflow-y-auto bg-base-100 pl-8">

          <div className="mb-10">
            <h3 className="text-sm font-semibold mb-4 text-base-content/70">Notifications</h3>
            <ul className="space-y-4">
              {notifications.length === 0 ? (
                <li className="text-xs opacity-50">No new notifications</li>
              ) : (
                notifications.map(notif => (
                  <li key={notif.id} className="flex items-center gap-3">
                    <div className="avatar placeholder">
                      <div className="bg-blue-100 text-blue-600 rounded-full w-8">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                      </div>
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{notif.text}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mb-10">
            <h3 className="text-sm font-semibold mb-4 text-base-content/70">Activities</h3>
            <ul className="space-y-4">
              {cloudEvents.map(evt => (
                <li 
                  key={evt.event_id} 
                  className={`text-sm font-medium cursor-pointer transition-colors hover:text-primary ${activeEventId === evt.event_id ? 'text-primary' : 'text-base-content/80'}`}
                  onClick={() => handleEventSelection(evt)} // Hooked up the new handler
                >
                  {evt.event_name}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-4 text-base-content/70">Contacts</h3>
            <ul className="space-y-4">
              {['iss.secretary@csu.edu.ph', 'president@csu.edu.ph', 'admin@csu.edu.ph'].map((email, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 cursor-pointer hover:bg-base-200 p-2 rounded-lg transition-colors -ml-2"
                  onClick={() => handleEmailReport(email)}
                >
                  <div className="avatar placeholder flex-shrink-0">
                    <div className="bg-orange-100 text-orange-600 rounded-full w-8">
                      <span className="text-xs uppercase">{email[0]}</span>
                    </div>
                  </div>
                  <span className="text-sm font-medium truncate">Gmail Account {idx + 1}</span>
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