import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

const AttendanceScanner = () => {
  const [feedback, setFeedback] = useState(null);
  // Default to 'environment' (back camera)
  const [facingMode, setFacingMode] = useState('environment'); 

  const handleScan = (text) => {
    if (text) {
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: 'numeric', 
        minute: 'numeric', 
        second: 'numeric' 
      });

      setFeedback({
        message: `Student ID: ${text}`,
        timestamp: timestamp,
        status: 'alert-success'
      });

      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
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
            
            {/* Camera Switcher Button */}
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

          <div className="w-full aspect-square rounded-2xl overflow-hidden border-4 border-primary/20 bg-black relative shadow-inner">
             <Scanner
                onResult={handleScan}
                onError={(error) => console.error(error?.message)}
                // Apply the facingMode state here
                constraints={{ facingMode: facingMode }}
                options={{
                    delayBetweenScanSuccess: 3000, 
                }}
                components={{
                    audio: true, 
                    onOff: true, 
                    finder: true, 
                }}
             />
          </div>

          <div className="h-20 w-full mt-6">
            {feedback && (
              <div className={`alert ${feedback.status} shadow-lg transition-all duration-300 ease-in-out`}>
                <div>
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
          </div>

        </div>
      </div>
    </div>
  );
};

export default AttendanceScanner;