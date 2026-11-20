import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const DURATION_PRESETS = [
  { label: '30m', hours: 0, minutes: 30 },
  { label: '1h', hours: 1, minutes: 0 },
  { label: '2h', hours: 2, minutes: 0 },
  { label: '3h', hours: 3, minutes: 0 }
];

const SAMPLE_CSV_CONTENT = [
  'id_number,full_name,program,year',
  '231-00101,"Dela Cruz, Juan M.",BSIS,3',
  '231-00102,"Santos, Maria Clara L.",BSIS,3',
  '231-00103,"Reyes, Jose Paolo A.",BSIT,2'
].join('\n');

const splitCsvRow = (row) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
};

const parseCSVToStudentObjects = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const cleanHeaders = splitCsvRow(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const uniqueStudents = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 2) continue;

    const record = {};
    cleanHeaders.forEach((header, index) => {
      record[header] = cols[index] || '';
    });

    const studentId = record.idnumber || record.studentid || '';
    const fullName = record.fullname || record.name || 'Unknown';
    const program = record.program || record.course || 'Unknown';
    const year = record.year || record.yearlevel || 'N/A';

    if (studentId) {
      uniqueStudents.set(studentId, {
        student_id: studentId,
        full_name: fullName,
        year_level: year,
        course: program,
        email: '',
        qr_hash: ''
      });
    }
  }

  return Array.from(uniqueStudents.values());
};

const formatDurationMinutes = (totalMins) => {
  if (!totalMins || totalMins <= 0) return '0m';
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

const CreateEvent = () => {
  const navigate = useNavigate();

  // --- Session Metadata ---
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // --- Clearance Threshold ---
  const [isAttendanceRequired, setIsAttendanceRequired] = useState(true);
  const [renderHours, setRenderHours] = useState(1);
  const [renderMinutes, setRenderMinutes] = useState(0);

  // --- Masterlist Roster ---
  const [masterlistFile, setMasterlistFile] = useState(null);
  const [parsedStudents, setParsedStudents] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);

  // --- Submission & Feedback ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [csvError, setCsvError] = useState('');

  // --- Derived Values ---
  const eventIdSlug = useMemo(() => {
    return eventName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }, [eventName]);

  const scheduleAnalysis = useMemo(() => {
    if (!startTime || !endTime) {
      return { isValid: false, totalMinutes: 0, error: '' };
    }
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return { isValid: false, totalMinutes: 0, error: 'Invalid date format.' };
    }
    if (endMs <= startMs) {
      return { isValid: false, totalMinutes: 0, error: 'End time must be after start time.' };
    }

    const totalMinutes = Math.floor((endMs - startMs) / 60000);
    return { isValid: true, totalMinutes, error: '' };
  }, [startTime, endTime]);

  const requiredMinutes = isAttendanceRequired ? renderHours * 60 + renderMinutes : 0;
  const thresholdExceedsWindow =
    isAttendanceRequired &&
    scheduleAnalysis.isValid &&
    requiredMinutes > scheduleAnalysis.totalMinutes;

  const readiness = {
    details: Boolean(eventName.trim() && eventDescription.trim()),
    schedule: scheduleAnalysis.isValid,
    roster: parsedStudents.length > 0
  };
  const isReadyToLaunch = readiness.details && readiness.schedule && readiness.roster;

  // --- Handlers ---
  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'scankoto_masterlist_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearMasterlist = () => {
    setMasterlistFile(null);
    setParsedStudents([]);
    setCsvError('');
  };

  const processFile = (file) => {
    if (!file) return;
    setCsvError('');
    setFormError('');

    if (!file.name.toLowerCase().endsWith('.csv')) {
      clearMasterlist();
      setCsvError('Invalid format. Please upload a .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const students = parseCSVToStudentObjects(e.target.result || '');

      if (students.length === 0) {
        clearMasterlist();
        setCsvError(
          'No valid records found. Ensure your CSV includes an "id_number" or "student_id" header.'
        );
        return;
      }

      setMasterlistFile(file);
      setParsedStudents(students);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirmEvent = async () => {
    setFormError('');

    if (!eventName.trim() || !eventIdSlug) {
      setFormError('Please enter a valid Session Title.');
      return;
    }
    if (!eventDescription.trim()) {
      setFormError('Please add a brief venue or session description.');
      return;
    }
    if (!startTime || !endTime || !scheduleAnalysis.isValid) {
      setFormError(scheduleAnalysis.error || 'Please configure a valid Start and End time window.');
      return;
    }
    if (parsedStudents.length === 0) {
      setFormError('Please upload a Student Masterlist (.csv) with at least one valid student ID.');
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        setFormError('Authentication expired. Please sign in again before creating a session.');
        setIsSubmitting(false);
        return;
      }

      const newEventConfig = {
        event_id: eventIdSlug,
        event_name: eventName.trim(),
        description: eventDescription.trim(),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        min_duration_minutes: requiredMinutes,
        expected_headcount: parsedStudents.length,
        created_by: userId
      };

      const { error: eventError } = await supabase
        .from('events')
        .upsert([newEventConfig], { onConflict: 'event_id' });

      if (eventError) {
        throw new Error(`Failed to save session: ${eventError.message}`);
      }

      const { error: accessError } = await supabase.from('event_access').upsert(
        {
          event_id: eventIdSlug,
          user_id: userId,
          role: 'owner'
        },
        { onConflict: 'event_id,user_id', ignoreDuplicates: true }
      );

      if (accessError) {
        throw new Error(`Session created, but failed to assign ownership: ${accessError.message}`);
      }

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .upsert(parsedStudents, { onConflict: 'student_id' })
        .select('student_id');

      if (studentError) {
        throw new Error(`Session created, but roster sync failed: ${studentError.message}`);
      }

      if (!insertedStudents || insertedStudents.length === 0) {
        throw new Error(
          'Session created, but Supabase blocked the student roster upload due to a missing RLS policy.'
        );
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('CreateEvent error:', err);
      setFormError(err.message || 'An unexpected error occurred while launching the session.');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full flex justify-center pb-24 bg-slate-50/90 text-slate-900">
      <div className="w-full max-w-4xl space-y-6 animate-panel-enter">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Initialize Session</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Define session parameters, attendance thresholds, and roster masterlist.
            </p>
          </div>
          <span className="text-[11px] font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 self-start sm:self-auto shadow-2xs transition-colors">
            SLUG // {eventIdSlug || 'awaiting-title'}
          </span>
        </header>

        {/* Global Error Banner */}
        {formError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 text-xs font-medium animate-scan-reject">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formError}</span>
          </div>
        )}

        {/* Main Configuration Container */}
        <div className="bg-white shadow-2xs border border-slate-200/90 rounded-3xl overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">
            {/* Step 1: Session Identity */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                  01 // Session Identity
                </span>
                {readiness.details && (
                  <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md animate-scale-in">
                    READY
                  </span>
                )}
              </div>

              <input
                type="text"
                className="w-full text-2xl md:text-3xl font-extrabold focus:outline-none bg-transparent placeholder:text-slate-300 text-slate-900 tracking-tight"
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="Enter session title (e.g. ISS General Assembly)..."
              />
              <textarea
                className="w-full text-sm focus:outline-none bg-slate-50/70 focus:bg-white border border-slate-200/80 focus:border-slate-900 rounded-2xl p-3.5 placeholder:text-slate-400 text-slate-700 resize-none h-20 transition-colors"
                value={eventDescription}
                onChange={(e) => {
                  setEventDescription(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="Venue location, organizer notes, or check-in instructions..."
              />
            </section>

            <div className="border-t border-slate-100" />

            {/* Step 2 & 3: Schedule & Thresholds */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Step 2: Time Window */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    02 // Active Time Window
                  </span>
                  {scheduleAnalysis.isValid && (
                    <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md animate-scale-in">
                      SPAN: {formatDurationMinutes(scheduleAnalysis.totalMinutes)}
                    </span>
                  )}
                </div>

                <div className="space-y-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                  <div className="form-control w-full">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold text-slate-700">Starts At</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="input input-sm h-10 input-bordered w-full bg-white border-slate-200 text-slate-900 text-xs font-mono focus:border-slate-900 focus:outline-none rounded-xl transition-colors"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        if (formError) setFormError('');
                      }}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold text-slate-700">Ends At</span>
                    </label>
                    <input
                      type="datetime-local"
                      min={startTime || undefined}
                      className={`input input-sm h-10 input-bordered w-full bg-white text-slate-900 text-xs font-mono focus:outline-none rounded-xl transition-colors ${
                        scheduleAnalysis.error
                          ? 'border-rose-400 focus:border-rose-600'
                          : 'border-slate-200 focus:border-slate-900'
                      }`}
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        if (formError) setFormError('');
                      }}
                    />
                  </div>

                  {scheduleAnalysis.error && (
                    <p className="text-[11px] font-medium text-rose-600 animate-scale-in">
                      {scheduleAnalysis.error}
                    </p>
                  )}
                </div>
              </section>

              {/* Step 3: Clearance Threshold (Inline Controls + Presets) */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    03 // Clearance Threshold
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    {isAttendanceRequired ? `REQ: ${formatDurationMinutes(requiredMinutes)}` : 'NO MIN'}
                  </span>
                </div>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Enforce Minimum Render Duration
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Require minimum stay between check-in & check-out
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-sm checked:bg-slate-900 checked:border-slate-900"
                      checked={isAttendanceRequired}
                      onChange={(e) => setIsAttendanceRequired(e.target.checked)}
                    />
                  </label>

                  {isAttendanceRequired && (
                    <div className="pt-3 border-t border-slate-200/80 space-y-3 animate-panel-enter">
                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">
                          Presets:
                        </span>
                        {DURATION_PRESETS.map((preset) => {
                          const isSelected =
                            renderHours === preset.hours && renderMinutes === preset.minutes;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setRenderHours(preset.hours);
                                setRenderMinutes(preset.minutes);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-95 ${
                                isSelected
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Inline Hours & Minutes Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-slate-500">
                            HOURS
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="24"
                            className="w-16 text-right font-mono font-bold text-sm text-slate-900 focus:outline-none"
                            value={renderHours}
                            onChange={(e) =>
                              setRenderHours(Math.max(0, Math.min(24, Number(e.target.value))))
                            }
                          />
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-slate-500">
                            MINS
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            className="w-16 text-right font-mono font-bold text-sm text-slate-900 focus:outline-none"
                            value={renderMinutes}
                            onChange={(e) =>
                              setRenderMinutes(Math.max(0, Math.min(59, Number(e.target.value))))
                            }
                          />
                        </div>
                      </div>

                      {thresholdExceedsWindow && (
                        <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 animate-scale-in">
                          Note: Required threshold ({formatDurationMinutes(requiredMinutes)}) is longer than the scheduled session window ({formatDurationMinutes(scheduleAnalysis.totalMinutes)}).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="border-t border-slate-100" />

            {/* Step 4: Student Masterlist Upload & Preview */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                  04 // Masterlist Roster (.csv)
                </span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="text-[11px] font-mono font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2"
                >
                  Download CSV Template
                </button>
              </div>

              {!masterlistFile ? (
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isDragActive
                      ? 'border-slate-900 bg-slate-100 scale-[1.01]'
                      : 'border-slate-300 bg-slate-50/70 hover:bg-slate-100/70'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragActive(false);
                  }}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".csv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                  />

                  <div className="bg-white p-3 rounded-xl shadow-2xs border border-slate-200 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>

                  <p className="text-xs text-slate-600">
                    <span className="text-slate-900 font-bold">Choose a .csv masterlist</span> or drag and drop here
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    COLUMNS // id_number, full_name, program, year
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-panel-enter">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 font-mono font-bold text-xs">
                        CSV
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-mono font-bold text-slate-900 truncate">
                          {masterlistFile.name}
                        </p>
                        <p className="text-[11px] font-mono text-emerald-700 font-semibold">
                          {parsedStudents.length} UNIQUE STUDENTS READY
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearMasterlist}
                      className="btn btn-xs bg-white hover:bg-rose-50 active:scale-95 text-slate-600 hover:text-rose-700 border-slate-200 hover:border-rose-200 rounded-lg font-mono transition-transform"
                    >
                      Replace
                    </button>
                  </div>

                  {/* Roster Preview Table */}
                  <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
                    <table className="table table-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-mono text-[10px]">
                          <th>Student ID</th>
                          <th>Full Name</th>
                          <th>Program / Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedStudents.slice(0, 4).map((student) => (
                          <tr key={student.student_id} className="border-b border-slate-100 last:border-none">
                            <td className="font-mono font-semibold text-slate-900">
                              {student.student_id}
                            </td>
                            <td className="text-slate-700">{student.full_name}</td>
                            <td className="font-mono text-slate-500">
                              {student.course} · {student.year_level}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedStudents.length > 4 && (
                      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] font-mono text-slate-400 text-center">
                        + {parsedStudents.length - 4} MORE RECORDS IN ROSTER
                      </div>
                    )}
                  </div>
                </div>
              )}

              {csvError && (
                <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 animate-scan-reject">
                  {csvError}
                </p>
              )}
            </section>
          </div>

          {/* Readiness Checklist & Action Footer */}
          <div className="bg-slate-50 px-6 py-4 md:px-8 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
              <span className={`transition-colors ${readiness.details ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {readiness.details ? '✓' : '○'} Details
              </span>
              <span className={`transition-colors ${readiness.schedule ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {readiness.schedule ? '✓' : '○'} Schedule
              </span>
              <span className={`transition-colors ${readiness.roster ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {readiness.roster ? '✓' : '○'} Roster ({parsedStudents.length})
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                className="btn btn-sm btn-ghost text-slate-600 hover:bg-slate-200/60 rounded-xl"
                onClick={() => navigate('/dashboard')}
                disabled={isSubmitting}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn btn-sm bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:bg-slate-200 text-white border-none px-6 h-10 rounded-xl font-semibold shadow-2xs transition-transform"
                onClick={handleConfirmEvent}
                disabled={isSubmitting || !isReadyToLaunch}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-xs mr-1.5"></span>
                    Syncing Roster...
                  </>
                ) : (
                  <>
                    Launch Session
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CreateEvent;