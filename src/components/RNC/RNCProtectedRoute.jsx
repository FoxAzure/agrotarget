import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRNCAuth } from '../../lib/RNCAuthContext';

const RNCProtectedRoute = ({ children, allowedLevels }) => {
  const { user, loading } = useRNCAuth();

  if (loading) return <div className="rnc-auth-loading">Validando acesso...</div>;
  if (!user) return <Navigate to="/rnc/login" replace />;
  if (allowedLevels?.length && !allowedLevels.includes(user.nivel)) {
    return <Navigate to="/rnc" replace />;
  }

  return children;
};

export default RNCProtectedRoute;
