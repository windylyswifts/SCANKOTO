import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Scanner Console',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    )
  },
  {
    to: '/create-event',
    label: 'Create Session',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    to: '/manage-events',
    label: 'Manage Sessions',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    )
  },
  {
    to: '/archived-events',
    label: 'Archived',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    )
  }
];

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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isLeftPanelOpen && isMobile && (
        <div
          className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px] z-40 transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Primary Navigation Rail */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 w-64 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${
          isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs tracking-tight shadow-2xs">
            SP
          </div>
          <div>
            <span className="font-bold tracking-wider text-slate-900 block leading-none">
              SCANKOTO
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-1 block">
              TELEMETRY SUITE
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="px-4 py-6 flex-1 overflow-y-auto">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold mb-3 px-3">
            Navigation
          </p>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Operator Account Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl">
            <div className="overflow-hidden">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Operator
              </p>
              <p className="text-xs font-medium text-slate-700 truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn btn-ghost btn-xs btn-square text-slate-500 hover:text-rose-600 hover:bg-rose-50 ml-2 rounded-lg"
              title="Sign Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Trigger */}
      <button
        type="button"
        className="fixed left-0 top-1/2 -translate-y-1/2 z-30 btn btn-sm bg-slate-900 text-white border-none md:hidden rounded-l-none rounded-r-xl shadow-md"
        onClick={() => setIsLeftPanelOpen(true)}
        style={{ width: '28px', padding: 0 }}
        aria-label="Open Navigation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Main Content Outlet */}
      <Outlet />
    </div>
  );
};

export default Layout;