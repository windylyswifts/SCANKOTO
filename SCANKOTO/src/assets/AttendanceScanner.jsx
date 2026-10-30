import React, { useState, useRef, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

const AttendanceScanner = () => {
  const [feedback, setFeedback] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  
  const feedbackTimeout = useRef(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    };
  }, []);

  const processAttendance = (studentId) => {
    if (!studentId) return;

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
      message: `Student ID: ${studentId}`,
      timestamp: timestamp,
      status: 'alert-success'
    });
    
    setIsSuccessFlash(true);
    setIsModalOpen(false); 
    setManualId(''); 

    feedbackTimeout.current = setTimeout(() => {
      setFeedback(null);
      setIsSuccessFlash(false);
    }, 3000);
  };

  const handleManualSubmit = () => {
    if (manualId.trim() !== '') {
      processAttendance(manualId.trim());
    }
  };

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
      
      {feedback && (
        <div className="toast toast-top toast-center z-50 animate-none">
          <div className={`alert ${feedback.status} shadow-lg font-sans`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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

          <div className={`w-full aspect-square rounded-2xl overflow-hidden border-4 bg-black relative shadow-inner transition-colors duration-300 ${isSuccessFlash ? 'border-success' : 'border-primary/20'}`}>
             <Scanner
                onScan={(detectedCodes) => {
                  if (Array.isArray(detectedCodes) && detectedCodes.length > 0 && detectedCodes[0].rawValue) {
                    processAttendance(detectedCodes[0].rawValue);
                  } else if (typeof detectedCodes === 'string') {
                    processAttendance(detectedCodes);
                  }
                }}
                onError={(error) => console.error(error?.message)}
                constraints={{ facingMode: facingMode }}
                scanDelay={3000}
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