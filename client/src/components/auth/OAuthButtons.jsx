import { useEffect, useState } from 'react';
import api from '../../api/client.js';

// Backend exposes /api/auth/providers reporting whether each strategy is
// configured (Google / Facebook env vars present). We render every button
// regardless — clicks on unconfigured providers surface the server's 503
// message clearly rather than silently doing nothing. The probe just
// dims the unconfigured ones.
export default function OAuthButtons({ mode = 'signin' }) {
  const [providers, setProviders] = useState({ google: false, facebook: false });

  useEffect(() => {
    api.get('/auth/providers')
      .then(({ data }) => setProviders(data || {}))
      .catch(() => { /* leave both as false; user still sees buttons */ });
  }, []);

  // window.location.href is the right primitive: OAuth requires a full
  // top-level navigation (we end up on Google's domain, then back to our
  // /api/auth/<provider>/callback). React Router can't help here.
  const goto = (path) => { window.location.href = path; };

  const label = mode === 'signup' ? 'Sign up' : 'Sign in';

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => goto('/api/auth/google')}
        className={`w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-semibold transition border ${
          providers.google
            ? 'bg-white text-ink-800 border-ink-300 hover:bg-ink-50'
            : 'bg-white text-ink-500 border-ink-200 opacity-80 hover:opacity-100'
        }`}
        title={providers.google ? '' : 'OAuth not configured on the server — click for the configuration step.'}
      >
        <GoogleIcon /> {label} with Google
      </button>
      <button
        type="button"
        onClick={() => goto('/api/auth/facebook')}
        className={`w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-semibold transition ${
          providers.facebook
            ? 'bg-[#1877F2] text-white hover:bg-[#166fe5]'
            : 'bg-[#1877F2]/70 text-white opacity-80 hover:opacity-100'
        }`}
        title={providers.facebook ? '' : 'OAuth not configured on the server — click for the configuration step.'}
      >
        <FacebookIcon /> {label} with Facebook
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.8-6.2 8-11.3 8a12 12 0 1 1 7.9-21.1l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.8-16.7c.3-1.5.4-3.1.4-4.7s-.1-3.1-.4-4.6z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 24 36c-5.1 0-9.5-3.2-11.3-7.9l-6.5 5C9.7 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.3C41 35.2 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.017 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.93-1.956 1.886v2.255h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  );
}
