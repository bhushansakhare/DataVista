import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User as UserIcon, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Global app header. Sits above the page content on every authenticated
 * route. Workspace info on the left, profile dropdown on the right (with
 * Update Profile / Settings / Logout). Mobile-friendly: collapses to icon
 * width below `sm`.
 */
export default function AppHeader({ onOpenSidebar }) {
  const { user, workspace, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Close the dropdown when the user clicks outside.
  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const initials = (user?.name || 'U')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U';

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/60 dark:border-ink-800/60 bg-white/80 dark:bg-ink-900/70 backdrop-blur">
      <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <div className="hidden lg:block min-w-0">
            <div className="text-sm font-semibold truncate">{workspace?.name || 'SheetFlow'}</div>
            <div className="text-[11px] text-ink-500 truncate -mt-0.5">{user?.email || ''}</div>
          </div>
          <div className="lg:hidden font-semibold text-sm">SheetFlow</div>
        </div>

        {/* Credits badge — clickable link to the Plan tab. Hidden when the
            user is on an unlimited plan (we render '∞' instead). The value
            re-syncs whenever AuthContext refreshes (login, AI gen, payment). */}
        {user && (
          <Link
            to="/app/settings?tab=plan"
            title="Credits remaining — manage plan"
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
              (user.credits ?? 0) === 0
                ? 'border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
                : 'border-ink-200/60 dark:border-ink-800/60 text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            <span>Credits: <strong>{user.credits ?? 0}</strong></span>
          </Link>
        )}

        {/* Profile dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl border border-ink-200/60 dark:border-ink-800/60 hover:bg-ink-50 dark:hover:bg-ink-800/40 transition"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 text-white text-[11px] font-bold flex items-center justify-center">
                {initials}
              </div>
            )}
            <div className="hidden sm:block text-xs font-medium leading-tight max-w-[10rem] truncate">{user?.name || 'Account'}</div>
            <ChevronDown className={`w-3.5 h-3.5 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-xl border border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900 shadow-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-ink-200/60 dark:border-ink-800/60">
                <div className="text-sm font-semibold truncate">{user?.name}</div>
                <div className="text-[11px] text-ink-500 truncate">{user?.email}</div>
                {user?.role && (
                  <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    {user.role}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/app/settings?tab=profile'); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800/40 flex items-center gap-2"
              >
                <UserIcon className="w-3.5 h-3.5 text-ink-500" /> Update profile
              </button>
              <Link
                to="/app/settings"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800/40 flex items-center gap-2"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-ink-500" /> Settings
              </Link>
              <div className="border-t border-ink-200/60 dark:border-ink-800/60" />
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
