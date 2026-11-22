import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MIN_SCAN_DURATION_MS = 650;
const VERIFIED_HOLD_MS = 550;
const REJECTED_RESET_MS = 900;

const RETICLE_STYLES = {
  idle: 'border-slate-900/20 scale-100',
  scanning: 'border-sky-500 scale-110',
  verified: 'border-emerald-500 scale-110',
  rejected: 'border-rose-500 scale-105'
};

const CARD_BORDER_STYLES = {
  idle: 'border-slate-200/90 shadow-sm',
  scanning: 'border-sky-400/70 shadow-md shadow-sky-500/5',
  verified: 'border-emerald-400 shadow-md shadow-emerald-500/10',
  rejected: 'border-rose-400 shadow-md shadow-rose-500/10 animate-scan-reject'
};

const STATUS_META = {
  idle: {
    label: 'OPERATOR ACCESS TERMINAL',
    color: 'text-slate-400',
    buttonText: 'Sign In'
  },
  scanning: {
    label: 'SCANNING CREDENTIALS...',
    color: 'text-sky-600',
    buttonText: 'Scanning...'
  },
  verified: {
    label: 'IDENTITY VERIFIED',
    color: 'text-emerald-600',
    buttonText: 'Access Granted'
  },
  rejected: {
    label: 'VERIFICATION FAILED',
    color: 'text-rose-600',
    buttonText: 'Sign In'
  }
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authState, setAuthState] = useState('idle'); // 'idle' | 'scanning' | 'verified' | 'rejected'

  const { login } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isBusy = authState === 'scanning' || authState === 'verified';
  const currentMeta = STATUS_META[authState];
  const reticleClass = RETICLE_STYLES[authState];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isBusy) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setError('');
    setAuthState('scanning');

    const scanStartedAt = Date.now();

    try {
      await login(email, password);

      const elapsed = Date.now() - scanStartedAt;
      const remainingScanTime = Math.max(0, MIN_SCAN_DURATION_MS - elapsed);

      timerRef.current = setTimeout(() => {
        setAuthState('verified');
        timerRef.current = setTimeout(() => {
          navigate('/dashboard');
        }, VERIFIED_HOLD_MS);
      }, remainingScanTime);
    } catch (err) {
      const elapsed = Date.now() - scanStartedAt;
      const remainingScanTime = Math.max(0, MIN_SCAN_DURATION_MS - elapsed);

      timerRef.current = setTimeout(() => {
        setAuthState('rejected');
        setError(err.message || 'Invalid operator credentials');

        timerRef.current = setTimeout(() => {
          setAuthState('idle');
        }, REJECTED_RESET_MS);
      }, remainingScanTime);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md bg-white border rounded-3xl p-8 relative overflow-hidden transition-colors duration-300 ${CARD_BORDER_STYLES[authState]}`}
      >
        {/* Viewfinder Corner Reticles */}
        <span
          className={`pointer-events-none absolute top-3.5 left-3.5 z-20 w-4 h-4 border-t-2 border-l-2 rounded-tl-xs transition-all duration-300 ${reticleClass}`}
        />
        <span
          className={`pointer-events-none absolute top-3.5 right-3.5 z-20 w-4 h-4 border-t-2 border-r-2 rounded-tr-xs transition-all duration-300 ${reticleClass}`}
        />
        <span
          className={`pointer-events-none absolute bottom-3.5 left-3.5 z-20 w-4 h-4 border-b-2 border-l-2 rounded-bl-xs transition-all duration-300 ${reticleClass}`}
        />
        <span
          className={`pointer-events-none absolute bottom-3.5 right-3.5 z-20 w-4 h-4 border-b-2 border-r-2 rounded-br-xs transition-all duration-300 ${reticleClass}`}
        />

        {/* Optical Laser Sweep Overlay (GPU-composited translateY) */}
        {authState === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-3xl">
            <div className="w-full h-full animate-optical-sweep">
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_12px_rgba(14,165,233,0.65)]" />
              <div className="w-full h-10 bg-gradient-to-b from-sky-400/12 to-transparent" />
            </div>
          </div>
        )}

        {/* Outcome Flash Wash */}
        {authState === 'verified' && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-emerald-500/[0.04] transition-opacity duration-300" />
        )}
        {authState === 'rejected' && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-rose-500/[0.04] transition-opacity duration-300" />
        )}

        {/* Header & Emblem */}
        <div className="flex flex-col items-center mb-6 relative z-20">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-xs transition-colors duration-300 ${
              authState === 'verified'
                ? 'bg-emerald-600'
                : authState === 'rejected'
                ? 'bg-rose-600'
                : 'bg-slate-900'
            }`}
          >
            {authState === 'verified' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : authState === 'rejected' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <span className="text-white font-mono font-bold text-lg tracking-tight">SP</span>
            )}
          </div>

          <span
            className={`text-[10px] font-mono font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${currentMeta.color}`}
          >
            {currentMeta.label}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">SCANKOTO Console</h2>
          <p className="text-xs text-slate-500 text-center mt-1">
            Authenticate to manage attendance sessions
          </p>
        </div>

        {/* Inline Error Alert */}
        {error && (
          <div className="relative z-20 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3 mb-4 animate-scale-in">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-20">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold text-slate-700">Email</span>
            </label>
            <input
              type="email"
              placeholder="admin@csu.edu.ph"
              className="input input-bordered w-full bg-slate-50 focus:bg-white border-slate-200 text-slate-900 text-sm focus:border-slate-900 focus:outline-none rounded-xl disabled:opacity-70"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              disabled={isBusy}
              required
            />
          </div>

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold text-slate-700">Password</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="input input-bordered w-full bg-slate-50 focus:bg-white border-slate-200 text-slate-900 text-sm focus:border-slate-900 focus:outline-none rounded-xl disabled:opacity-70"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              disabled={isBusy}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className={`btn border-none w-full mt-6 rounded-xl font-semibold text-sm shadow-2xs transition-colors duration-300 text-white ${
              authState === 'verified'
                ? 'bg-emerald-600 hover:bg-emerald-600'
                : authState === 'scanning'
                ? 'bg-slate-800'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {authState === 'scanning' && (
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping mr-1.5" />
            )}
            {currentMeta.buttonText}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;