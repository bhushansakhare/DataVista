import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Inline-rendered error string. Distinct from toast so the "Email does
  // not exist" case is visually anchored to the form.
  const [inlineError, setInlineError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setInlineError('');
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Could not send reset link';
      if (status === 404) {
        // Per spec: explicit "email does not exist" rendered inline in red.
        setInlineError(msg);
      } else {
        toast.error(msg);
      }
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

        {submitted ? (
          <>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h1 className="text-xl font-bold">Check your inbox</h1>
            </div>
            <p className="text-sm text-ink-500 mt-2 leading-relaxed">
              If <span className="font-semibold text-ink-700 dark:text-ink-200">{email}</span> is registered with us, we just sent a reset link. The link is valid for 15 minutes.
            </p>
            <Link to="/login" className="btn-primary w-full mt-6 justify-center">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Reset your password</h1>
            <p className="text-sm text-ink-500 mt-1">
              Enter your email and we'll send you a link to set a new password.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                  <input
                    type="email" required value={email}
                    onChange={(e) => { setEmail(e.target.value); setInlineError(''); }}
                    className={`input mt-1.5 pl-9 ${inlineError ? 'border-rose-400 focus:ring-rose-300' : ''}`}
                    placeholder="you@company.com"
                    autoFocus
                  />
                </div>
                {inlineError && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 font-medium">
                    {inlineError}
                  </div>
                )}
              </div>
              <button type="submit" disabled={busy || !email.trim()} className="btn-primary w-full py-2.5 disabled:opacity-50">
                {busy ? 'Sending…' : <>Send reset link <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
            <div className="mt-6 text-center text-sm text-ink-500">
              <Link to="/login" className="text-brand-600 font-semibold">Back to sign in</Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
