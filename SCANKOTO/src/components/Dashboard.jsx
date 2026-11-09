import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getAllLogs } from '../utils/db';
import { exportToCSV } from '../utils/export';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  
  // --- Cloud Data State ---
  const [cloudEvents, setCloudEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null); 

  // --- Local Data State ---
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isCopied, setIsCopied] = useState(false);
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

  // Fetch events the logged-in user owns or has access to
  useEffect(() => {
    const loadEventsFromCloud = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching events:", error);
      } else if (data && data.length > 0) {
        setCloudEvents(data);
        setActiveEvent(data[0]); 
      }
    };
    if (user) loadEventsFromCloud();
  }, [user]);

  const loadLogs = async () => {
    try {
      const data = await getAllLogs();
      data.sort((a, b) => b.timestamp - a.timestamp);
      
      setLogs(prevLogs => {
        if (data.length > prevLogs.length && prevLogs.length !== 0) {
          setNotifications(prev => [
            { id: Date.now(), text: 'Live count Updated', time: new Date() },
            ...prev
          ].slice(0, 5));
        }
        return data;
      });
    } catch (error) {
      console.error("Failed to load local logs:", error);
    }
  };

  useEffect(() => {
    loadLogs();
    window.addEventListener('db-updated', loadLogs);
    return () => window.removeEventListener('db-updated', loadLogs);
  }, []);

  // Right Panel Resize Logic (Desktop)
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

  const activeEventId = activeEvent?.event_id || '';
  const activeEventName = activeEvent?.event_name || 'Loading...';
  const expectedCount = activeEvent?.expected_headcount || 0;
  const targetDuration = activeEvent?.min_duration_minutes || 0;
  
  const eventLogs = logs.filter(log => log.eventId === activeEventId);
  const filteredTableLogs = eventLogs.filter(log => 
    log.studentId && log.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalCount = eventLogs.length;

  const handleEmailReport = (emailAddress) => {
    const subject = encodeURIComponent(`Attendance Report: ${activeEventName}`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is the real-time summary for ${activeEventName}:\n\nTotal Headcount: ${totalCount}/${expectedCount}\nPending Server Sync: ${eventLogs.filter(l => l.syncStatus === 'pending').length}\n\n* Note: To view the raw CSV/XLSX spreadsheet, please click the Export button on the dashboard.\n\nBest,\nSCANKOTO System`
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

  return (
    <div className="flex-1 flex overflow-hidden">
      <main className="flex-1 overflow-y-auto bg-base-100 p-4 md:p-8 flex flex-col relative w-full">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Overview</h1>
          <div className="flex items-center gap-2">
            
            {/* Dynamic Event Dropdown */}
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
                        onClick={() => setActiveEvent(evt)} 
                        className={activeEventId === evt.event_id ? "active" : ""}
                      >
                        {evt.event_name}
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Right Panel Toggle Button */}
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

        {/* Top Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card bg-[#f0f4ff] border-none shadow-sm rounded-2xl">
            <div className="card-body p-6">
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Live Count</h2>
              <p className="text-4xl font-bold text-slate-800">{totalCount}<span className="text-2xl text-slate-400">/{expectedCount}</span></p>
            </div>
          </div>
          
          <div 
            className="card bg-[#eef6ff] border-none shadow-sm rounded-2xl cursor-pointer hover:bg-[#e0efff] transition-colors"
            onClick={() => exportToCSV(eventLogs)}
          >
            <div className="card-body p-6">
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Export to <span className="font-bold">XLSX</span></h2>
              <p className="text-slate-500 text-sm">Turn Raw Data To Excel File</p>
            </div>
          </div>
        </div>

        {/* Middle Section: Ledger Table */}
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

        {/* Bottom Cards */}
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
            className={`card border-none shadow-sm rounded-2xl cursor-pointer transition-colors ${activeEventId ? 'bg-[#eef6ff] hover:bg-[#e0efff]' : 'bg-base-200 opacity-50 cursor-not-allowed'}`}
          >
            <div className="card-body p-6 flex flex-col items-center justify-center text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <p className="text-sm font-bold text-primary uppercase tracking-wide">
                {isCopied ? "Link Copied!" : "Copy Scanner Link"}
              </p>
            </div>
          </div>

          <div className="card bg-[#ff0000] border-none shadow-sm rounded-2xl cursor-pointer hover:bg-red-700 transition-colors">
            <div className="card-body p-6 flex items-center justify-center text-center">
              <p className="text-xl font-bold text-white uppercase tracking-wider">Stop Event</p>
            </div>
          </div>
        </div>
      </main>

      {/* MOBILE RIGHT BACKDROP */}
      {isRightPanelOpenMobile && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity" 
          onClick={() => setIsRightPanelOpenMobile(false)}
        />
      )}

      {/* RIGHT SIDEBAR */}
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
                <li key={evt.event_id} className={`text-sm font-medium ${activeEventId === evt.event_id ? 'text-primary' : ''}`}>
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