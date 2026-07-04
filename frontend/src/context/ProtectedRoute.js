import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import {
  FOUNDER_ADMIN_DASHBOARD_PATH,
  PLATFORM_SUPER_ADMIN_DASHBOARD_PATH,
  isCompanyFounderUser,
  isPlatformSuperAdminUser,
} from '../utils/roles';

export const ProtectedRoute = ({ children, roles }) => {
  const location = useLocation();
  const { authLoading, isAuthenticated, user } = useContext(AuthContext);
  const role = user?.role;
  const fallbackPath = isPlatformSuperAdminUser(user)
    ? PLATFORM_SUPER_ADMIN_DASHBOARD_PATH
    : isCompanyFounderUser(user)
      ? FOUNDER_ADMIN_DASHBOARD_PATH
      : '/employee-dashboard';

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center text-white">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Checking access</p>
          <p className="mt-3 text-slate-300">Verifying your session with the server...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const allowed = roles?.length
    ? roles.some((allowedRole) => {
        if (allowedRole === 'founder_admin') {
          return isCompanyFounderUser(user);
        }
        if (allowedRole === 'super_admin') {
          return isPlatformSuperAdminUser(user);
        }
        return role === allowedRole;
      })
    : true;

  if (!allowed) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};
