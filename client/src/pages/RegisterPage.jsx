import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import OAuthButtons from '../components/auth/OAuthButtons.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFERRAL_RE = /^[A-Z]{2,8}-[A-F0-9]{4,6}$/i;

// Mirror of the server-side rule in authController.validatePassword. Kept
// in sync so the inline error shows BEFORE the network roundtrip — keeps
// the UX snappy and the server validation authoritative.
function passwordIssues(pw) {
  const errs = [];
  if (pw.length < 8) errs.push('at least 8 characters');
  if (!/[A-Za-z]/.test(pw)) errs.push('at least one letter');
  if (!/[0-9]/.test(pw)) errs.push('at least one number');
  return errs;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const refFromUrl = params.get('ref') || '';
  const planIdFromUrl = params.get('planId') || '';

  const [form, setForm] = useState({
    name: '', email: '', password: '', workspaceName: '',
    referralCode: refFromUrl,
    planId: planIdFromUrl,
  });
  const [busy, setBusy] = useState(false);
  const [showExtras, setShowExtras] = useState(Boolean(refFromUrl));
  const [chosenPlan, setChosenPlan] = useState(null);
  // Per-field errors, populated on submit or onBlur. Cleared as the user types.
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!planIdFromUrl) return;
    api.get('/plans')
      .then(({ data }) => {
        const match = (data.plans || []).find((p) => p._id === planIdFromUrl);
        if (match) setChosenPlan(match);
      })
      .catch(() => {});
  }, [planIdFromUrl]);

  function set(k) {
    return (e) => {
      const v = e.target.value;
      setForm((f) => ({ ...f, [k]: v }));
      // Clear the field-level error optimistically as the user fixes it.
      setErrors((er) => (er[k] ? { ...er, [k]: '' } : er));
    };
  }

  const pwIssues = useMemo(() => (form.password ? passwordIssues(form.password) : []), [form.password]);

  function validateAll() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address.';
    const pwErrs = passwordIssues(form.password);
    if (pwErrs.length) e.password = `Password needs ${pwErrs.join(', ')}.`;
    if (form.referralCode && !REFERRAL_RE.test(form.referralCode.trim())) {
      e.referralCode = 'Referral code looks like NAME-XXXX (e.g. BHUSHAN-9A3F).';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    if (!validateAll()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, referralCode: form.referralCode.trim().toUpperCase() };
      await register(payload);
      // Required step 2 — plan selection. NO skip path.
      navigate('/select-plan?welcome=1', { replace: true });
    } catch (err) {
      const data = err?.response?.data || {};
      const msg = data.error || 'Registration failed';
      // Route the structured server-side error onto the right field so it
      // shows up in red beneath the input, not just as a toast.
      const code = data.code;
      const fieldByCode = {
        invalid_email: 'email',
        weak_password: 'password',
        referral_invalid: 'referralCode',
        referral_expired: 'referralCode',
        referral_already_used: 'referralCode',
        referral_self: 'referralCode',
      };
      const field = fieldByCode[code];
      if (field) setErrors((er) => ({ ...er, [field]: msg }));
      toast.error(msg);
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
          <span className="font-bold">DataVista</span>
        </Link>
        <h1 className="text-2xl font-bold">Create your workspace</h1>
        <p className="text-sm text-ink-500 mt-1">Free to start, no credit card required.</p>

        <div className="mt-6">
          <OAuthButtons mode="signup" />
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider font-bold text-ink-400">
          <div className="flex-1 h-px bg-ink-200 dark:bg-ink-800" />
          or with email
          <div className="flex-1 h-px bg-ink-200 dark:bg-ink-800" />
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Name" error={errors.name}>
            <input
              required
              value={form.name}
              onChange={set('name')}
              onBlur={() => !form.name.trim() && setErrors((e) => ({ ...e, name: 'Name is required.' }))}
              className={`input mt-1.5 ${errors.name ? 'border-rose-500 focus:border-rose-500' : ''}`}
              placeholder="Ada Lovelace"
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              onBlur={() => {
                if (!form.email.trim()) setErrors((e) => ({ ...e, email: 'Email is required.' }));
                else if (!EMAIL_RE.test(form.email)) setErrors((e) => ({ ...e, email: 'Enter a valid email address.' }));
              }}
              className={`input mt-1.5 ${errors.email ? 'border-rose-500 focus:border-rose-500' : ''}`}
              placeholder="you@company.com"
            />
          </Field>

          <Field
            label="Password"
            error={errors.password}
            hint={pwIssues.length && form.password.length > 0
              ? `Needs ${pwIssues.join(', ')}.`
              : 'At least 8 characters with a letter and a number.'}
            hintTone={pwIssues.length && form.password.length > 0 ? 'warn' : 'muted'}
          >
            <PasswordInput
              required
              minLength={8}
              value={form.password}
              onChange={set('password')}
              className={`input mt-1.5 w-full ${errors.password ? 'border-rose-500 focus:border-rose-500' : ''}`}
              placeholder="••••••••"
            />
          </Field>

          <Field label="Workspace name (optional)">
            <input value={form.workspaceName} onChange={set('workspaceName')} className="input mt-1.5" placeholder="Acme Inc." />
          </Field>

          {chosenPlan && (
            <div className="rounded-xl border border-brand-300/60 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-500/30 px-3 py-2 text-[12px] text-brand-800 dark:text-brand-100">
              You picked the <strong>{chosenPlan.name}</strong> plan
              {chosenPlan.price > 0 && (
                <> ({chosenPlan.currency === 'USD' ? '$' : ''}{chosenPlan.price}/{chosenPlan.period === 'one_time' ? 'one-time' : chosenPlan.period})</>
              )}
              . It'll be assigned after signup.
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            className="text-[12px] text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 inline-flex items-center gap-1"
          >
            {showExtras ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Have a referral code?
          </button>
          {showExtras && (
            <Field label="Referral code (optional)" error={errors.referralCode} hint="Format: NAME-XXXX. You and your friend each get 10 bonus credits.">
              <input
                value={form.referralCode}
                onChange={set('referralCode')}
                onBlur={() => {
                  const v = form.referralCode.trim();
                  if (v && !REFERRAL_RE.test(v)) {
                    setErrors((e) => ({ ...e, referralCode: 'Referral code looks like NAME-XXXX (e.g. BHUSHAN-9A3F).' }));
                  }
                }}
                className={`input mt-1.5 font-mono uppercase ${errors.referralCode ? 'border-rose-500 focus:border-rose-500' : ''}`}
                placeholder="BHUSHAN-9A3F"
                maxLength={20}
              />
            </Field>
          )}

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

function Field({ label, children, error, hint, hintTone }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error ? (
        <div className="mt-1 flex items-start gap-1 text-[12px] text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {error}
        </div>
      ) : hint ? (
        <div className={`mt-1 text-[11px] ${hintTone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-ink-500'}`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
