import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';
import Unauthorized from '../pages/Unauthorized';
import { hasRoleAccess } from '../utils';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: (UserRole | string)[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-spinner">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRoleAccess(user.role, allowedRoles)) {
    return (
      <Layout>
        <Unauthorized />
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
