import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-sm border border-slate-200/90 rounded-3xl p-8 relative overflow-hidden">
        {/* Viewfinder Corner Reticles */}
        <span className="pointer-events-none absolute top-3.5 left-3.5 w-3.5 h-3.5 border-t-2 border-l-2 border-slate-900/20 rounded-tl-xs" />
        <span className="pointer-events-none absolute top-3.5 right-3.5 w-3.5 h-3.5 border-t-2 border-r-2 border-slate-900/20 rounded-tr-xs" />
        <span className="pointer-events-none absolute bottom-3.5 left-3.5 w-3.5 h-3.5 border-b-2 border-l-2 border-slate-900/20 rounded-bl-xs" />
        <span className="pointer-events-none absolute bottom-3.5 right-3.5 w-3.5 h-3.5 border-b-2 border-r-2 border-slate-900/20 rounded-br-xs" />

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
            <span className="text-white font-mono font-bold text-lg tracking-tight">SP</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
            OPERATOR ACCESS TERMINAL
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">SCANKOTO Console</h2>
          <p className="text-xs text-slate-500 text-center mt-1">
            Authenticate to manage attendance sessions
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold text-slate-700">Email</span>
            </label>
            <input
              type="email"
              placeholder="admin@csu.edu.ph"
              className="input input-bordered w-full bg-slate-50 focus:bg-white border-slate-200 text-slate-900 text-sm focus:border-slate-900 focus:outline-none rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              className="input input-bordered w-full bg-slate-50 focus:bg-white border-slate-200 text-slate-900 text-sm focus:border-slate-900 focus:outline-none rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn bg-slate-900 hover:bg-slate-800 text-white border-none w-full mt-6 rounded-xl font-semibold text-sm shadow-2xs"
            disabled={isLoading}
          >
            {isLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;