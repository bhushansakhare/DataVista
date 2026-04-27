import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Sign-in failed');
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
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-ink-500 mt-1">Sign in to your workspace.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1.5" placeholder="you@company.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1.5" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 disabled:opacity-50">
            {busy ? 'Signing in…' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-ink-500">
          New to SheetFlow? <Link to="/register" className="text-brand-600 font-semibold">Create an account</Link>
        </div>
      </motion.div>
    </div>
  );
}
