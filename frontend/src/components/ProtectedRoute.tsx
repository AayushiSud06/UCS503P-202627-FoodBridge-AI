/**
 * Route guard.
 *
 * The server is the real authority — every endpoint checks the caller's role
 * on every request, and this component cannot grant anything the API would
 * refuse. What it does is stop the app from rendering a portal that would only
 * fill with 403s, and send people somewhere useful instead.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import type { UserRole } from '../types';
import { HOME_PATH, useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  /** Roles allowed through. Omit to allow any signed-in account. */
  allow?: UserRole[];
}

export default function ProtectedRoute({ allow }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // A stored token is still being exchanged for an account. Rendering the
  // login screen here would flash it in front of someone who is signed in.
  if (isLoading) return <AuthSplash />;

  if (!user) {
    // Remember where they were headed so signing in can resume it.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allow && !allow.includes(user.role)) {
    // Signed in, wrong portal. Their own is the useful destination.
    return <Navigate to={HOME_PATH[user.role]} replace />;
  }

  return <Outlet />;
}

function AuthSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <div className="w-10 h-10 bg-emerald-700 rounded-full flex items-center justify-center animate-pulse">
        <Leaf size={20} className="text-white" />
      </div>
      <p className="text-sm text-gray-500">Restoring your session…</p>
    </div>
  );
}
