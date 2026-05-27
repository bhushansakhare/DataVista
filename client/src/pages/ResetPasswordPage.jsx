import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Lock, AlertCircle } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useAuth();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      localStorage.setItem('sf_token', data.token);
      await refresh?.();
      toast.success('Password reset — you\'re signed in.');
      navigate('/app', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Reset failed');
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

        {!token ? (
          <>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
              <h1 className="text-xl font-bold">Reset link is missing</h1>
            </div>
            <p className="text-sm text-ink-500 mt-2 leading-relaxed">
              This page expects a reset token. Use the link from your email, or request a new one.
            </p>
            <Link to="/forgot-password" className="btn-primary w-full mt-6 justify-center">Request a new link</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Set a new password</h1>
            <p className="text-sm text-ink-500 mt-1">
              At least 6 characters. You'll be signed in right after.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label">New password</label>
                <PasswordInput
                  required minLength={6} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input mt-1.5 w-full"
                  placeholder="At least 6 characters"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <PasswordInput
                  required minLength={6} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input mt-1.5 w-full"
                  placeholder="Repeat it"
                />
              </div>
              <button type="submit" disabled={busy || password.length < 6 || password !== confirm} className="btn-primary w-full py-2.5 disabled:opacity-50">
                {busy ? 'Resetting…' : <>Reset password <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
