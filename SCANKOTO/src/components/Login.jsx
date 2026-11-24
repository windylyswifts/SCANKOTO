import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from './BrandLogo';

const MIN_SCAN_DURATION_MS = 550;
const VERIFIED_HOLD_MS = 500;
const REJECTED_RESET_MS = 900;
const MIN_PASSWORD_LENGTH = 8;

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

const Login = () => {
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');

  const [totpCode, setTotpCode] = useState('');
  const [enrollmentData, setEnrollmentData] = useState(null); // { factorId, qrCode, secret }
  const [isPreparingEnrollment, setIsPreparingEnrollment] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const [error, setError] = useState('');
  const [authState, setAuthState] = useState('idle'); // 'idle' | 'scanning' | 'verified' | 'rejected'

  const {
    user,
    mfaStatus,
    totpFactorId,
    isMfaVerified,
    login,
    register,
    startTotpEnrollment,
    verifyTotpCode,
    logout
  } = useAuth();

  const navigate = useNavigate();
  const timerRef = useRef(null);
  const copyTimerRef = useRef(null);
  const enrollmentStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Redirect if already fully verified at aal2
  useEffect(() => {
    if (isMfaVerified && authState === 'idle') {
      navigate('/dashboard', { replace: true });
    }
  }, [isMfaVerified, authState, navigate]);

  // Automatically initialize QR enrollment when an officer signs in without a verified TOTP factor
  useEffect(() => {
    if (!user || mfaStatus !== 'needs-enrollment') {
      enrollmentStartedRef.current = false;
      return;
    }

    if (enrollmentData || enrollmentStartedRef.current) return;
    enrollmentStartedRef.current = true;

    let isMounted = true;
    setIsPreparingEnrollment(true);
    setError('');

    startTotpEnrollment()
      .then((data) => {
        if (isMounted) setEnrollmentData(data);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Unable to initialize 2FA setup. Please try again.');
          enrollmentStartedRef.current = false;
        }
      })
      .finally(() => {
        if (isMounted) setIsPreparingEnrollment(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, mfaStatus, enrollmentData, startTotpEnrollment]);

  const isBusy = authState === 'scanning' || authState === 'verified';
  const reticleClass = RETICLE_STYLES[authState];

  const isChallengeStep = Boolean(user && mfaStatus === 'needs-challenge');
  const isEnrollmentStep = Boolean(user && mfaStatus === 'needs-enrollment');
  const isMfaStep = isChallengeStep || isEnrollmentStep;

  const switchAuthMode = (nextMode) => {
    if (isBusy || authMode === nextMode) return;
    setAuthMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setPendingConfirmationEmail('');
  };

  const getHeaderMeta = () => {
    if (authState === 'scanning') {
      return {
        eyebrow: isMfaStep
          ? 'VERIFYING AUTHENTICATOR TOKEN...'
          : authMode === 'signup'
          ? 'PROVISIONING OPERATOR...'
          : 'SCANNING CREDENTIALS...',
        eyebrowColor: 'text-sky-600',
        title: isEnrollmentStep
          ? 'Configure 2FA'
          : isChallengeStep
          ? 'Two-Factor Check'
          : authMode === 'signup'
          ? 'Create Account'
          : 'SCANKOTO Console',
        subtitle: isMfaStep
          ? 'Validating 6-digit RFC 6238 TOTP code'
          : authMode === 'signup'
          ? 'Registering operator profile & 2FA policy'
          : 'Authenticate to manage attendance sessions'
      };
    }

    if (authState === 'verified') {
      return {
        eyebrow: 'AAL2 ASSURANCE GRANTED',
        eyebrowColor: 'text-emerald-600',
        title: 'Access Granted',
        subtitle: 'Opening attendance telemetry console...'
      };
    }

    if (authState === 'rejected') {
      return {
        eyebrow: 'VERIFICATION FAILED',
        eyebrowColor: 'text-rose-600',
        title: isEnrollmentStep
          ? 'Configure 2FA'
          : isChallengeStep
          ? 'Two-Factor Check'
          : authMode === 'signup'
          ? 'Create Account'
          : 'SCANKOTO Console',
        subtitle: isMfaStep
          ? 'Check device clock sync and re-enter 6-digit code'
          : 'Review credentials and try again'
      };
    }

    if (pendingConfirmationEmail) {
      return {
        eyebrow: 'VERIFICATION EMAIL DISPATCHED',
        eyebrowColor: 'text-emerald-600',
        title: 'Confirm Your Email',
        subtitle: 'Verify your inbox, then sign in to complete 2FA setup'
      };
    }

    if (isEnrollmentStep) {
      return {
        eyebrow: 'SECURITY SETUP // STEP 2 OF 2',
        eyebrowColor: 'text-amber-600',
        title: 'Enroll Authenticator',
        subtitle: 'Scan the QR code with Google Authenticator, Authy, or 1Password'
      };
    }

    if (isChallengeStep) {
      return {
        eyebrow: '2FA CHALLENGE // AAL2 REQUIRED',
        eyebrowColor: 'text-slate-500',
        title: 'Verify Identity',
        subtitle: 'Enter the 6-digit code from your authenticator app'
      };
    }

    if (authMode === 'signup') {
      return {
        eyebrow: 'OPERATOR REGISTRATION // STEP 1 OF 2',
        eyebrowColor: 'text-slate-500',
        title: 'Create Account',
        subtitle: 'Register an operator account (TOTP 2FA required next)'
      };
    }

    return {
      eyebrow: 'OPERATOR ACCESS TERMINAL',
      eyebrowColor: 'text-slate-400',
      title: 'SCANKOTO Console',
      subtitle: 'Authenticate to manage attendance sessions'
    };
  };

  const triggerRejectedState = (message) => {
    setAuthState('rejected');
    setError(message);
    timerRef.current = setTimeout(() => {
      setAuthState('idle');
    }, REJECTED_RESET_MS);
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (isBusy) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setError('');

    const trimmedEmail = email.trim();

    if (authMode === 'signup') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        triggerRejectedState(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        triggerRejectedState('Passwords do not match.');
        return;
      }
    }

    setAuthState('scanning');
    const startedAt = Date.now();

    try {
      if (authMode === 'signup') {
        const signUpResult = await register(trimmedEmail, password);
        const remaining = Math.max(0, MIN_SCAN_DURATION_MS - (Date.now() - startedAt));

        timerRef.current = setTimeout(() => {
          setAuthState('idle');
          setPassword('');
          setConfirmPassword('');

          if (signUpResult.requiresEmailConfirmation) {
            setPendingConfirmationEmail(trimmedEmail);
          } else {
            // Auto-confirmed: AuthContext sets user + mfaStatus='needs-enrollment', revealing QR setup
            setTotpCode('');
          }
        }, remaining);
      } else {
        const mfaResult = await login(trimmedEmail, password);
        const remaining = Math.max(0, MIN_SCAN_DURATION_MS - (Date.now() - startedAt));

        timerRef.current = setTimeout(() => {
          if (mfaResult?.status === 'verified') {
            setAuthState('verified');
            timerRef.current = setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, VERIFIED_HOLD_MS);
          } else {
            setTotpCode('');
            setAuthState('idle');
          }
        }, remaining);
      }
    } catch (err) {
      const remaining = Math.max(0, MIN_SCAN_DURATION_MS - (Date.now() - startedAt));

      timerRef.current = setTimeout(() => {
        triggerRejectedState(
          err.message ||
            (authMode === 'signup'
              ? 'Unable to create account'
              : 'Invalid operator credentials')
        );
      }, remaining);
    }
  };

  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = totpCode.replace(/\D/g, '');
    if (isBusy || cleanCode.length !== 6) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setError('');
    setAuthState('scanning');

    const startedAt = Date.now();
    const activeFactorId = isEnrollmentStep ? enrollmentData?.factorId : totpFactorId;

    try {
      await verifyTotpCode(activeFactorId, cleanCode);
      const remaining = Math.max(0, MIN_SCAN_DURATION_MS - (Date.now() - startedAt));

      timerRef.current = setTimeout(() => {
        setAuthState('verified');
        timerRef.current = setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, VERIFIED_HOLD_MS);
      }, remaining);
    } catch (err) {
      const remaining = Math.max(0, MIN_SCAN_DURATION_MS - (Date.now() - startedAt));

      timerRef.current = setTimeout(() => {
        setTotpCode('');
        triggerRejectedState(err.message || 'Invalid or expired 6-digit authenticator code.');
      }, remaining);
    }
  };

  const handleSwitchAccount = async () => {
    if (isBusy) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setError('');
    setTotpCode('');
    setEnrollmentData(null);
    enrollmentStartedRef.current = false;
    setAuthState('idle');
    await logout();
  };

  const handleCopySecret = async () => {
    if (!enrollmentData?.secret) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(enrollmentData.secret);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = enrollmentData.secret;
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setSecretCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      setError('Unable to copy automatically. Select and copy the setup key manually.');
    }
  };

  const getEmblemContainerStyle = () => {
    if (authState === 'verified') {
      return 'bg-emerald-600 border-emerald-500 shadow-xs';
    }
    if (authState === 'rejected') {
      return 'bg-rose-600 border-rose-500 shadow-xs';
    }
    if (isMfaStep) {
      return 'bg-slate-900 border-slate-800 shadow-xs';
    }
    if (authState === 'scanning') {
      return 'bg-sky-50/70 border-sky-300 shadow-xs';
    }
    return 'bg-gradient-to-b from-white to-slate-50 border-slate-200/90 shadow-xs';
  };

  const meta = getHeaderMeta();

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

        {/* Optical Laser Sweep Overlay */}
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
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 transition-colors duration-300 ${getEmblemContainerStyle()}`}
          >
            {authState === 'verified' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-white animate-scale-in"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : authState === 'rejected' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-white animate-scale-in"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : isMfaStep ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            ) : (
              <BrandLogo className="w-12 h-12" />
            )}
          </div>

          <span
            className={`text-[10px] font-mono font-semibold uppercase tracking-widest mb-1 transition-colors duration-300 ${meta.eyebrowColor}`}
          >
            {meta.eyebrow}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{meta.title}</h2>
          <p className="text-xs text-slate-500 text-center mt-1">{meta.subtitle}</p>
        </div>

        {/* Inline Error Alert */}
        {error && (
          <div className="relative z-20 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3 mb-4 animate-scale-in">
            {error}
          </div>
        )}

        {/* STAGE 1A: Email Confirmation Pending Notice (when Confirm Email is enabled in Supabase) */}
        {!isMfaStep && pendingConfirmationEmail && (
          <div className="relative z-20 space-y-4 animate-panel-enter">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-emerald-900">Verification link sent to:</p>
              <p className="font-mono font-bold text-slate-900 bg-white border border-emerald-200/80 rounded-xl px-3 py-2 truncate">
                {pendingConfirmationEmail}
              </p>
              <p className="text-slate-600 leading-relaxed">
                Click the confirmation link in your email inbox, then sign in below to scan your 2FA authenticator QR code.
              </p>
            </div>

            <button
              type="button"
              onClick={() => switchAuthMode('signin')}
              className="btn border-none w-full rounded-xl font-semibold text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
            >
              Proceed to Sign In
            </button>
          </div>
        )}

        {/* STAGE 1B: Sign In / Create Account Form */}
        {!isMfaStep && !pendingConfirmationEmail && (
          <div className="relative z-20">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 border border-slate-200/80 rounded-xl mb-5">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => switchAuthMode('signin')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  authMode === 'signin'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => switchAuthMode('signup')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  authMode === 'signup'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold text-slate-700">Email</span>
                </label>
                <input
                  type="email"
                  placeholder="officer@csu.edu.ph"
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
                  {authMode === 'signup' && (
                    <span className="text-[10px] font-mono text-slate-400">
                      MIN {MIN_PASSWORD_LENGTH} CHARS
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  minLength={authMode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
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

              {authMode === 'signup' && (
                <div className="form-control animate-panel-enter">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold text-slate-700">
                      Confirm Password
                    </span>
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    className="input input-bordered w-full bg-slate-50 focus:bg-white border-slate-200 text-slate-900 text-sm focus:border-slate-900 focus:outline-none rounded-xl disabled:opacity-70"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError('');
                    }}
                    disabled={isBusy}
                    required
                  />
                </div>
              )}

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
                {authState === 'scanning'
                  ? authMode === 'signup'
                    ? 'Creating Account...'
                    : 'Scanning...'
                  : authState === 'verified'
                  ? 'Access Granted'
                  : authMode === 'signup'
                  ? 'Create Account & Setup 2FA'
                  : 'Continue'}
              </button>
            </form>
          </div>
        )}

        {/* STAGE 2: TOTP Enrollment or Challenge */}
        {isMfaStep && (
          <form onSubmit={handleTotpSubmit} className="space-y-4 relative z-20 animate-panel-enter">
            {/* Active Officer Pill */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-600 truncate">{user?.email}</span>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                AAL1 → AAL2
              </span>
            </div>

            {/* Enrollment QR & Secret Panel */}
            {isEnrollmentStep && (
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
                {isPreparingEnrollment || !enrollmentData ? (
                  <div className="py-8 flex flex-col items-center">
                    <span className="loading loading-spinner loading-md text-slate-900 mb-2"></span>
                    <span className="text-[11px] font-mono text-slate-500">
                      GENERATING TOTP SECRET...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
                      <img
                        src={enrollmentData.qrCode}
                        alt="TOTP Authenticator QR Code"
                        className="w-40 h-40 block"
                      />
                    </div>

                    <div className="w-full">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                        Manual Setup Key
                      </span>
                      <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                        <code className="text-[11px] font-mono font-bold text-slate-800 truncate select-all">
                          {enrollmentData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white transition-colors flex-shrink-0"
                        >
                          {secretCopied ? 'COPIED' : 'COPY'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 6-Digit Authenticator Code Input */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold text-slate-700">
                  {isEnrollmentStep ? 'Confirm 6-Digit Code' : 'Authenticator Code'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">6 DIGITS</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                className="input input-bordered w-full bg-slate-50 focus:bg-white border-slate-200 text-slate-900 font-mono text-center text-xl tracking-[0.45em] font-bold focus:border-slate-900 focus:outline-none rounded-xl disabled:opacity-70"
                value={totpCode}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setTotpCode(digitsOnly);
                  if (error) setError('');
                }}
                disabled={isBusy || (isEnrollmentStep && !enrollmentData)}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={
                isBusy ||
                totpCode.length !== 6 ||
                (isEnrollmentStep && !enrollmentData)
              }
              className={`btn border-none w-full rounded-xl font-semibold text-sm shadow-2xs transition-colors duration-300 text-white ${
                authState === 'verified'
                  ? 'bg-emerald-600 hover:bg-emerald-600'
                  : authState === 'scanning'
                  ? 'bg-slate-800'
                  : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300'
              }`}
            >
              {authState === 'scanning' && (
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping mr-1.5" />
              )}
              {authState === 'scanning'
                ? 'Verifying Token...'
                : authState === 'verified'
                ? 'Access Granted'
                : isEnrollmentStep
                ? 'Activate 2FA & Enter Console'
                : 'Verify & Enter Console'}
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={isBusy}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                ← Sign out or switch officer account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;