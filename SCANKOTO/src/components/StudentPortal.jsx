import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const StudentPortal = () => {
  const { eventId } = useParams();
  const [studentId, setStudentId] = useState('');
  const [eventDetails, setEventDetails] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch event details on mount to get the event name and minimum required duration
  useEffect(() => {
    const fetchEvent = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('event_id', eventId)
        .single();
      
      if (data) setEventDetails(data);
    };
    fetchEvent();
  }, [eventId]);

  const checkAttendance = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const cleanId = studentId.trim();

      // 1. Optionally fetch the student's name
      const { data: studentData } = await supabase
        .from('students')
        .select('full_name')
        .eq('student_id', cleanId)
        .single();

      // 2. Fetch their specific log for this event
      const { data: logData, error: logError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('event_id', eventId)
        .eq('student_id', cleanId)
        .single();

      if (logError && logError.code !== 'PGRST116') {
        throw logError;
      }

      if (!logData) {
        setError("No attendance record found for this ID yet.");
        setLoading(false);
        return;
      }

      // 3. Calculate time rendered
      const checkIn = new Date(logData.check_in_time);
      // If they haven't checked out yet, check_out_time will be null, so duration is 0
      const checkOut = logData.check_out_time ? new Date(logData.check_out_time) : checkIn;
      
      const minutesRendered = Math.floor((checkOut - checkIn) / 60000);
      const target = eventDetails?.min_duration_minutes || 0;

      setResult({
        name: studentData?.full_name || 'Unknown Student',
        checkIn: checkIn.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }),
        checkOut: logData.check_out_time ? checkOut.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) : 'Pending / Not Checked Out',
        minutesRendered,
        target,
        isCleared: minutesRendered >= target
      });

    } catch (err) {
      console.error(err);
      setError("An error occurred while fetching your data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
      
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
        <div className="card-body p-8">
          
          <div className="text-center mb-6">
            <h2 className="card-title text-2xl font-bold justify-center text-primary mb-1">
              SCANKOTO Portal
            </h2>
            <p className="text-sm font-semibold text-slate-700">
              {eventDetails?.event_name || 'Loading Event...'}
            </p>
            <p className="text-xs text-base-content/60 mt-1">Check your rendered hours</p>
          </div>

          <form onSubmit={checkAttendance} className="space-y-4">
            <div className="form-control">
              <input 
                type="text" 
                placeholder="Enter Student ID (e.g. CSU-000001)" 
                className="input input-bordered w-full font-mono text-center focus:border-primary focus:ring-1 focus:ring-primary" 
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required 
              />
            </div>
            
            <button type="submit" className="btn btn-primary w-full shadow-sm" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Check Status'}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-xl text-center">
              <p className="text-sm text-error font-medium">{error}</p>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="mt-6 space-y-4 animate-scale-in">
              <div className="bg-base-200 p-4 rounded-xl text-center">
                <h3 className="font-bold text-lg text-slate-800">{result.name}</h3>
                <p className="text-xs font-mono text-base-content/60 mt-1">{studentId.trim()}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-base-100 border border-base-200 p-3 rounded-xl text-center shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Time In</p>
                  <p className="text-sm font-bold">{result.checkIn}</p>
                </div>
                <div className="bg-base-100 border border-base-200 p-3 rounded-xl text-center shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Time Out</p>
                  <p className="text-sm font-bold">{result.checkOut}</p>
                </div>
              </div>

              <div className={`p-4 rounded-xl border text-center ${result.isCleared ? 'bg-success/10 border-success/20 text-success' : 'bg-warning/10 border-warning/20 text-warning-content'}`}>
                <p className="text-sm font-bold mb-1">
                  {result.isCleared ? '✅ Cleared / Completed' : '⏳ Incomplete'}
                </p>
                <p className="text-2xl font-black my-2">
                  {result.minutesRendered} <span className="text-sm font-semibold opacity-70">mins</span>
                </p>
                <p className="text-xs font-medium opacity-80">
                  Target requirement: {result.target} mins
                </p>
              </div>
            </div>
          )}

          <div className="divider my-2"></div>
          
          {/* Important Notice */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong>NOTE:</strong> Event scanners often operate entirely offline. If your status shows as <em>"No Record"</em> or your <em>Time Out is missing</em>, the officer's device may not have synced to the cloud yet. Please wait or ask your organization if they have uploaded the final logs.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentPortal;