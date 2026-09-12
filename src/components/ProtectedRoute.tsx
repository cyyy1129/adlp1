// ============================================================
// ProtectedRoute — Auth + onboarding gate
// ============================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export default function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const { user, profile, loading, supabaseConfigured } = useAuth();

  // Show loading spinner while resolving auth state
  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  // If Supabase isn't configured, let users see the page with a banner
  if (!supabaseConfigured) {
    return <>{children}</>;
  }

  // Not logged in → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but onboarding incomplete → onboarding
  if (requireOnboarding && profile && !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  // Profile still loading
  if (requireOnboarding && !profile) {
    return (
      <div className="page-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
