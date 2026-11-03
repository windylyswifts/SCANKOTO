import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllLogs } from '../utils/db';
import { exportToCSV } from '../utils/export';

const Dashboard = () => {
  const [logs, setLogs] = useState([]);
  const [activeEvent, setActiveEvent] = useState('General Assembly');
  const [expectedCount] = useState(200); 
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const loadLogs = async () => {
    try {
      const data = await getAllLogs();
      data.sort((a, b) => b.timestamp - a.timestamp);
      
      // Trigger a notification if the count increased (simulating live updates)
      setLogs(prevLogs => {
        if (data.length > prevLogs.length && prevLogs.length !== 0) {
          setNotifications(prev => [
            { id: Date.now(), text: 'Live count Updated', time: new Date() },
            ...prev
          ].slice(0, 5)); // Keep only latest 5
        }
        return data;
      });
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  };

  useEffect(() => {
    loadLogs();
    window.addEventListener('db-updated', loadLogs);
    return () => window.removeEventListener('db-updated', loadLogs);
  }, []);

  const totalCount = logs.length;
  
  // Phase 4 Email Reporting (Fallback to mailto: until Supabase backend is active)
  const handleEmailReport = (emailAddress) => {
    const subject = encodeURIComponent(`Attendance Report: ${activeEvent}`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is the real-time summary for ${activeEvent}:\n\nTotal Headcount: ${totalCount}/${expectedCount}\nPending Server Sync: ${logs.filter(l => l.syncStatus === 'pending').length}\n\n* Note: To view the raw CSV/XLSX spreadsheet, please click the Export button directly on the SCANKOTO dashboard.\n\nBest,\nSCANKOTO System`
    );
    window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex h-screen bg-base-100 font-sans text-base-content overflow-hidden">
      
      {/* LEFT SIDEBAR (Hidden on mobile) */}
      <aside className="w-64 border-r border-base-200 flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-8">
              <span className="text-xs">SP</span>
            </div>
          </div>
          <span className="font-bold tracking-wider">SCANKOTO</span>
        </div>
        
        <div className="px-4 py-2">
          <p className="text-xs text-base-content/50 uppercase font-semibold mb-4 px-2">Dashboards</p>
          <ul className="menu bg-base-100 w-full p-0 gap-1">
            <li>
              <a className="active bg-base-200 text-base-content font-medium rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                Overview
              </a>
            </li>
            <li>
              <a className="hover:bg-base-200 rounded-xl font-medium" onClick={() => navigate('/scan/general-assembly')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Create Event
              </a>
            </li>
          </ul>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-base-100 p-4 md:p-8">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Overview</h1>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm font-semibold uppercase text-xs">
              {activeEvent} <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Live Count Card */}
          <div className="card bg-[#f0f4ff] border-none shadow-sm rounded-2xl">
            <div className="card-body p-6">
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Live Count</h2>
              <p className="text-4xl font-bold text-slate-800">{totalCount}<span className="text-2xl text-slate-400">/{expectedCount}</span></p>
            </div>
          </div>
          
          {/* Export Card */}
          <div 
            className="card bg-[#eef6ff] border-none shadow-sm rounded-2xl cursor-pointer hover:bg-[#e0efff] transition-colors"
            onClick={() => exportToCSV(logs)}
          >
            <div className="card-body p-6">
              <h2 className="text-sm font-semibold text-slate-600 mb-2">Export to <span className="font-bold">XLSX</span></h2>
              <p className="text-slate-500">Turn Raw Data To Excel File</p>
            </div>
          </div>
        </div>

        {/* Middle Section: Total Users / Ledger Table */}
        <div className="card bg-base-50/50 border border-base-200 shadow-sm rounded-2xl mb-8">
          <div className="card-body p-6 overflow-hidden">
            <h2 className="text-sm font-bold mb-4">Total Users</h2>
            
            {/* Ledger Table taking the place of the graph for functional tracking */}
            <div className="overflow-x-auto h-64">
              <table className="table table-sm table-pin-rows">
                <thead>
                  <tr className="bg-base-100">
                    <th>Student ID</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td className="font-mono">{log.studentId}</td>
                      <td className="text-xs">{new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: 'numeric' })}</td>
                      <td>
                        <span className={`w-2 h-2 rounded-full inline-block mr-2 ${log.syncStatus === 'synced' ? 'bg-success' : 'bg-warning'}`}></span>
                        <span className="text-xs opacity-70">{log.syncStatus}</span>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan="3" className="text-center opacity-50 py-8">No records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card bg-[#f0f4ff] border-none shadow-sm rounded-2xl lg:col-span-1">
            <div className="card-body p-6">
              <h2 className="text-xs font-semibold text-slate-600 uppercase mb-2">Event Duration</h2>
              <p className="text-2xl font-bold text-slate-800">12 Hrs left</p>
            </div>
          </div>
          
          <div className="card bg-[#ff0000] border-none shadow-sm rounded-2xl lg:col-span-1 cursor-pointer hover:bg-red-700 transition-colors">
            <div className="card-body p-6 flex items-center justify-center">
              <p className="text-xl font-bold text-white uppercase tracking-wider">Stop Event</p>
            </div>
          </div>
        </div>

      </main>

      {/* RIGHT SIDEBAR (Hidden on smaller screens) */}
      <aside className="w-72 border-l border-base-200 p-6 hidden lg:block overflow-y-auto">
        
        {/* Notifications */}
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
                  <span className="text-sm font-medium">{notif.text}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Activities */}
        <div className="mb-10">
          <h3 className="text-sm font-semibold mb-4 text-base-content/70">Activities</h3>
          <ul className="space-y-4">
            <li className="text-sm font-medium">General Assembly</li>
            <li className="text-sm font-medium">SANGKA</li>
          </ul>
        </div>

        {/* Contacts (Email Reporting Integration) */}
        <div>
          <h3 className="text-sm font-semibold mb-4 text-base-content/70">Contacts</h3>
          <ul className="space-y-4">
            {['iss.secretary@csu.edu.ph', 'president@csu.edu.ph', 'admin@csu.edu.ph'].map((email, idx) => (
              <li 
                key={idx} 
                className="flex items-center gap-3 cursor-pointer hover:bg-base-200 p-2 rounded-lg transition-colors -ml-2"
                onClick={() => handleEmailReport(email)}
                title="Send automated email report"
              >
                <div className="avatar placeholder">
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
  );
};

export default Dashboard;