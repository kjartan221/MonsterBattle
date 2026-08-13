import { type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/WalletContext';

// Per-route auth wrapper. Reads hasSession (set once on mount by the
// verified-cookie check): null = checking (hold render, no flash),
// false = redirect to login, true = render. Enforcement stays server-side.
export default function ProtectedRoute({ children }: { children: ReactElement }) {
  const { hasSession } = useAuthContext();
  const location = useLocation();

  if (hasSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950">
        <p role="status" className="text-white/80 text-lg animate-pulse">
          Restoring your session…
        </p>
      </div>
    );
  }

  if (!hasSession) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
