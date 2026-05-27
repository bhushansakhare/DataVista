import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Zap, Lock, CreditCard, ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function fmtPrice(plan) {
  if (!plan) return '';
  if (plan.price === 0) return 'Free';
  return `${plan.currency === 'USD' ? '$' : ''}${plan.price}`;
}
function periodLabel(plan) {
  if (!plan) return '';
  if (plan.period === 'one_time') return 'One-time payment';
  return `Billed ${plan.period === 'year' ? 'yearly' : 'monthly'}`;
}

// Visual-only Luhn-style formatter — we never send card data to our server.
// The fields exist so the page LOOKS like a real checkout; the actual
// charge is handled by the server-side simulated payment provider (or
// Stripe/Razorpay in production, swapped via PAYMENT_PROVIDER env var).
function formatCardNumber(s) {
  const digits = String(s || '').replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})/g, '$1 ').trim();
}
function formatExpiry(s) {
  const digits = String(s || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
function formatCvc(s) {
  return String(s || '').replace(/\D/g, '').slice(0, 4);
}

/**
 * /checkout/:planId — payment confirmation screen.
 *
 * Card inputs are user-editable for UX realism but card data is NEVER sent
 * to our backend — only planId + orderId flows to /api/payments/confirm.
 * Double-submit is blocked at multiple layers: the button is disabled
 * while paying, AND a ref-based latch rejects re-entrant calls even if a
 * click somehow slipped through. After success the page navigates to /app
 * with the auth state refreshed so credits + plan sync immediately.
 */
export default function CheckoutPage() {
  const { planId } = useParams();
  const { user, refresh, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [plan, setPlan] = useState(null);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  // Card inputs (display-only — never POSTed). Defaults make the page
  // look populated and prevent the "looks broken" empty state.
  const [card, setCard] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: user?.name || '',
  });
  // Hard re-entrancy guard. Even if React re-renders while busy, a second
  // click can't slip past this — we check + flip synchronously.
  const inFlight = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    setBusy(true);
    api.post('/payments/initiate', { planId })
      .then(({ data }) => {
        setPlan(data.plan);
        setOrder(data);
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || 'Could not start checkout';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, loading, user]);

  // Re-seed the cardholder name once auth loads.
  useEffect(() => {
    if (user?.name && !card.name) setCard((c) => ({ ...c, name: user.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const free = useMemo(() => plan?.price === 0, [plan]);

  function validate() {
    if (free) return true;
    const e = {};
    const digits = card.number.replace(/\s+/g, '');
    if (!/^\d{12,19}$/.test(digits)) e.number = 'Enter a valid card number.';
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) e.expiry = 'Use MM/YY.';
    else {
      const [mm, yy] = card.expiry.split('/').map(Number);
      if (mm < 1 || mm > 12) e.expiry = 'Month must be 01–12.';
    }
    if (!/^\d{3,4}$/.test(card.cvc)) e.cvc = 'CVC is 3–4 digits.';
    if (!card.name.trim()) e.name = 'Name on card is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function confirm() {
    // Layer 1: ref latch (synchronous).
    if (inFlight.current) return;
    if (!plan) return;
    if (!validate()) {
      toast.error('Please check the card details.');
      return;
    }
    inFlight.current = true;
    setPaying(true);
    setError('');
    try {
      await api.post('/payments/confirm', { planId, orderId: order?.orderId });
      await refresh?.();
      toast.success('Payment confirmed — plan active!');
      // Per spec: after success → navigate to /app. The credits + planId
      // + expiry are already persisted server-side.
      navigate('/app', { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.error || 'Payment failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setPaying(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100">
      <header className="px-6 py-5 flex items-center justify-between max-w-4xl mx-auto">
        <Link to="/select-plan" className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100">
          <ArrowLeft className="w-4 h-4" /> Back to plans
        </Link>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <Lock className="w-3.5 h-3.5" /> Secure checkout
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        {busy || !plan ? (
          <div className="card p-10 animate-pulse h-64" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Left: card form (UI only) */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500">Confirm purchase</div>
                  <div className="font-bold text-lg">{plan.name}</div>
                </div>
              </div>

              {free ? (
                <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                  This is a free plan — no payment needed. Click Confirm to activate.
                </div>
              ) : (
                <div className="space-y-3">
                  <CardField
                    label="Card number"
                    error={errors.number}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    disabled={paying}
                    onChange={(v) => setCard((c) => ({ ...c, number: formatCardNumber(v) }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <CardField
                      label="Expiry (MM/YY)"
                      error={errors.expiry}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="12/30"
                      value={card.expiry}
                      disabled={paying}
                      onChange={(v) => setCard((c) => ({ ...c, expiry: formatExpiry(v) }))}
                    />
                    <CardField
                      label="CVC"
                      error={errors.cvc}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      value={card.cvc}
                      disabled={paying}
                      onChange={(v) => setCard((c) => ({ ...c, cvc: formatCvc(v) }))}
                    />
                  </div>
                  <CardField
                    label="Name on card"
                    error={errors.name}
                    autoComplete="cc-name"
                    placeholder="ADA LOVELACE"
                    value={card.name}
                    disabled={paying}
                    onChange={(v) => setCard((c) => ({ ...c, name: v }))}
                  />
                </div>
              )}

              <div className="rounded-xl border border-dashed border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-[12px] text-amber-800 dark:text-amber-200 mt-5">
                Simulated payment — card details are not sent to our server.
                Swap-in for Stripe Checkout / Razorpay in production.
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-rose-300/60 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <div className="flex items-center gap-2 mt-5 text-[11px] text-ink-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                By clicking Confirm Payment you authorize this charge and
                accept the activation of your plan.
              </div>

              <button
                type="button"
                onClick={confirm}
                disabled={paying}
                aria-busy={paying}
                className="btn-primary w-full mt-5 py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {paying
                  ? <>
                      <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin mr-1.5" />
                      Processing payment…
                    </>
                  : <><CreditCard className="w-4 h-4" /> Confirm Payment · {fmtPrice(plan)}</>}
              </button>
            </div>

            {/* Right: order summary (locked) */}
            <aside className="card p-5 h-fit">
              <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-2">Order summary</div>
              <div className="font-bold text-lg">{plan.name}</div>
              <div className="text-xs text-ink-500 mt-0.5">{periodLabel(plan)}</div>
              <div className="border-t border-ink-200/60 dark:border-ink-800/60 my-4" />
              <Row label="Plan" value={plan.name} />
              <Row label="Credits granted" value={plan.credits === -1 ? 'Unlimited' : `${plan.credits}`} />
              <Row label="Subtotal" value={fmtPrice(plan)} />
              <Row label="Taxes" value="—" />
              <div className="border-t border-ink-200/60 dark:border-ink-800/60 my-3" />
              <Row label="Total" value={fmtPrice(plan)} bold />
              <ul className="mt-4 space-y-1.5 text-xs text-ink-500">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {plan.period === 'one_time' ? 'No expiry' : plan.period === 'year' ? 'Renews yearly' : 'Renews monthly'}
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  Invoice will be available in Settings
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  Cancel anytime
                </li>
              </ul>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

function CardField({ label, value, onChange, error, placeholder, inputMode, autoComplete, disabled }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1">{label}</div>
      <input
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`input w-full ${error ? 'border-rose-500 focus:border-rose-500' : ''}`}
      />
      {error && (
        <div className="mt-1 flex items-start gap-1 text-[12px] text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}
    </label>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="text-ink-500">{label}</div>
      <div className={bold ? 'font-bold' : ''}>{value}</div>
    </div>
  );
}
