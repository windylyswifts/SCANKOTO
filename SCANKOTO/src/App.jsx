import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AttendanceScanner from './components/AttendanceScanner';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Admin Hub */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Isolated Kiosk Mode - Requires an Event ID in the URL */}
        <Route path="/scan/:eventId" element={<AttendanceScanner />} />
        
        {/* Default fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;