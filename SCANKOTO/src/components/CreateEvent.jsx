import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const CreateEvent = () => {
  const navigate = useNavigate();

  // --- Form State ---
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  // --- Attendance State ---
  const [isAttendanceRequired, setIsAttendanceRequired] = useState('yes');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [renderHours, setRenderHours] = useState(0);
  const [renderMinutes, setRenderMinutes] = useState(0);

  // --- File, Headcount & Masterlist State ---
  const [masterlistFile, setMasterlistFile] = useState(null);
  const [parsedStudents, setParsedStudents] = useState([]);
  const [expectedHeadcount, setExpectedHeadcount] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- File Drag & Drop Handlers ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  // Helper: Bulletproof CSV Parser mapped to official LCO headers
  const parseCSVToStudentObjects = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Clean headers by standardizing them (lowercasing, removing spaces and special characters)
    const rawHeaders = lines[0].split(',').map(h => h.trim());
    const cleanHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const students = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < cleanHeaders.length) continue;

      const studentObj = {};
      cleanHeaders.forEach((header, index) => {
        studentObj[header] = cols[index] || '';
      });

      // Map the chaotic LCO headers to our clean database columns
      // 'idnumber' maps to the LCO 'ID NUMBER' column
      const studentId = studentObj['idnumber'] || studentObj['studentid'] || '';
      
      // 'fullname' matches 'FULL NAME (Last Name, First Name, Middle Initial)' after cleaning
      const fullName = studentObj['fullname'] || studentObj['fullname'] || studentObj['name'] || 'Unknown';
      
      const program = studentObj['program'] || studentObj['course'] || 'Unknown';
      const year = studentObj['year'] || studentObj['yearlevel'] || 'N/A';

      if (studentId) {
        students.push({
          student_id: studentId,
          full_name: fullName,
          year_level: year,
          course: program,
          email: '', 
          qr_hash: '' 
        });
      }
    }
    return students;
  };

  const processFile = (file) => {
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      setMasterlistFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const students = parseCSVToStudentObjects(text);
        
        if (students.length === 0) {
          alert("Error: The CSV is empty or the column headers do not match (requires 'student_id').");
          setMasterlistFile(null);
          setExpectedHeadcount('');
          return;
        }

        setParsedStudents(students);
        setExpectedHeadcount(students.length.toString());
      };
      reader.readAsText(file);
    } else {
      alert("Invalid file format. Please upload a valid .csv file.");
      setMasterlistFile(null);
      setParsedStudents([]);
      setExpectedHeadcount('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // --- Supabase Batch Submission Handler ---
  const handleConfirmEvent = async () => {
    if (!eventName.trim()) { alert("Please enter an Event Title."); return; }
    if (!eventDescription.trim()) { alert("Please provide an Event Description."); return; }
    if (!startTime) { alert("Please select the Event Start time."); return; }
    if (!endTime) { alert("Please select the Event End time."); return; }
    if (new Date(endTime) <= new Date(startTime)) { alert("The Event End time must occur after the Start time."); return; }
    
    if (!masterlistFile || parsedStudents.length === 0) { 
      alert("Please upload a valid Student Masterlist (.csv) containing at least one valid student record."); 
      return; 
    }

    setIsSubmitting(true);

    const eventIdSlug = eventName.trim().toLowerCase().replace(/\s+/g, '-');

    // Fetch the currently authenticated user's ID
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      alert("Authentication error: You must be logged in to create an event.");
      setIsSubmitting(false);
      return;
    }

    const newEventConfig = {
      event_id: eventIdSlug,
      event_name: eventName.trim(),
      description: eventDescription.trim(),
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      min_duration_minutes: isAttendanceRequired === 'yes' ? (renderHours * 60 + renderMinutes) : 0,
      expected_headcount: parsedStudents.length,
      created_by: userId // Now securely tying to the Auth User
    };

    // 1. Upsert Event Metadata
    const { error: eventError } = await supabase
      .from('events')
      .upsert([newEventConfig], { onConflict: 'event_id' });

    if (eventError) {
      console.error("Supabase Event Insert Error:", eventError);
      alert("Failed to save event to cloud: " + eventError.message);
      setIsSubmitting(false);
      return;
    }

    // 2. Tie the Event to the User as 'owner' in the new event_access table
    const { error: accessError } = await supabase
      .from('event_access')
      .upsert({
         event_id: eventIdSlug,
         user_id: userId,
         role: 'owner'
      }, { onConflict: 'event_id,user_id', ignoreDuplicates: true });

    if (accessError) {
      console.error("Event Access Error:", accessError);
      alert("Event created, but failed to assign ownership: " + accessError.message);
    }

    // 3. Batch Upsert Students with strict verification (.select())
    const { data: insertedStudents, error: studentError } = await supabase
      .from('students')
      .upsert(parsedStudents, { onConflict: 'student_id' })
      .select();

    setIsSubmitting(false);

    if (studentError) {
      console.error("Supabase Students Import Error:", studentError);
      alert("Event created, but failed to import student masterlist. Details: " + studentError.message);
      return;
    }

    if (!insertedStudents || insertedStudents.length === 0) {
      alert("Warning: The event was created, but Supabase blocked the student upload due to a missing RLS policy. Please verify your SQL policies.");
      return;
    }

    alert(`Success! Event "${newEventConfig.event_name}" created and ${insertedStudents.length} students synced to the cloud.`);
    navigate('/dashboard');
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full flex justify-center pb-24 bg-base-200">
      
      <div className="w-full max-w-4xl space-y-6">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">New Event Setup</h1>
          <p className="text-sm text-base-content/60 mt-1">Configure event parameters, scheduling, and upload the official masterlist.</p>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-6 md:p-10 space-y-8">
            
            {/* Details Section */}
            <div className="space-y-4">
              <input 
                type="text" 
                className="w-full text-4xl font-extrabold focus:outline-none bg-transparent placeholder:text-slate-300 text-slate-800 transition-colors"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Event Title..."
              />
              <textarea 
                className="w-full text-base focus:outline-none bg-transparent placeholder:text-slate-400 text-slate-600 resize-none h-20"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Add a brief description or venue details for this event..."
              />
            </div>

            <div className="divider m-0"></div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Scheduling */}
              <div className="space-y-6">
                <h3 className="font-semibold text-lg text-slate-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Scheduling
                </h3>
                
                <div className="form-control w-full">
                  <label className="label"><span className="label-text font-medium">Starts At</span></label>
                  <input 
                    type="datetime-local" 
                    className="input input-bordered w-full" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                
                <div className="form-control w-full">
                  <label className="label"><span className="label-text font-medium">Ends At</span></label>
                  <input 
                    type="datetime-local" 
                    className="input input-bordered w-full" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Requirements */}
              <div className="space-y-6">
                <h3 className="font-semibold text-lg text-slate-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Requirements
                </h3>

                <div className="form-control w-full p-4 bg-base-200/50 rounded-xl border border-base-200">
                  <label className="label cursor-pointer pb-2">
                    <span className="label-text font-medium">Strict Attendance Required?</span> 
                    <input 
                      type="checkbox" 
                      className="toggle toggle-primary" 
                      checked={isAttendanceRequired === 'yes'}
                      onChange={(e) => {
                        setIsAttendanceRequired(e.target.checked ? 'yes' : 'no');
                        if (e.target.checked) setIsModalOpen(true);
                      }}
                    />
                  </label>
                  
                  {isAttendanceRequired === 'yes' && (
                    <div className="mt-3 flex justify-between items-center bg-base-100 p-3 rounded-lg border border-base-200 shadow-sm">
                      <span className="text-sm">Time to render: <strong className="text-primary">{renderHours}h {renderMinutes}m</strong></span>
                      <button className="btn btn-xs btn-ghost text-primary" onClick={() => setIsModalOpen(true)}>Edit</button>
                    </div>
                  )}
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text font-medium">Student Masterlist (.csv)</span></label>
                  
                  <div 
                    className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
                      ${isDragActive ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-50 hover:bg-base-200/50'}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input 
                      type="file" 
                      accept=".csv"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFileChange}
                    />
                    
                    <div className="bg-base-100 p-2 rounded-full shadow-sm border border-base-200 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    
                    {masterlistFile ? (
                      <div className="text-sm">
                        <p className="font-semibold text-primary truncate max-w-xs">{masterlistFile.name}</p>
                        <p className="text-xs opacity-60 mt-1">Detected count: {expectedHeadcount} students</p>
                      </div>
                    ) : (
                      <div className="text-sm px-2">
                        <span className="text-primary font-semibold">Select a .csv file</span> or drag and drop it here
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
          
          <div className="bg-base-200/50 px-6 py-5 md:px-10 border-t border-base-200 flex justify-between items-center rounded-b-2xl">
            <button className="btn btn-ghost text-slate-500" onClick={() => navigate('/dashboard')} disabled={isSubmitting}>Discard</button>
            <button className="btn btn-primary px-8 shadow-sm" onClick={handleConfirmEvent} disabled={isSubmitting}>
              {isSubmitting ? 'Syncing to Cloud...' : 'Launch Event'}
              {!isSubmitting && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: Time to Render */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-8 text-center bg-gradient-to-b from-base-100 to-base-200">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="font-bold text-xl mb-2 text-slate-800">Set Minimum Duration</h3>
              <p className="text-sm text-base-content/60 mb-8">Specify exactly how long an attendee must render before they are cleared.</p>
              
              <div className="flex justify-center items-center gap-4">
                <div className="flex flex-col items-center">
                  <input 
                    type="number" 
                    min="0" 
                    className="input input-bordered w-20 text-center text-3xl font-bold text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary shadow-inner" 
                    value={renderHours}
                    onChange={(e) => setRenderHours(Number(e.target.value))}
                  />
                  <span className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-wider">Hours</span>
                </div>
                <span className="text-4xl font-light text-slate-300 pb-6">:</span>
                <div className="flex flex-col items-center">
                  <input 
                    type="number" 
                    min="0" 
                    max="59"
                    className="input input-bordered w-20 text-center text-3xl font-bold text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary shadow-inner" 
                    value={renderMinutes}
                    onChange={(e) => setRenderMinutes(Number(e.target.value))}
                  />
                  <span className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-wider">Mins</span>
                </div>
              </div>
            </div>
            <div className="bg-base-100 px-6 py-4 flex justify-end border-t border-base-200">
              <button className="btn btn-primary w-full shadow-md" onClick={() => setIsModalOpen(false)}>Save Duration</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default CreateEvent;