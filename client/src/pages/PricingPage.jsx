import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, Crown, Rocket, Zap } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Pick an icon per plan based on price tier — cheap = sparkles, mid = rocket,
// top = crown. Keeps the page visually structured without hard-coding plan IDs.
function iconFor(plan, index, total) {
  if (plan.price === 0) return Sparkles;
  if (index === total - 1) return Crown;
  return Rocket;
}

function formatPrice(plan) {
  if (plan.price === 0) return { amount: 'Free', suffix: '' };
  const amount = `${plan.currency === 'USD' ? '$' : ''}${plan.price}`;
  const suffix =
    plan.period === 'one_time' ? ' one-time' :
    plan.period === 'year'     ? '/yr' :
                                 '/mo';
  return { amount, suffix };
}

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState(null);

  useEffect(() => {
    api.get('/plans')
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => toast.error('Could not load plans'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function selectPlan(planId) {
    if (!user) {
      // Anonymous → land in register with the plan pre-selected.
      navigate(`/register?planId=${encodeURIComponent(planId)}`);
      return;
    }
    setSelectingId(planId);
    try {
      await api.post('/plans/me/select', { planId });
      toast.success('Plan updated');
      navigate('/app/settings?tab=plan');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not select plan');
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-lg">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          DataVista
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <Link to="/app" className="btn-secondary">Open app</Link>
          ) : (
            <>
              <Link to="/login" className="text-ink-500 hover:text-ink-900 dark:hover:text-ink-100">Sign in</Link>
              <Link to="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-8 pb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300 mb-3">
            <Sparkles className="w-3 h-3" /> Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            Plans that grow with you
          </h1>
          <p className="mt-4 text-ink-500 dark:text-ink-400 leading-relaxed">
            Pay only for the AI you use. Every plan includes unlimited dashboards from your own sheets — credits cover AI-powered generation.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card p-6 animate-pulse h-80" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="card p-10 text-center text-ink-500">
            No plans are currently published. Check back soon.
          </div>
        ) : (
          <div className={`grid gap-5 ${plans.length === 1 ? 'max-w-md mx-auto' : plans.length === 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {plans.map((plan, i) => {
              const Icon = iconFor(plan, i, plans.length);
              const price = formatPrice(plan);
              const isCurrent = user?.planId === plan._id || user?.planId?._id === plan._id;
              const highlighted = i === 1 && plans.length >= 3;
              return (
                <div
                  key={plan._id}
                  className={`card p-6 flex flex-col relative ${
                    highlighted
                      ? 'ring-2 ring-brand-500 shadow-xl shadow-brand-500/10'
                      : ''
                  }`}
                >
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 text-white">
                      Most popular
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      highlighted
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
                  <ul className="space-y-2 text-sm mb-6 flex-1">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>
                        {plan.credits === -1
                          ? 'Unlimited AI credits'
                          : plan.credits > 0
                            ? <><strong>{plan.credits}</strong> AI credits</>
                            : 'Pay-as-you-go credits'}
                      </span>
                    </li>
                    {plan.dashboardLimit > 0 && (
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>Up to <strong>{plan.dashboardLimit}</strong> dashboards</span>
                      </li>
                    )}
                    {plan.dashboardLimit === 0 && (
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>Unlimited dashboards</span>
                      </li>
                    )}
                    {plan.features?.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => selectPlan(plan._id)}
                    disabled={isCurrent || selectingId === plan._id}
                    className={`w-full justify-center inline-flex items-center gap-1.5 ${
                      isCurrent
                        ? 'btn-secondary cursor-default opacity-60'
                        : highlighted
                          ? 'btn-primary'
                          : 'btn-secondary'
                    }`}
                  >
                    {isCurrent
                      ? 'Current plan'
                      : selectingId === plan._id
                        ? 'Selecting…'
                        : user
                          ? plan.price > 0 ? 'Upgrade' : 'Switch'
                          : 'Get started'}
                    {!isCurrent && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-ink-500 mt-10">
          Need a custom plan or invoice billing? <a href="mailto:sales@datavista.app" className="underline">Contact sales</a>.
        </p>
      </section>
    </div>
  );
}
