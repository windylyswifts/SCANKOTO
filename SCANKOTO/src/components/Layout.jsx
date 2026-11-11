import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeSidebar = () => setIsLeftPanelOpen(false);

  return (
    <div className="flex h-screen bg-base-100 font-sans text-base-content overflow-hidden relative">
      {isLeftPanelOpen && isMobile && (
        <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={closeSidebar} />
      )}
      
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 bg-base-100 border-r border-base-200 flex flex-col flex-shrink-0 w-64 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-primary/10 text-primary rounded-full w-8 flex items-center justify-center font-bold text-xs">SP</div>
          </div>
          <span className="font-bold tracking-wider">SCANKOTO</span>
        </div>
        
        <div className="px-4 py-2 flex-1 overflow-y-auto">
          <p className="text-xs text-base-content/50 uppercase font-semibold mb-4 px-2">Dashboards</p>
          <ul className="menu bg-base-100 w-full p-0 gap-1">
            <li>
              <Link to="/dashboard" onClick={closeSidebar} className={`rounded-xl font-medium ${location.pathname === '/dashboard' ? 'active bg-base-200 text-base-content' : 'hover:bg-base-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                Overview
              </Link>
            </li>
            <li>
              <Link to="/create-event" onClick={closeSidebar} className={`rounded-xl font-medium ${location.pathname === '/create-event' ? 'active bg-base-200 text-base-content' : 'hover:bg-base-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Create Event
              </Link>
            </li>
            <li>
              <Link to="/manage-events" onClick={closeSidebar} className={`rounded-xl font-medium ${location.pathname === '/manage-events' ? 'active bg-base-200 text-base-content' : 'hover:bg-base-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Manage Events
              </Link>
            </li>
            <li>
              <Link to="/archived-events" onClick={closeSidebar} className={`rounded-xl font-medium ${location.pathname === '/archived-events' ? 'active bg-base-200 text-base-content' : 'hover:bg-base-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                Archived
              </Link>
            </li>
          </ul>
        </div>

        <div className="p-4 border-t border-base-200">
           <div className="flex items-center justify-between bg-base-200/50 p-2 rounded-xl">
             <div className="overflow-hidden">
               <p className="text-xs font-semibold text-slate-700 truncate">{user?.email}</p>
             </div>
             <button onClick={logout} className="btn btn-ghost btn-xs btn-circle text-error ml-2" title="Sign Out">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
           </div>
        </div>
      </aside>

      <button className="fixed left-0 top-1/2 -translate-y-1/2 z-30 btn btn-sm btn-primary md:hidden rounded-l-none shadow-xl opacity-90" onClick={() => setIsLeftPanelOpen(true)} style={{ width: '24px', padding: 0 }}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
      </button>

      <Outlet />
    </div>
  );
};

export default Layout;