import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [busy, setBusy] = useState(false);

  function set(k) {
    return (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      await register(form);
      navigate('/onboarding');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-mesh-light dark:bg-mesh-dark">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-md p-8"
      >
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">SheetFlow</span>
        </Link>
        <h1 className="text-2xl font-bold">Create your workspace</h1>
        <p className="text-sm text-ink-500 mt-1">Free to start, no credit card required.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Name</label>
            <input required value={form.name} onChange={set('name')} className="input mt-1.5" placeholder="Ada Lovelace" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" required value={form.email} onChange={set('email')} className="input mt-1.5" placeholder="you@company.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={set('password')} className="input mt-1.5" placeholder="At least 6 characters" />
          </div>
          <div>
            <label className="label">Workspace name (optional)</label>
            <input value={form.workspaceName} onChange={set('workspaceName')} className="input mt-1.5" placeholder="Acme Inc." />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 disabled:opacity-50">
            {busy ? 'Creating…' : <>Create account <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-ink-500">
          Already have an account? <Link to="/login" className="text-brand-600 font-semibold">Sign in</Link>
        </div>
      </motion.div>
    </div>
  );
}
