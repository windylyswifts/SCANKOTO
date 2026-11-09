import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error('[AuthContext] Session retrieval error:', error);
        if (isMounted) setUser(session?.user ?? null);
      } catch (err) {
        console.error('[AuthContext] Unexpected Auth Exception:', err);
      } finally {
        // Guaranteed to run, preventing the blank screen lockup
        if (isMounted) setLoading(false);
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading ? children : (
        <div className="min-h-screen bg-base-200 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}
    </AuthContext.Provider>
  );
};