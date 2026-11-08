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
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
        <div className="card-body p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <span className="text-primary font-bold text-xl">SP</span>
            </div>
            <h2 className="card-title text-2xl font-bold">SCANKOTO Admin</h2>
            <p className="text-sm text-base-content/60 text-center mt-1">Sign in to manage attendance events</p>
          </div>

          {error && (
            <div className="alert alert-error text-sm rounded-xl p-3 mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Email</span></label>
              <input 
                type="email" 
                placeholder="admin@csu.edu.ph" 
                className="input input-bordered focus:border-primary focus:ring-1 focus:ring-primary" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Password</span></label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="input input-bordered focus:border-primary focus:ring-1 focus:ring-primary" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary w-full mt-6 shadow-sm" disabled={isLoading}>
              {isLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;