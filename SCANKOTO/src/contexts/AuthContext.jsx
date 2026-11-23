import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [aal, setAal] = useState(null); // 'aal1' | 'aal2' | null
  const [mfaStatus, setMfaStatus] = useState('unauthenticated'); // 'unauthenticated' | 'checking' | 'needs-enrollment' | 'needs-challenge' | 'verified'
  const [totpFactorId, setTotpFactorId] = useState(null);
  const [loading, setLoading] = useState(true);

  const evaluateMfaStatus = useCallback(async (currentUser) => {
    if (!currentUser) {
      setAal(null);
      setTotpFactorId(null);
      setMfaStatus('unauthenticated');
      return { status: 'unauthenticated', factorId: null };
    }

    try {
      const [{ data: aalData, error: aalError }, { data: factorsData, error: factorsError }] =
        await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors()
        ]);

      if (aalError) throw aalError;
      if (factorsError) throw factorsError;

      const verifiedTotp = (factorsData?.totp || []).filter((f) => f.status === 'verified');
      const primaryFactorId = verifiedTotp[0]?.id || null;
      const currentLevel = aalData?.currentLevel || 'aal1';

      setAal(currentLevel);
      setTotpFactorId(primaryFactorId);

      if (currentLevel === 'aal2' && primaryFactorId) {
        setMfaStatus('verified');
        return { status: 'verified', factorId: primaryFactorId };
      }

      if (primaryFactorId) {
        setMfaStatus('needs-challenge');
        return { status: 'needs-challenge', factorId: primaryFactorId };
      }

      setMfaStatus('needs-enrollment');
      return { status: 'needs-enrollment', factorId: null };
    } catch (err) {
      console.error('[AuthContext] MFA evaluation failed:', err);
      // Fail closed to challenge/enrollment rather than granting unverified access
      setAal('aal1');
      setMfaStatus('needs-challenge');
      return { status: 'needs-challenge', factorId: null };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error
        } = await supabase.auth.getSession();

        if (error) console.error('[AuthContext] Session retrieval error:', error);

        const sessionUser = session?.user ?? null;
        if (isMounted) setUser(sessionUser);
        await evaluateMfaStatus(sessionUser);
      } catch (err) {
        console.error('[AuthContext] Unexpected Auth Exception:', err);
        if (isMounted) {
          setUser(null);
          setMfaStatus('unauthenticated');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser) {
        setAal(null);
        setTotpFactorId(null);
        setMfaStatus('unauthenticated');
        setLoading(false);
      } else {
        evaluateMfaStatus(sessionUser).finally(() => {
          if (isMounted) setLoading(false);
        });
      }
    });

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [evaluateMfaStatus]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const signedInUser = data?.user ?? null;
    setUser(signedInUser);
    return await evaluateMfaStatus(signedInUser);
  };

  const startTotpEnrollment = async () => {
    // Clean up any abandoned unverified TOTP factors before generating a fresh secret
    const { data: existingFactors } = await supabase.auth.mfa.listFactors();
    const unverifiedTotp = (existingFactors?.all || []).filter(
      (f) => f.factor_type === 'totp' && f.status !== 'verified'
    );

    for (const stale of unverifiedTotp) {
      await supabase.auth.mfa.unenroll({ factorId: stale.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'SCANKOTO Authenticator'
    });

    if (error) throw error;

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri
    };
  };

  const verifyTotpCode = async (factorId, code) => {
    const sanitizedCode = code.replace(/\s+/g, '');
    const targetFactorId = factorId || totpFactorId;

    if (!targetFactorId) {
      throw new Error('No authenticator factor found. Please reload and try again.');
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: targetFactorId,
      code: sanitizedCode
    });

    if (error) throw error;

    const {
      data: { user: refreshedUser }
    } = await supabase.auth.getUser();
    setUser(refreshedUser ?? user);
    return await evaluateMfaStatus(refreshedUser ?? user);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAal(null);
    setTotpFactorId(null);
    setMfaStatus('unauthenticated');
  };

  const isMfaVerified = Boolean(user && aal === 'aal2' && mfaStatus === 'verified');

  return (
    <AuthContext.Provider
      value={{
        user,
        aal,
        mfaStatus,
        totpFactorId,
        isMfaVerified,
        loading,
        login,
        startTotpEnrollment,
        verifyTotpCode,
        logout
      }}
    >
      {!loading ? (
        children
      ) : (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg text-slate-900"></span>
        </div>
      )}
    </AuthContext.Provider>
  );
};