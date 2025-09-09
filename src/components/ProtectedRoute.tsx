// ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  role?: 'investor' | 'entrepreneur';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Not authenticated → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role check
  if (role && user?.role !== role) {
    // Optionally redirect to user's correct dashboard
    const redirectPath =
      user?.role === 'investor'
        ? '/dashboard/investor'
        : user?.role === 'entrepreneur'
        ? '/dashboard/entrepreneur'
        : '/login';

    return <Navigate to={redirectPath} replace />;
  }

  // Authorized → render nested routes
  return <Outlet />;
};
