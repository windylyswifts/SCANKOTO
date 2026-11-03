import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import readXlsxFile from 'read-excel-file';

const CreateEvent = () => {
  const navigate = useNavigate();

  // --- Responsive & Sidebar State ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // --- File & Headcount State ---
  const [masterlistFile, setMasterlistFile] = useState(null);
  const [expectedHeadcount, setExpectedHeadcount] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  // --- File Drag & Drop Handlers ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  // Upgraded Engine: Handles both Native CSV & Secure XLSX Parsing
  const processFile = async (file) => {
    if (!file) return;
    
    try {
      if (file.name.endsWith('.csv')) {
        setMasterlistFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const rows = text.split('\n').filter(row => row.trim().length > 0);
          const count = rows.length > 1 ? rows.length - 1 : 0;
          setExpectedHeadcount(count.toString());
        };
        reader.readAsText(file);
        
      } else if (file.name.endsWith('.xlsx')) {
        setMasterlistFile(file);
        const rows = await readXlsxFile(file);
        const count = rows.length > 1 ? rows.length - 1 : 0;
        setExpectedHeadcount(count.toString());
        
      } else {
        alert("Unsupported file format. Please upload a .csv or .xlsx file.");
        setMasterlistFile(null);
        setExpectedHeadcount('');
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Failed to read the file. Please ensure it is a valid spreadsheet.");
      setMasterlistFile(null);
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

  // --- Strict Validation & Submit Handler ---
  const handleConfirmEvent = () => {
    if (!eventName.trim()) {
      alert("Please enter an Event Title.");
      return;
    }
    if (!eventDescription.trim()) {
      alert("Please provide an Event Description.");
      return;
    }
    if (!startTime) {
      alert("Please select the Event Start time.");
      return;
    }
    if (!endTime) {
      alert("Please select the Event End time.");
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      alert("The Event End time must occur after the Start time.");
      return;
    }
    if (!masterlistFile) {
      alert("Please upload the Student Masterlist (.csv or .xlsx) file to establish the headcount.");
      return;
    }

    const newEventConfig = {
      name: eventName.trim(),
      description: eventDescription.trim(),
      start: startTime,
      end: endTime,
      attendanceRequired: isAttendanceRequired === 'yes',
      timeToRender: isAttendanceRequired === 'yes' ? { hours: renderHours, minutes: renderMinutes } : { hours: 0, minutes: 0 },
      expectedHeadcount: Number(expectedHeadcount) || 0,
      fileName: masterlistFile.name
    };

    console.log("Event Confirmed Payload:", newEventConfig);
    alert("Event Created Successfully! (Check console for payload)");
    navigate('/dashboard');
  };

  return (
    <div className="flex h-screen bg-base-200 font-sans text-base-content overflow-hidden relative">
      
      {/* MOBILE BACKDROP */}
      {isLeftPanelOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity" 
          onClick={() => setIsLeftPanelOpen(false)}
        />
      )}
      
      {/* LEFT SIDEBAR */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50 bg-base-100 border-r border-base-200 
        flex flex-col flex-shrink-0 w-64 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-8">
              <span className="text-xs">SP</span>
            </div>
          </div>
          <span className="font-bold tracking-wider">SCANKOTO</span>
        </div>
        
        <div className="px-4 py-2">
          <p className="text-xs text-base-content/50 uppercase font-semibold mb-4 px-2">Dashboards</p>
          <ul className="menu bg-base-100 w-full p-0 gap-1">
            <li>
              <Link to="/dashboard" className="hover:bg-base-200 rounded-xl font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                Overview
              </Link>
            </li>
            <li>
              <Link to="/create-event" className="active bg-base-200 text-base-content font-medium rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Create Event
              </Link>
            </li>
          </ul>
        </div>
      </aside>

      {/* MOBILE STICKY LEFT BUTTON */}
      <button 
        className="fixed left-0 top-1/2 -translate-y-1/2 z-30 btn btn-sm btn-primary md:hidden rounded-l-none shadow-xl opacity-90"
        onClick={() => setIsLeftPanelOpen(true)}
        style={{ width: '24px', padding: 0 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
      </button>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full flex justify-center pb-24">
        
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
                    <label className="label"><span className="label-text font-medium">Student Masterlist (.csv, .xlsx)</span></label>
                    
                    <div 
                      className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
                        ${isDragActive ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-50 hover:bg-base-200/50'}
                      `}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {/* Added .xlsx to the accept string so it shows in the file explorer */}
                      <input 
                        type="file" 
                        accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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
                          <span className="text-primary font-semibold">Select a file</span> or drag and drop a file here
                          <p className="text-xs opacity-50 mt-2">.csv and .xlsx formats are supported.</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

            </div>
            
            <div className="bg-base-200/50 px-6 py-5 md:px-10 border-t border-base-200 flex justify-between items-center rounded-b-2xl">
              <button className="btn btn-ghost text-slate-500" onClick={() => navigate('/dashboard')}>Discard</button>
              <button className="btn btn-primary px-8 shadow-sm" onClick={handleConfirmEvent}>
                Launch Event
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </div>
        </div>

      </main>

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

    </div>
  );
};

export default CreateEvent;