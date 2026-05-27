import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Landing route after a successful Google / Facebook OAuth round-trip.
 * The server redirects here with `?token=<jwt>`. We persist the token in
 * the same `sf_token` localStorage slot the email/password login uses,
 * refresh the auth context so `useAuth()` consumers see the new user,
 * then route by plan state:
 *
 *   - No plan assigned yet → /select-plan?welcome=1  (first-time signup
 *     path; plan selection is mandatory).
 *   - Plan already on file → /app  (returning user just signing in again).
 */
export default function OAuthSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login?oauth_error=missing_token', { replace: true });
      return;
    }
    localStorage.setItem('sf_token', token);
    (async () => {
      try { await refresh?.(); } catch { /* ignore — page still bounces */ }
      // Look up the user's plan via /plans/me. If they have no planId
      // (brand-new OAuth signup with no default plan, OR they never went
      // through select-plan) → route through select-plan. Otherwise → /app.
      let route = '/app';
      try {
        const { data } = await api.get('/plans/me');
        if (!data?.plan) route = '/select-plan?welcome=1';
      } catch {
        // /plans/me failure shouldn't block the redirect — default to /app
        // and let the user route to settings if needed.
      }
      navigate(route, { replace: true });
    })();
  }, [params, navigate, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
    </div>
  );
}
