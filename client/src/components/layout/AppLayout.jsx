import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import {
  LayoutDashboard, Sheet, Plus, Shield, Sun, Moon, LogOut, Sparkles, Menu, X, Bot, LayoutTemplate,
} from 'lucide-react';
import { useState } from 'react';

function NavItem({ to, icon: Icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
          isActive
            ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
            : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'
        }`
      }
    >
      <Icon className="w-4 h-4" />
      <span>{children}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, workspace, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-mesh-light dark:bg-mesh-dark">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform glass border-r border-ink-200/60 dark:border-ink-800/60 flex flex-col`}
      >
        <Link to="/app" className="flex items-center gap-2 px-5 py-5 border-b border-ink-200/60 dark:border-ink-800/60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">SheetFlow</div>
            <div className="text-[10px] text-ink-500 leading-tight">Analytics</div>
          </div>
        </Link>

        <div className="px-3 py-3">
          <button
            onClick={() => { navigate('/app/sheets/import'); setOpen(false); }}
            className="btn-primary w-full"
          >
            <Plus className="w-4 h-4" /> New sheet
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto" onClick={() => setOpen(false)}>
          <NavItem to="/app" icon={LayoutDashboard} end>Dashboards</NavItem>
          <NavItem to="/app/sheets" icon={Sheet}>Sheets</NavItem>
          <NavItem to="/app/ai" icon={Bot}>AI Assistant</NavItem>
          <NavItem to="/app/templates" icon={LayoutTemplate}>Templates</NavItem>
          {user?.role === 'superadmin' && (
            <>
              <div className="px-3 pt-4 pb-1 label">Admin</div>
              <NavItem to="/app/admin" icon={Shield}>Super Admin</NavItem>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-ink-200/60 dark:border-ink-800/60">
          <div className="px-2 py-2 mb-2">
            <div className="text-xs font-semibold truncate">{user?.name}</div>
            <div className="text-[11px] text-ink-500 truncate">{workspace?.name}</div>
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-300 uppercase tracking-wider">
              {user?.role}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={toggle} className="btn-secondary flex-1" title="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={logout} className="btn-secondary flex-1" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden glass border-b border-ink-200/60 dark:border-ink-800/60 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="btn-ghost p-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-semibold text-sm">SheetFlow</div>
          <div className="w-9" />
        </header>
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
