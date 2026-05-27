import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, Crown, Rocket, Zap, CheckCircle2 } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function iconFor(plan, index, total) {
  if (plan.price === 0) return Sparkles;
  if (index === total - 1) return Crown;
  return Rocket;
}

function priceLabel(plan) {
  if (plan.price === 0) return { amount: 'Free', suffix: '' };
  const sym = plan.currency === 'USD' ? '$' : '';
  const suffix =
    plan.period === 'one_time' ? ' one-time' :
    plan.period === 'year'     ? '/yr' :
                                 '/mo';
  return { amount: `${sym}${plan.price}`, suffix };
}

/**
 * Post-signup plan picker. A plan selection is MANDATORY — there is no
 * skip path. The Continue button is disabled until the user picks a card.
 *
 *   /register  →  /select-plan?welcome=1  →  /checkout/:id
 *
 * Free plans still pass through /checkout so the same payment-confirm /
 * invoice / credit-event pipeline runs.
 */
export default function SelectPlanPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const welcome = params.get('welcome') === '1';

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    api.get('/plans')
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => toast.error('Could not load plans'));
  }, [user, loading, navigate, toast]);

  function continueWithSelected() {
    if (!selectedId) {
      toast.error('Please choose a plan to continue.');
      return;
    }
    setBusy(true);
    // Always go through checkout — free or paid. Keeps the invoice +
    // credit-event pipeline consistent.
    navigate(`/checkout/${encodeURIComponent(selectedId)}`);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/app" className="flex items-center gap-2 font-extrabold text-lg">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          DataVista
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-4 pb-32">
        <div className="text-center max-w-2xl mx-auto mb-10">
          {welcome && (
            <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
              <Check className="w-3 h-3" /> Account created — pick your plan
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">
            Choose your plan
          </h1>
          <p className="mt-3 text-ink-500 dark:text-ink-400 leading-relaxed">
            Plan selection is required to continue. You can change or cancel anytime.
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="card p-6 animate-pulse h-80" />)}
          </div>
        ) : (
          <div className={`grid gap-5 ${plans.length === 1 ? 'max-w-md mx-auto' : plans.length === 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {plans.map((plan, i) => {
              const Icon = iconFor(plan, i, plans.length);
              const price = priceLabel(plan);
              const isCurrent = user?.planId === plan._id || user?.planId?._id === plan._id;
              const highlighted = i === 1 && plans.length >= 3;
              const selected = selectedId === plan._id;
              return (
                <button
                  type="button"
                  key={plan._id}
                  onClick={() => setSelectedId(plan._id)}
                  className={`card p-6 flex flex-col relative text-left transition-all ${
                    selected
                      ? 'ring-2 ring-brand-500 shadow-xl shadow-brand-500/15 -translate-y-0.5'
                      : highlighted
                        ? 'ring-1 ring-brand-300/40 hover:ring-brand-500 hover:-translate-y-0.5'
                        : 'hover:ring-1 hover:ring-brand-300 hover:-translate-y-0.5'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {highlighted && !selected && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 text-white">
                      Most popular
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      highlighted || selected
                        ? 'bg-gradient-to-br from-brand-500 to-purple-500 text-white'
                        : 'bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-lg leading-tight">{plan.name}</div>
                      {plan.description && (
                        <div className="text-[11px] text-ink-500 leading-tight">{plan.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <div className="text-4xl font-extrabold tracking-tight">{price.amount}</div>
                    <div className="text-sm text-ink-500">{price.suffix}</div>
                  </div>
                  <ul className="space-y-2 text-sm flex-1">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>
                        {plan.credits === -1
                          ? 'Unlimited AI credits'
                          : <><strong>{plan.credits}</strong> AI credits</>}
                      </span>
                    </li>
                    {plan.dashboardLimit > 0 && (
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>Up to <strong>{plan.dashboardLimit}</strong> dashboards</span>
                      </li>
                    )}
                    {plan.features?.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent && (
                    <div className="mt-4 text-[11px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-ink-100 dark:bg-ink-800/60 text-ink-500 text-center">
                      Your current plan
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Sticky action bar — Continue is gated on selection */}
      <div className="fixed bottom-0 inset-x-0 border-t border-ink-200/60 dark:border-ink-800/60 bg-white/95 dark:bg-ink-950/95 backdrop-blur z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-ink-500">
            {selectedId
              ? <>Selected: <strong>{plans.find((p) => p._id === selectedId)?.name || ''}</strong></>
              : 'Select a plan to continue.'}
          </div>
          <button
            onClick={continueWithSelected}
            disabled={!selectedId || busy}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
