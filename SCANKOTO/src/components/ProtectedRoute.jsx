import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, isMfaVerified } = useAuth();

  if (!user || !isMfaVerified) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;