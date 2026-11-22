import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Console3DIcon = ({ isActive }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 overflow-visible" fill="none">
    <defs>
      <linearGradient id="sk-console-base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isActive ? '#34d399' : '#94a3b8'} />
        <stop offset="100%" stopColor={isActive ? '#059669' : '#475569'} />
      </linearGradient>
      <linearGradient id="sk-console-wedge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isActive ? '#a7f3d0' : '#e2e8f0'} />
        <stop offset="100%" stopColor={isActive ? '#10b981' : '#94a3b8'} />
      </linearGradient>
    </defs>
    {/* Extruded 3D bottom rim */}
    <path
      d="M3.5 13.5C3.5 17.918 7.082 21.5 11.5 21.5C15.918 21.5 19.5 17.918 19.5 13.5V11.8H3.5V13.5Z"
      fill={isActive ? '#065f46' : '#334155'}
    />
    {/* Main top disc */}
    <path
      d="M11.5 4.5C7.082 4.5 3.5 7.858 3.5 12C3.5 16.142 7.082 19.5 11.5 19.5C15.918 19.5 19.5 16.142 19.5 12H11.5V4.5Z"
      fill="url(#sk-console-base)"
    />
    {/* Specular rim highlight */}
    <path
      d="M11.5 4.5C7.082 4.5 3.5 7.858 3.5 12"
      stroke={isActive ? '#a7f3d0' : '#cbd5e1'}
      strokeWidth="0.9"
      strokeLinecap="round"
    />
    {/* Elevated 3D telemetry slice */}
    <path
      d="M13.5 2.5V10H21C21 5.858 17.642 2.5 13.5 2.5Z"
      fill="url(#sk-console-wedge)"
    />
    <path
      d="M13.5 10H21V11.4H13.5V10Z"
      fill={isActive ? '#047857' : '#64748b'}
    />
  </svg>
);

const CreateSession3DIcon = ({ isActive }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 overflow-visible" fill="none">
    <defs>
      <linearGradient id="sk-doc-front" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isActive ? '#f8fafc' : '#e2e8f0'} />
        <stop offset="100%" stopColor={isActive ? '#cbd5e1' : '#94a3b8'} />
      </linearGradient>
      <linearGradient id="sk-doc-badge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isActive ? '#6ee7b7' : '#64748b'} />
        <stop offset="100%" stopColor={isActive ? '#059669' : '#334155'} />
      </linearGradient>
    </defs>
    {/* Back extruded card depth */}
    <rect
      x="6.5"
      y="4"
      width="12"
      height="16"
      rx="2.5"
      fill={isActive ? '#065f46' : '#475569'}
    />
    {/* Front elevated document face */}
    <path
      d="M5 4.5C5 3.395 5.895 2.5 7 2.5H13.2L17 6.3V16.5C17 17.605 16.105 18.5 15 18.5H7C5.895 18.5 5 17.605 5 16.5V4.5Z"
      fill="url(#sk-doc-front)"
    />
    {/* Folded 3D corner */}
    <path
      d="M13.2 2.5V6.3H17L13.2 2.5Z"
      fill={isActive ? '#94a3b8' : '#64748b'}
    />
    {/* Document lines */}
    <rect x="7.5" y="8.5" width="6.5" height="1.4" rx="0.7" fill="#64748b" />
    <rect x="7.5" y="11.5" width="4.5" height="1.4" rx="0.7" fill="#94a3b8" />
    {/* Floating 3D plus cube */}
    <rect
      x="13"
      y="13.8"
      width="7.5"
      height="7.5"
      rx="2"
      fill={isActive ? '#064e3b' : '#1e293b'}
    />
    <rect
      x="13"
      y="12.5"
      width="7.5"
      height="7.5"
      rx="2"
      fill="url(#sk-doc-badge)"
    />
    <path
      d="M16.75 14.4V18.1M14.9 16.25H18.6"
      stroke="#ffffff"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const ManageSessions3DIcon = ({ isActive }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 overflow-visible" fill="none">
    <defs>
      <linearGradient id="sk-stack-top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isActive ? '#6ee7b7' : '#cbd5e1'} />
        <stop offset="100%" stopColor={isActive ? '#10b981' : '#94a3b8'} />
      </linearGradient>
    </defs>
    {/* Bottom isometric plate */}
    <path
      d="M12 14.2L20.5 18L12 21.5L3.5 18L12 14.2Z"
      fill={isActive ? '#065f46' : '#475569'}
    />
    {/* Middle isometric plate */}
    <path
      d="M12 9.5L20.5 13.2L12 16.8L3.5 13.2L12 9.5Z"
      fill={isActive ? '#059669' : '#64748b'}
    />
    {/* Top extruded plate thickness */}
    <path
      d="M3.5 8.2L12 11.8L20.5 8.2V9.5L12 13.1L3.5 9.5V8.2Z"
      fill={isActive ? '#047857' : '#475569'}
    />
    {/* Top lit isometric face */}
    <path
      d="M12 4.5L20.5 8.2L12 11.8L3.5 8.2L12 4.5Z"
      fill="url(#sk-stack-top)"
    />
  </svg>
);

const Archived3DIcon = ({ isActive }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 overflow-visible" fill="none">
    <defs>
      <linearGradient id="sk-box-lid" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={isActive ? '#6ee7b7' : '#e2e8f0'} />
        <stop offset="100%" stopColor={isActive ? '#34d399' : '#94a3b8'} />
      </linearGradient>
    </defs>
    {/* Isometric crate top lid */}
    <path
      d="M12 3.2L20.5 7.2L12 11.2L3.5 7.2L12 3.2Z"
      fill="url(#sk-box-lid)"
    />
    {/* Left shaded crate wall */}
    <path
      d="M3.5 7.2L12 11.2V20.8L3.5 16.8V7.2Z"
      fill={isActive ? '#10b981' : '#64748b'}
    />
    {/* Right deeper shadow crate wall */}
    <path
      d="M20.5 7.2L12 11.2V20.8L20.5 16.8V7.2Z"
      fill={isActive ? '#047857' : '#475569'}
    />
    {/* Lid seam & handle slot */}
    <path
      d="M3.5 9.3L12 13.3L20.5 9.3"
      stroke={isActive ? '#064e3b' : '#334155'}
      strokeWidth="1"
    />
    <path
      d="M6.4 13.2L9.2 14.5"
      stroke={isActive ? '#ecfdf5' : '#e2e8f0'}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Scanner Console',
    renderIcon: (isActive) => <Console3DIcon isActive={isActive} />
  },
  {
    to: '/create-event',
    label: 'Create Session',
    renderIcon: (isActive) => <CreateSession3DIcon isActive={isActive} />
  },
  {
    to: '/manage-events',
    label: 'Manage Sessions',
    renderIcon: (isActive) => <ManageSessions3DIcon isActive={isActive} />
  },
  {
    to: '/archived-events',
    label: 'Archived',
    renderIcon: (isActive) => <Archived3DIcon isActive={isActive} />
  }
];

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsLeftPanelOpen(false);
    };
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
        className={`fixed md:relative inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 w-64 transition-transform duration-300 ease-out shadow-2xl md:shadow-none ${
          isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header with 2.5D Extruded Emblem */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-slate-700 to-slate-950 text-white flex items-center justify-center font-mono font-bold text-xs tracking-tight border-b-2 border-slate-950 shadow-[0_3px_8px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.2)]">
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
          <ul className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={closeSidebar}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-xs transition-all active:scale-[0.99] ${
                      isActive
                        ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 font-medium hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                  >
                    {/* 2.5D Beveled Keycap Tile */}
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:scale-105 ${
                        isActive
                          ? 'bg-gradient-to-b from-slate-700 to-slate-800 border-b-2 border-slate-950 shadow-[0_3px_6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.16)]'
                          : 'bg-gradient-to-b from-white to-slate-100 border border-slate-200/90 border-b-2 border-b-slate-300 shadow-[0_2px_4px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]'
                      }`}
                    >
                      {item.renderIcon(isActive)}
                    </span>
                    <span className="truncate">{item.label}</span>
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
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-b from-white to-slate-100 border border-slate-200 border-b-2 border-b-slate-300 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:border-b-rose-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ml-2 shadow-2xs transition-all flex-shrink-0"
              title="Sign Out"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M6 4.5H13.5V19.5H6C4.895 19.5 4 18.605 4 17.5V6.5C4 5.395 4.895 4.5 6 4.5Z"
                  fill="currentColor"
                  fillOpacity="0.18"
                />
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
                />
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