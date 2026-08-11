import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/apiFetch';

// Client-side port of the old Next middleware (src/middleware.ts) rules.
// The auth cookie ("verified") is httpOnly, so it can't be read from JS here —
// instead we ask the server via /api/check-session. Real enforcement still
// lives server-side (401s on /api routes); this just avoids flashing protected
// UI and redirects the login page away once a session exists.
const PUBLIC_PATHS = ['/', '/health', '/ready'];

interface Props {
  children: ReactNode;
}

export default function RouteGuard({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      let authenticated = false;
      try {
        const res = await apiFetch('/api/check-session');
        const data = await res.json();
        authenticated = !!data.authenticated;
      } catch {
        authenticated = false;
      }

      if (cancelled) return;

      const isPublic = PUBLIC_PATHS.includes(location.pathname);

      if (!authenticated && !isPublic) {
        navigate('/', { replace: true });
      } else if (authenticated && location.pathname === '/') {
        navigate('/battle', { replace: true });
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  // Don't hard-block on the pending check — render children immediately so
  // the app doesn't flash a blank screen; the redirect (if any) lands quickly.
  return <>{children}</>;
}
