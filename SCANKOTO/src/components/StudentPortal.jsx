import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const StudentPortal = () => {
  const { eventId } = useParams();
  const [studentId, setStudentId] = useState('');
  const [eventDetails, setEventDetails] = useState(null);
  const [eventNotFound, setEventNotFound] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('event_id, event_name, min_duration_minutes')
        .eq('event_id', eventId)
        .maybeSingle();

      if (fetchError || !data) {
        setEventNotFound(true);
      } else {
        setEventDetails(data);
      }
    };

    if (eventId) fetchEvent();
  }, [eventId]);

  const checkAttendance = async (e) => {
    e.preventDefault();
    const cleanId = studentId.trim();
    if (!cleanId) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const [{ data: studentData }, { data: logData, error: logError }] = await Promise.all([
        supabase
          .from('students')
          .select('full_name')
          .eq('student_id', cleanId)
          .maybeSingle(),
        supabase
          .from('attendance_logs')
          .select('check_in_time, check_out_time, status')
          .eq('event_id', eventId)
          .eq('student_id', cleanId)
          .maybeSingle()
      ]);

      if (logError) throw logError;

      if (!logData) {
        setError('No attendance record found for this ID yet.');
        return;
      }

      const checkIn = new Date(logData.check_in_time);
      const hasCheckedOut = Boolean(logData.check_out_time);
      const checkOut = hasCheckedOut ? new Date(logData.check_out_time) : null;

      const minutesRendered = hasCheckedOut
        ? Math.max(0, Math.floor((checkOut - checkIn) / 60000))
        : 0;
      const target = eventDetails?.min_duration_minutes || 0;
      const isCleared = hasCheckedOut && minutesRendered >= target;

      setResult({
        studentId: cleanId,
        name: studentData?.full_name || 'Unknown Student',
        checkIn: checkIn.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }),
        checkOut: hasCheckedOut
          ? checkOut.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: 'numeric',
              hour12: true
            })
          : 'Pending Check-Out',
        hasCheckedOut,
        minutesRendered,
        target,
        isCleared
      });
    } catch (err) {
      console.error('Student portal lookup failed:', err);
      setError('An error occurred while fetching your data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-900">
      <div className="w-full max-w-md bg-white shadow-sm border border-slate-200/90 rounded-3xl p-8 relative overflow-hidden">
        {/* Viewfinder Corner Reticles */}
        <span className="pointer-events-none absolute top-3.5 left-3.5 w-3.5 h-3.5 border-t-2 border-l-2 border-slate-900/20 rounded-tl-xs" />
        <span className="pointer-events-none absolute top-3.5 right-3.5 w-3.5 h-3.5 border-t-2 border-r-2 border-slate-900/20 rounded-tr-xs" />
        <span className="pointer-events-none absolute bottom-3.5 left-3.5 w-3.5 h-3.5 border-b-2 border-l-2 border-slate-900/20 rounded-bl-xs" />
        <span className="pointer-events-none absolute bottom-3.5 right-3.5 w-3.5 h-3.5 border-b-2 border-r-2 border-slate-900/20 rounded-br-xs" />

        <div className="text-center mb-6">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-1">
            ATTENDANCE VERIFICATION PORTAL
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {eventNotFound
              ? 'Session Not Found'
              : eventDetails?.event_name || 'Loading Session...'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Verify check-in, check-out, and rendered time</p>
        </div>

        <form onSubmit={checkAttendance} className="space-y-3">
          <input
            type="text"
            placeholder="Enter Student ID (e.g. CSU-000001)"
            className="input input-bordered w-full font-mono text-center bg-slate-50 focus:bg-white border-slate-200 text-slate-900 focus:border-slate-900 focus:outline-none rounded-xl"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={eventNotFound}
            required
          />

          <button
            type="submit"
            className="btn bg-slate-900 hover:bg-slate-800 text-white border-none w-full rounded-xl font-semibold text-sm shadow-2xs"
            disabled={loading || eventNotFound}
          >
            {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Verify Status'}
          </button>
        </form>

        {error && (
          <div className="mt-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
            <p className="text-xs text-rose-700 font-semibold">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-3.5 animate-scale-in">
            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-center">
              <h3 className="font-bold text-base text-slate-900">{result.name}</h3>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{result.studentId}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl text-center">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Time In
                </p>
                <p className="text-xs font-mono font-bold text-slate-900">{result.checkIn}</p>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl text-center">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Time Out
                </p>
                <p className="text-xs font-mono font-bold text-slate-900">{result.checkOut}</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border text-center ${
                result.isCleared
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}
            >
              <p className="text-xs font-mono font-bold uppercase tracking-wider">
                {result.isCleared
                  ? 'CLEARED // COMPLETED'
                  : result.hasCheckedOut
                  ? 'INSUFFICIENT DURATION'
                  : 'PENDING CHECK-OUT'}
              </p>
              <p className="text-3xl font-mono font-extrabold my-2">
                {result.minutesRendered}{' '}
                <span className="text-xs font-semibold opacity-75">MINS</span>
              </p>
              <p className="text-[11px] font-mono opacity-80">
                REQUIRED THRESHOLD: {result.target} MINS
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 my-5"></div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            <strong>OFFLINE SYNC NOTICE:</strong> Field scanners often operate offline. If your record shows as{' '}
            <em>"No Record"</em> or your <em>Time Out is pending</em>, the officer's scanner may not have synced to the cloud yet.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentPortal;