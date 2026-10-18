import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Spinner } from './ui';
import type { Action } from '../lib/utils';

/** Redirects anonymous visitors to the login page. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/** Role-based route guard: renders children only when the member's role allows the action. */
export function RequireRole({ action, children }: { action: Action; children: ReactNode }) {
  const { can } = useWorkspace();
  if (!can(action)) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-600">Your role in this workspace doesn't include access to this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function WorkspaceHome() {
  const { can } = useWorkspace();
  return <Navigate to={can('dashboard.view') ? 'dashboard' : 'feedback'} replace />;
}
