import React, { useState, useRef, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

const AttendanceScanner = () => {
  const [feedback, setFeedback] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  
  // Refs for logic management
  const feedbackTimeout = useRef(null);
  const lastGlobalScanTimeRef = useRef(0); // Replaces buggy library scanDelay
  const scannedIdsMapRef = useRef(new Map()); // Stores ID -> Timestamp

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    };
  }, []);

  const processAttendance = (studentId) => {
    if (!studentId) return;

    const now = Date.now();
    const COOLDOWN_PERIOD_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
    const lastStudentScanTime = scannedIdsMapRef.current.get(studentId);
    
    let status = 'alert-success';
    let message = `Student ID: ${studentId}`;
    let borderClass = 'border-success'; // Green for success

    // Check if this specific ID is in its 15-minute cooldown
    if (lastStudentScanTime && (now - lastStudentScanTime < COOLDOWN_PERIOD_MS)) {
      status = 'alert-warning';
      message = `Already Scanned: ${studentId}`;
      borderClass = 'border-warning'; // Yellow for warning
    } else {
      // Record new valid scan time
      scannedIdsMapRef.current.set(studentId, now);
    }

    // Clear any existing visual reset timers
    if (feedbackTimeout.current) {
      clearTimeout(feedbackTimeout.current);
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: 'numeric', 
      minute: 'numeric', 
      second: 'numeric' 
    });

    setFeedback({
      message,
      timestamp,
      status,
      borderClass
    });
    
    setIsModalOpen(false); 
    setManualId(''); 

    // Reset UI after 2 seconds
    feedbackTimeout.current = setTimeout(() => {
      setFeedback(null);
    }, 2000);
  };

  const handleManualSubmit = () => {
    if (manualId.trim() !== '') {
      lastGlobalScanTimeRef.current = Date.now(); // Reset global debounce
      processAttendance(manualId.trim());
    }
  };

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
      
      {/* Toast Popup Notification */}
      {feedback && (
        <div className="toast toast-top toast-center z-50 animate-bounce">
          <div className={`alert ${feedback.status} shadow-lg font-sans`}>
            {feedback.status === 'alert-success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <div className="text-left ml-2">
              <h3 className="font-bold text-sm">{feedback.message}</h3>
              <div className="text-xs opacity-80">Recorded at: {feedback.timestamp}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          
          <div className="w-full flex justify-between items-center mb-6">
            <div className="text-left">
              <h2 className="card-title text-2xl font-bold text-primary mb-1">
                SCANKOTO
              </h2>
              <p className="text-sm text-base-content/70">
                Ready to scan.
              </p>
            </div>
            
            <button 
              onClick={toggleCamera} 
              className="btn btn-circle btn-ghost"
              title="Switch Camera"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Dynamic Border Container */}
          <div className={`w-full aspect-square rounded-2xl overflow-hidden border-4 bg-black relative shadow-inner transition-colors duration-300 ${feedback ? feedback.borderClass : 'border-primary/20'}`}>
             <Scanner
                onScan={(detectedCodes) => {
                  // Custom 2000ms global debounce to prevent camera freezing
                  if (Date.now() - lastGlobalScanTimeRef.current < 2000) return;
                  
                  let scannedText = null;
                  if (Array.isArray(detectedCodes) && detectedCodes.length > 0 && detectedCodes[0].rawValue) {
                    scannedText = detectedCodes[0].rawValue;
                  } else if (typeof detectedCodes === 'string') {
                    scannedText = detectedCodes;
                  }

                  if (scannedText) {
                    lastGlobalScanTimeRef.current = Date.now();
                    processAttendance(scannedText);
                  }
                }}
                onError={(error) => console.error(error?.message)}
                constraints={{ facingMode: facingMode }}
                // removed scanDelay completely to fix the freeze bug
                components={{
                    audio: true, 
                    onOff: true, 
                    finder: true, 
                }}
             />
          </div>

          <div className="w-full mt-6">
            <button 
              className="btn btn-outline btn-primary w-full"
              onClick={() => setIsModalOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Enter ID Manually
            </button>
          </div>

        </div>
      </div>

      <dialog className={`modal ${isModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Manual Entry</h3>
          <p className="py-4 text-sm text-base-content/70">Enter the Student ID below if the QR code is damaged or unreadable.</p>
          <input 
            type="text" 
            placeholder="e.g. 2024-12345" 
            className="input input-bordered w-full mb-4" 
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            autoFocus={isModalOpen}
          />
          <div className="modal-action mt-0">
            <button className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleManualSubmit}>Submit</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsModalOpen(false)}>close</button>
        </form>
      </dialog>

    </div>
  );
};

export default AttendanceScanner;