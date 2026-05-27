import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon, KeyRound, Check, X, AlertCircle,
  Mail, Shield, Lock, User as UserIcon, CreditCard, Copy, Trash2, Bell, Download,
  RefreshCw, Users, Receipt, Sparkles,
} from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Pagination from '../components/ui/Pagination.jsx';

const SETTINGS_PAGE_SIZE = 5;

const TABS = [
  { key: 'profile',   label: 'Profile',     icon: UserIcon,   adminOnly: false },
  { key: 'plan',      label: 'Plan',        icon: CreditCard, adminOnly: false },
  { key: 'referrals', label: 'Referrals',   icon: Users,      adminOnly: false },
  { key: 'credits',   label: 'Credits',     icon: Sparkles,   adminOnly: false },
  { key: 'invoices',  label: 'Invoices',    icon: Receipt,    adminOnly: false },
  { key: 'users',     label: 'Users',       icon: Shield,     adminOnly: true  },
  { key: 'ai-keys',   label: 'API Keys',    icon: KeyRound,   adminOnly: false },
  { key: 'smtp',      label: 'Email (SMTP)',icon: Mail,       adminOnly: true  },
  { key: 'oauth',     label: 'OAuth',       icon: Lock,       adminOnly: true  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const initial = params.get('tab') || 'profile';
  const [tab, setTab] = useState(initial);
  const isSuper = user?.role === 'superadmin';

  // Filter tabs the current user is allowed to see.
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isSuper);

  function switchTab(key) {
    setTab(key);
    setParams({ tab: key }, { replace: true });
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">Settings</h1>
          <p className="text-sm text-ink-500 leading-tight mt-0.5">
            Manage your account, AI keys, email, and OAuth credentials.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
        {/* Left tabs */}
        <nav className="card p-2 h-min md:sticky md:top-20">
          <ul className="space-y-0.5">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <li key={t.key}>
                  <button
                    onClick={() => switchTab(t.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      active
                        ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                    {t.adminOnly && (
                      <span className="ml-auto text-[9px] uppercase tracking-wider font-bold px-1 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300">
                        Admin
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right content — one section visible at a time, no long stacking. */}
        <div className="min-w-0 space-y-4">
          {tab === 'profile'   && <ProfileTab toast={toast} />}
          {tab === 'plan'      && <PlanTab toast={toast} />}
          {tab === 'referrals' && <ReferralsTab toast={toast} />}
          {tab === 'credits'   && <CreditHistorySection toast={toast} />}
          {tab === 'invoices'  && <InvoicesSection toast={toast} />}
          {tab === 'users'     && isSuper && <AdminPlanTable toast={toast} />}
          {tab === 'ai-keys'   && <AiKeysSection toast={toast} />}
          {tab === 'smtp'      && isSuper && <SmtpSection toast={toast} />}
          {tab === 'oauth'     && isSuper && <OauthSection toast={toast} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Profile ─────────────────────────────────────────────────────────── */

/* ─── Profile tab — profile form + danger zone ──────────────────────── */

function ProfileTab({ toast }) {
  return (
    <>
      <ProfileSection toast={toast} />
      <DangerZone toast={toast} />
    </>
  );
}

/* ─── Plan tab — plan card only (no referrals/credits/invoices stacking) */

function PlanTab({ toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/plans/me')
      .then(({ data }) => setData(data))
      .catch((err) => toast.error(err?.response?.data?.error || 'Could not load plan'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <section className="card p-5 animate-pulse h-40" />;
  if (!data) return null;

  const expiresAt = data.planExpiresAt ? new Date(data.planExpiresAt) : null;
  const expired = expiresAt && expiresAt.getTime() < Date.now();
  const expiringSoon = !expired && Number.isFinite(data.daysRemaining) && data.daysRemaining <= 7;
  const planName = data.plan?.name || 'No plan';
  const credits = data.credits ?? 0;

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-ink-500" />
        <h2 className="font-semibold">Current plan</h2>
      </div>

      <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Plan</div>
          <div className="font-bold text-lg">{planName}</div>
          {data.plan && (
            <div className="text-xs text-ink-500">
              {data.plan.price === 0
                ? 'Free tier'
                : `${data.plan.currency === 'USD' ? '$' : ''}${data.plan.price}/${data.plan.period === 'one_time' ? 'one-time' : data.plan.period}`}
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Credits</div>
          <div className={`font-bold text-lg ${credits === 0 && data.plan?.credits !== -1 ? 'text-rose-500' : ''}`}>
            {data.plan?.credits === -1 ? '∞ Unlimited' : credits}
          </div>
          <div className="text-xs text-ink-500">1 credit = 1 AI dashboard</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Expires</div>
          <div className={`font-bold text-lg ${expired ? 'text-rose-500' : expiringSoon ? 'text-amber-500' : ''}`}>
            {expiresAt ? expiresAt.toLocaleDateString() : '—'}
          </div>
          {expired && <div className="text-xs text-rose-500">Plan expired — please renew</div>}
          {expiringSoon && <div className="text-xs text-amber-500">Expiring soon</div>}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Days left</div>
          <div className={`font-bold text-lg ${expired ? 'text-rose-500' : expiringSoon ? 'text-amber-500' : ''}`}>
            {Number.isFinite(data.daysRemaining) ? data.daysRemaining : '—'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-end">
        {data.plan?._id && data.plan?.price > 0 && (
          <Link to={`/checkout/${data.plan._id}`} className="btn-secondary inline-flex items-center gap-1.5">
            Renew {data.plan.name}
          </Link>
        )}
        <Link to="/pricing" className="btn-primary inline-flex items-center gap-1.5">
          {data.plan?.price > 0 ? 'Upgrade or change plan' : 'Upgrade'}
        </Link>
      </div>
    </section>
  );
}

/* ─── Referrals tab — code, regenerate, who used it ──────────────────── */

function ReferralsTab({ toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenBusy, setRegenBusy] = useState(false);

  const reload = () => api.get('/plans/me').then(({ data }) => setData(data));

  useEffect(() => {
    reload()
      .catch((err) => toast.error(err?.response?.data?.error || 'Could not load referral info'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function regenerate() {
    if (!window.confirm('Regenerate your referral code? The current code will stop working immediately.')) return;
    setRegenBusy(true);
    try {
      await api.post('/plans/me/regenerate-code');
      await reload();
      toast.success('New referral code generated');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not regenerate');
    } finally {
      setRegenBusy(false);
    }
  }

  function copy(value) {
    if (!value) return;
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        toast.success('Copied');
      } catch { toast.error('Copy failed'); }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => toast.success('Copied'), fallback);
    } else fallback();
  }

  if (loading) return <section className="card p-5 animate-pulse h-32" />;
  if (!data) return null;

  const refCodeExpiresAt = data.referralCodeExpiresAt ? new Date(data.referralCodeExpiresAt) : null;
  const link = data.referralCode ? `${window.location.origin}/register?ref=${encodeURIComponent(data.referralCode)}` : '';

  return (
    <>
      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Referral program</h2>
          <p className="text-[13px] text-ink-500 leading-relaxed">
            Share your link. You and the friend each get <strong>10 bonus credits</strong> when they sign up.
            Codes expire <strong>30 days after signup</strong>.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Your referral code</div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-base font-bold tracking-wide truncate">{data.referralCode || '—'}</div>
              {data.referralCode && (
                <button type="button" onClick={() => copy(data.referralCode)} className="btn-ghost p-1.5" title="Copy code">
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Signups so far</div>
            <div className="font-bold text-lg">{data.referralCount ?? 0}</div>
          </div>
          <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Code valid until</div>
            <div className={`font-bold text-sm ${data.referralCodeExpired ? 'text-rose-500' : ''}`}>
              {refCodeExpiresAt ? refCodeExpiresAt.toLocaleDateString() : '—'}
            </div>
            {data.referralCodeExpired && <div className="text-[11px] text-rose-500 mt-0.5">Code expired</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            onClick={regenerate}
            disabled={regenBusy}
            className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
            title="Generate a new code (the old one stops working)"
          >
            <RefreshCw className={`w-4 h-4 ${regenBusy ? 'animate-spin' : ''}`} />
            {regenBusy ? 'Regenerating…' : 'Regenerate code'}
          </button>
          <button
            onClick={() => copy(link)}
            disabled={data.referralCodeExpired || !link}
            className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Copy className="w-4 h-4" /> Copy referral link
          </button>
        </div>
      </section>

      <ReferralsTableSection toast={toast} />
    </>
  );
}

function ProfileSection({ toast }) {
  const { user, refresh } = useAuth();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    setAvatar(user?.avatar || '');
    setNameError('');
  }, [user?._id]);

  function validate() {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Display name is required.'); return false; }
    if (trimmed.length > 80) { setNameError('Display name must be 80 characters or less.'); return false; }
    setNameError('');
    return true;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.patch('/auth/profile', { name: name.trim(), avatar });
      await refresh?.();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  function onAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error('Avatar must be under 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserIcon className="w-4 h-4 text-ink-500" />
        <h2 className="font-semibold">Profile</h2>
      </div>

      <div className="flex items-center gap-4">
        {avatar ? (
          <img src={avatar} alt="" className="w-16 h-16 rounded-xl object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 text-white text-xl font-bold flex items-center justify-center">
            {(name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U'}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="btn-secondary cursor-pointer text-xs">
            Upload image
            <input type="file" accept="image/*" className="hidden" onChange={onAvatarFile} />
          </label>
          {avatar && (
            <button onClick={() => setAvatar('')} className="btn-ghost text-[11px] text-rose-500">
              Remove
            </button>
          )}
        </div>
      </div>

      <Field label="Display name *">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
          onBlur={validate}
          maxLength={80}
          className={`input w-full ${nameError ? 'border-rose-500 focus:border-rose-500' : ''}`}
        />
        {nameError && (
          <div className="mt-1 flex items-start gap-1 text-[12px] text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {nameError}
          </div>
        )}
      </Field>

      <Field label="Email">
        <input type="email" value={user?.email || ''} disabled className="input w-full opacity-60 cursor-not-allowed" />
        <div className="text-[11px] text-ink-500 mt-1">Email is the canonical account identifier and can't be changed here.</div>
      </Field>

      <div className="flex justify-end">
        <button onClick={save} className="btn-primary" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </section>
  );
}

/* ─── Plan & credits ─────────────────────────────────────────────────── */

function PlanSection({ toast }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenBusy, setRegenBusy] = useState(false);
  const isSuper = user?.role === 'superadmin';

  function reload() {
    return api.get('/plans/me').then(({ data }) => setData(data));
  }

  useEffect(() => {
    reload()
      .catch((err) => toast.error(err?.response?.data?.error || 'Could not load plan'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function regenerateCode() {
    if (!window.confirm('Regenerate your referral code? The current code will stop working immediately.')) return;
    setRegenBusy(true);
    try {
      await api.post('/plans/me/regenerate-code');
      await reload();
      toast.success('New referral code generated');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not regenerate');
    } finally {
      setRegenBusy(false);
    }
  }

  function copyValue(value, kind = 'link') {
    if (!value) return;
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast.success('Copied');
      } catch {
        toast.error('Copy failed');
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => toast.success('Copied'),
        () => fallback(),
      );
    } else {
      fallback();
    }
  }

  function copyReferralCode() {
    copyValue(data?.referralCode, 'code');
  }

  function copyReferralLink() {
    if (!data?.referralCode) return;
    const url = `${window.location.origin}/register?ref=${encodeURIComponent(data.referralCode)}`;
    copyValue(url, 'link');
  }

  if (loading) return <section className="card p-5 animate-pulse h-40" />;
  if (!data) return null;

  const expiresAt = data.planExpiresAt ? new Date(data.planExpiresAt) : null;
  const expired = expiresAt && expiresAt.getTime() < Date.now();
  const expiringSoon = !expired && Number.isFinite(data.daysRemaining) && data.daysRemaining <= 7;
  const planName = data.plan?.name || 'No plan';
  const credits = data.credits ?? 0;
  const refCodeExpiresAt = data.referralCodeExpiresAt ? new Date(data.referralCodeExpiresAt) : null;

  return (
    <div className="space-y-4">
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-ink-500" />
          <h2 className="font-semibold">Current plan</h2>
        </div>

        <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Plan</div>
            <div className="font-bold text-lg">{planName}</div>
            {data.plan && (
              <div className="text-xs text-ink-500">
                {data.plan.price === 0
                  ? 'Free tier'
                  : `${data.plan.currency === 'USD' ? '$' : ''}${data.plan.price}/${data.plan.period === 'one_time' ? 'one-time' : data.plan.period}`}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Credits</div>
            <div className={`font-bold text-lg ${credits === 0 && data.plan?.credits !== -1 ? 'text-rose-500' : ''}`}>
              {data.plan?.credits === -1 ? '∞ Unlimited' : credits}
            </div>
            <div className="text-xs text-ink-500">1 credit = 1 AI dashboard</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Expires</div>
            <div className={`font-bold text-lg ${expired ? 'text-rose-500' : expiringSoon ? 'text-amber-500' : ''}`}>
              {expiresAt ? expiresAt.toLocaleDateString() : '—'}
            </div>
            {expired && <div className="text-xs text-rose-500">Plan expired — please renew</div>}
            {expiringSoon && <div className="text-xs text-amber-500">Expiring soon</div>}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Days left</div>
            <div className={`font-bold text-lg ${expired ? 'text-rose-500' : expiringSoon ? 'text-amber-500' : ''}`}>
              {Number.isFinite(data.daysRemaining) ? data.daysRemaining : '—'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {data.plan?._id && data.plan?.price > 0 && (
            <Link to={`/checkout/${data.plan._id}`} className="btn-secondary inline-flex items-center gap-1.5">
              Renew {data.plan.name}
            </Link>
          )}
          <Link to="/pricing" className="btn-primary inline-flex items-center gap-1.5">
            {data.plan?.price > 0 ? 'Upgrade or change plan' : 'Upgrade'}
          </Link>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Referral program</h2>
          <p className="text-[13px] text-ink-500 leading-relaxed">
            Share your link. You and the friend each get <strong>10 bonus credits</strong> when they sign up.
            Codes expire <strong>30 days after signup</strong>.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Your referral code</div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-base font-bold tracking-wide truncate">{data.referralCode || '—'}</div>
              {data.referralCode && (
                <button
                  type="button"
                  onClick={copyReferralCode}
                  className="btn-ghost p-1.5"
                  title="Copy code"
                  aria-label="Copy referral code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Signups so far</div>
            <div className="font-bold text-lg">{data.referralCount ?? 0}</div>
          </div>
          <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">Code valid until</div>
            <div className={`font-bold text-sm ${data.referralCodeExpired ? 'text-rose-500' : ''}`}>
              {refCodeExpiresAt ? refCodeExpiresAt.toLocaleDateString() : '—'}
            </div>
            {data.referralCodeExpired && <div className="text-[11px] text-rose-500 mt-0.5">Code expired</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            onClick={regenerateCode}
            disabled={regenBusy}
            className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
            title="Generate a new code (the old one stops working)"
          >
            <RefreshCw className={`w-4 h-4 ${regenBusy ? 'animate-spin' : ''}`} />
            {regenBusy ? 'Regenerating…' : 'Regenerate code'}
          </button>
          <button
            onClick={copyReferralLink}
            disabled={data.referralCodeExpired}
            className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Copy className="w-4 h-4" /> Copy referral link
          </button>
        </div>
      </section>

      <ReferralsTableSection toast={toast} />

      <CreditHistorySection toast={toast} planCredits={data.plan?.credits} />

      <InvoicesSection toast={toast} />

      {isSuper && <AdminPlanTable toast={toast} />}

      <DangerZone toast={toast} />
    </div>
  );
}

/**
 * "Who used your code" — one row per redemption of the user's referral
 * code, newest first. Always rendered (with an empty-state hint) so the
 * user can see the program is wired up even before anyone has joined.
 */
function ReferralsTableSection({ toast }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/plans/me/referrals')
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Could not load referrals'));
  }, [toast]);

  if (data === null) return <section className="card p-5 animate-pulse h-32" />;

  const list = data.referrals || [];
  const totalPages = Math.max(1, Math.ceil(list.length / SETTINGS_PAGE_SIZE));
  const visible = list.slice((page - 1) * SETTINGS_PAGE_SIZE, page * SETTINGS_PAGE_SIZE);

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-2">
        <Users className="w-4 h-4 text-ink-500" />
        <h2 className="font-semibold">People who used your code</h2>
        <span className="ml-auto text-[11px] text-ink-500">
          Earned <strong className="text-emerald-600 dark:text-emerald-400">+{data.totalEarned || 0}</strong> credits
        </span>
      </div>
      {list.length === 0 ? (
        <div className="p-5 text-sm text-ink-500">
          No referrals yet. Share your code or referral link — every successful signup adds <strong>10 credits</strong> to your balance.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead className="bg-ink-50 dark:bg-ink-800/30">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold">Email</th>
                <th className="text-left px-4 py-2.5 font-semibold">Code used</th>
                <th className="text-right px-4 py-2.5 font-semibold">Credits</th>
                <th className="text-left px-4 py-2.5 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                  <td className="px-4 py-2 font-medium">{r.referredUserId?.name || '—'}</td>
                  <td className="px-4 py-2 text-ink-500">{r.referredUserId?.email || '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.referralCode}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{r.creditsGiven}
                  </td>
                  <td className="px-4 py-2 text-ink-500 text-xs">{new Date(r.usedAt || r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Credit ledger view. Shows totals (earned / used / current) and the
 * paginated history of every credit-changing event. Refreshes on mount —
 * the page is reached via a SPA navigation after every plan/payment/AI
 * action, so this is always recent.
 */
function CreditHistorySection({ toast, planCredits }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/plans/me/credit-history?limit=100')
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Could not load credit history'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <section className="card p-5 animate-pulse h-32" />;
  if (!data) return null;

  const earned = data.totals?.earned ?? 0;
  const used = data.totals?.used ?? 0;
  const events = data.events || [];
  const totalPages = Math.max(1, Math.ceil(events.length / SETTINGS_PAGE_SIZE));
  const visible = events.slice((page - 1) * SETTINGS_PAGE_SIZE, page * SETTINGS_PAGE_SIZE);

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-ink-500" />
        <h2 className="font-semibold">Credit history</h2>
      </div>
      <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-ink-200/60 dark:border-ink-800/60 text-center">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500">Earned</div>
          <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">+{earned}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500">Used</div>
          <div className="font-bold text-lg text-rose-600 dark:text-rose-400">−{used}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500">Balance</div>
          <div className="font-bold text-lg">{planCredits === -1 ? '∞' : Math.max(0, earned - used)}</div>
        </div>
      </div>
      {events.length === 0 ? (
        <div className="p-5 text-sm text-ink-500">No credit activity yet. Generate an AI dashboard or refer a friend to see your ledger here.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead className="bg-ink-50 dark:bg-ink-800/30">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Action</th>
                  <th className="text-right px-4 py-2 font-semibold">Amount</th>
                  <th className="text-right px-4 py-2 font-semibold">Balance</th>
                  <th className="text-left px-4 py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                    <td className="px-4 py-2">{e.action}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${e.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {e.amount >= 0 ? `+${e.amount}` : e.amount}
                    </td>
                    <td className="px-4 py-2 text-right text-ink-500">{Number.isFinite(e.balanceAfter) ? e.balanceAfter : '—'}</td>
                    <td className="px-4 py-2 text-ink-500 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-3">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </section>
  );
}

/**
 * One row per successful payment, newest first. The download endpoint
 * returns a printable HTML invoice with Content-Disposition: attachment.
 */
function InvoicesSection({ toast }) {
  const [invoices, setInvoices] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/payments/invoices')
      .then(({ data }) => setInvoices(data.invoices || []))
      .catch(() => toast.error('Could not load invoices'));
  }, [toast]);

  function downloadHref(id) {
    const token = localStorage.getItem('sf_token') || '';
    // The download endpoint requires auth — we route through a fresh fetch
    // so the Authorization header travels with the request, then save the
    // returned Blob via a temporary anchor.
    return async (e) => {
      e.preventDefault();
      try {
        const r = await fetch(`/api/payments/invoices/${id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const blob = await r.blob();
        const cd = r.headers.get('Content-Disposition') || '';
        const m = /filename="([^"]+)"/.exec(cd);
        const filename = m ? m[1] : `invoice-${id}.html`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        toast.error('Could not download invoice');
      }
    };
  }

  if (invoices === null) return <section className="card p-5 animate-pulse h-32" />;

  const totalPages = Math.max(1, Math.ceil(invoices.length / SETTINGS_PAGE_SIZE));
  const visibleInvoices = invoices.slice((page - 1) * SETTINGS_PAGE_SIZE, page * SETTINGS_PAGE_SIZE);

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-ink-500" />
        <h2 className="font-semibold">Invoices</h2>
      </div>
      {invoices.length === 0 ? (
        <div className="p-5 text-sm text-ink-500">No invoices yet. Invoices are issued automatically after every successful payment.</div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead className="bg-ink-50 dark:bg-ink-800/30">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Invoice #</th>
                <th className="text-left px-4 py-2.5 font-semibold">Plan</th>
                <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
                <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((inv) => (
                <tr key={inv._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                  <td className="px-4 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2">{inv.planName}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {inv.amount === 0
                      ? 'Free'
                      : `${inv.currency === 'USD' ? '$' : ''}${inv.amount.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-2 text-ink-500 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/api/payments/invoices/${inv._id}/download`}
                      onClick={downloadHref(inv._id)}
                      className="btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
        </>
      )}
    </section>
  );
}

/**
 * Superadmin-only block: lists every user's plan + days-remaining and a
 * "Send Reminder" button that fires the expiry-reminder email via
 * POST /api/admin/send-reminder/:userId.
 */
function AdminPlanTable({ toast }) {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/admin/users')
      .then(({ data }) => setRows(data.users || []))
      .catch(() => toast.error('Could not load users'));
  }, [toast]);

  async function remind(userId) {
    setBusyId(userId);
    try {
      const { data } = await api.post(`/admin/send-reminder/${encodeURIComponent(userId)}`);
      toast.success(`Reminder sent to ${data.sentTo}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not send reminder');
    } finally {
      setBusyId(null);
    }
  }

  function daysLeft(expiresAt) {
    if (!expiresAt) return null;
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
  }

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-2">
        <Shield className="w-4 h-4 text-purple-500" />
        <h2 className="font-semibold">All users — plan & expiry</h2>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 ml-1">
          Superadmin
        </span>
      </div>
      {rows === null ? (
        <div className="p-5 animate-pulse">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-5 text-sm text-ink-500">No users yet.</div>
      ) : (() => {
        const totalPages = Math.max(1, Math.ceil(rows.length / SETTINGS_PAGE_SIZE));
        const visible = rows.slice((page - 1) * SETTINGS_PAGE_SIZE, page * SETTINGS_PAGE_SIZE);
        return (
        <>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead className="bg-ink-50 dark:bg-ink-800/30">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold">Email</th>
                <th className="text-left px-4 py-2.5 font-semibold">Plan</th>
                <th className="text-left px-4 py-2.5 font-semibold">Expiry</th>
                <th className="text-left px-4 py-2.5 font-semibold">Days left</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const days = daysLeft(u.planExpiresAt);
                const expired = days !== null && days === 0;
                const expiringSoon = days !== null && days > 0 && days <= 7;
                return (
                  <tr key={u._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                    <td className="px-4 py-2 font-medium">{u.name}</td>
                    <td className="px-4 py-2 text-ink-500">{u.email}</td>
                    <td className="px-4 py-2">{u.planId?.name || '—'}</td>
                    <td className="px-4 py-2 text-xs">
                      {u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className={`px-4 py-2 font-semibold ${expired ? 'text-rose-500' : expiringSoon ? 'text-amber-500' : ''}`}>
                      {days === null ? '—' : days}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => remind(u._id)}
                        disabled={busyId === u._id || !u.planExpiresAt}
                        className="btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5"
                        title={u.planExpiresAt ? 'Send expiry reminder' : 'No plan expiry to remind about'}
                      >
                        <Bell className="w-3.5 h-3.5" />
                        {busyId === u._id ? 'Sending…' : 'Send Reminder'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
        </>
        );
      })()}
    </section>
  );
}

function DangerZone({ toast }) {
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setBusy(true);
    try {
      await api.delete('/auth/account');
      // logout() clears the token and hard-redirects to '/', so anything
      // after this line won't run — no need to reset busy.
      logout?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not delete');
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 border-rose-500/30">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="w-4 h-4 text-rose-500" />
        <h2 className="font-semibold text-rose-600 dark:text-rose-400">Delete account</h2>
      </div>
      <p className="text-[13px] text-ink-500 leading-relaxed mb-3">
        Permanently removes your account, workspace, sheets, dashboards, templates, and shares. This cannot be undone.
      </p>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="btn-secondary text-rose-600 dark:text-rose-400">
          Delete my account…
        </button>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-ink-600 dark:text-ink-300">
            Type <span className="font-mono font-bold">DELETE</span> to confirm.
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              className="input flex-1 min-w-[180px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="DELETE"
            />
            <button onClick={() => { setConfirming(false); setText(''); }} className="btn-secondary" disabled={busy}>
              Cancel
            </button>
            <button
              onClick={deleteAccount}
              disabled={text !== 'DELETE' || busy}
              className="btn-primary bg-rose-500 hover:bg-rose-600"
            >
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── AI Keys ─────────────────────────────────────────────────────────── */

function AiKeysSection({ toast }) {
  const { user, refresh } = useAuth();
  const [openaiKey, setOpenaiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setOpenaiKey(''); setClaudeKey(''); }, [user?._id]);

  const hasOpenai = Boolean(user?.aiKeys?.hasOpenai);
  const hasClaude = Boolean(user?.aiKeys?.hasClaude);

  async function save(payload, msg) {
    setSaving(true);
    try {
      await api.patch('/auth/api-keys', payload);
      await refresh?.();
      toast.success(msg);
      setOpenaiKey(''); setClaudeKey('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-ink-500" />
          <h2 className="font-semibold">AI provider keys</h2>
        </div>
        <p className="text-[13px] text-ink-500 leading-relaxed">
          Your keys are encrypted at rest. Each request uses your own key — never a shared one.
        </p>
      </div>

      <KeyRow
        label="OpenAI API Key" placeholder="sk-…"
        configured={hasOpenai} value={openaiKey} onChange={setOpenaiKey}
        onSave={() => save({ openai: openaiKey }, 'OpenAI key saved')}
        onClear={() => save({ openai: '' }, 'OpenAI key removed')}
        saving={saving}
      />
      <KeyRow
        label="Claude (Anthropic) API Key" placeholder="sk-ant-…"
        configured={hasClaude} value={claudeKey} onChange={setClaudeKey}
        onSave={() => save({ claude: claudeKey }, 'Claude key saved')}
        onClear={() => save({ claude: '' }, 'Claude key removed')}
        saving={saving}
      />

      {!hasOpenai && !hasClaude && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>Add at least one provider key to unlock AI features.</div>
        </div>
      )}
    </section>
  );
}

function KeyRow({ label, placeholder, configured, value, onChange, onSave, onClear, saving }) {
  return (
    <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="font-medium text-sm">{label}</div>
        <div className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
          configured ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                     : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
        }`}>
          {configured ? <><Check className="w-3 h-3" /> Configured</> : <><X className="w-3 h-3" /> Not set</>}
        </div>
      </div>
      <div className="flex gap-2 items-stretch flex-wrap sm:flex-nowrap">
        <input
          type="password" autoComplete="off" spellCheck={false}
          placeholder={configured ? 'Enter a new key to replace…' : placeholder}
          value={value} onChange={(e) => onChange(e.target.value)}
          className="input flex-1 min-w-0"
        />
        <button onClick={onSave} disabled={saving || !value.trim()} className="btn-primary">
          {configured ? 'Replace' : 'Save'}
        </button>
        {configured && (
          <button onClick={onClear} disabled={saving} className="btn-secondary" title="Remove this key">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── SMTP ────────────────────────────────────────────────────────────── */

function SmtpSection({ toast }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/system-settings')
      .then(({ data }) => setSettings(data.settings))
      .catch((err) => toast.error(err?.response?.data?.error || 'Could not load'))
      .finally(() => setLoading(false));
  }, [toast]);

  function save() {
    setSaving(true);
    api.patch('/admin/system-settings', { smtp: form })
      .then(({ data }) => { setSettings(data.settings); setForm({}); toast.success('SMTP settings saved'); })
      .catch((err) => toast.error(err?.response?.data?.error || 'Save failed'))
      .finally(() => setSaving(false));
  }

  if (loading) return <section className="card p-5 animate-pulse h-40" />;
  if (!settings) return null;

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-ink-500" />
        <h2 className="font-semibold">Email (SMTP)</h2>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 ml-2">
          <Shield className="w-3 h-3 inline -mt-0.5" /> Superadmin
        </span>
      </div>
      <p className="text-[13px] text-ink-500 leading-relaxed">
        Used for welcome + password-reset emails. Stored encrypted at rest. Changes apply on the next send.
      </p>

      <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Gmail:</strong> regular passwords don't work — generate an App Password at <span className="font-mono">myaccount.google.com/apppasswords</span> (requires 2-Step Verification). Otherwise SMTP returns <span className="font-mono">535 Username and Password not accepted</span>.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="SMTP host" hint={settings.smtp.hasHost ? 'Configured · enter a new value to replace' : ''}>
          <input type="text" placeholder="smtp.gmail.com"
            value={form.host || ''} onChange={(e) => setForm({ ...form, host: e.target.value })}
            className="input w-full" autoComplete="off" />
        </Field>
        <Field label="SMTP port">
          <input type="number" placeholder={String(settings.smtp.port || 587)}
            value={form.port || ''} onChange={(e) => setForm({ ...form, port: e.target.value })}
            className="input w-full" />
        </Field>
        <Field label="SMTP username" hint={settings.smtp.hasUser ? 'Configured · enter a new value to replace' : ''}>
          <input type="text" placeholder="you@gmail.com"
            value={form.user || ''} onChange={(e) => setForm({ ...form, user: e.target.value })}
            className="input w-full" autoComplete="off" />
        </Field>
        <Field label="SMTP password (or App Password)" hint={settings.smtp.hasPass ? 'Configured · enter a new value to replace' : ''}>
          <input type="password" placeholder="••••••••"
            value={form.pass || ''} onChange={(e) => setForm({ ...form, pass: e.target.value })}
            className="input w-full" autoComplete="off" />
        </Field>
        <Field label="From email">
          <input type="email" placeholder={settings.smtp.fromEmail || 'no-reply@example.com'}
            value={form.fromEmail ?? settings.smtp.fromEmail ?? ''}
            onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
            className="input w-full" />
        </Field>
        <Field label="From name">
          <input type="text" placeholder={settings.smtp.fromName || 'SheetFlow'}
            value={form.fromName ?? settings.smtp.fromName ?? ''}
            onChange={(e) => setForm({ ...form, fromName: e.target.value })}
            className="input w-full" />
        </Field>
      </div>
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-ink-600 dark:text-ink-300">
          <input type="checkbox"
            checked={form.secure ?? settings.smtp.secure}
            onChange={(e) => setForm({ ...form, secure: e.target.checked })} />
          Use TLS / SSL (port 465)
        </label>
        <div className="flex-1" />
        <button onClick={save} className="btn-primary" disabled={saving}>Save SMTP</button>
      </div>
    </section>
  );
}

/* ─── OAuth ───────────────────────────────────────────────────────────── */

function OauthSection({ toast }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/system-settings')
      .then(({ data }) => setSettings(data.settings))
      .catch((err) => toast.error(err?.response?.data?.error || 'Could not load'))
      .finally(() => setLoading(false));
  }, [toast]);

  function save() {
    setSaving(true);
    api.patch('/admin/system-settings', { oauth: form })
      .then(({ data }) => { setSettings(data.settings); setForm({}); toast.success('OAuth credentials saved — restart the server for changes to take effect.'); })
      .catch((err) => toast.error(err?.response?.data?.error || 'Save failed'))
      .finally(() => setSaving(false));
  }

  if (loading) return <section className="card p-5 animate-pulse h-40" />;
  if (!settings) return null;

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-ink-500" />
        <h2 className="font-semibold">OAuth credentials</h2>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 ml-2">
          <Shield className="w-3 h-3 inline -mt-0.5" /> Superadmin
        </span>
      </div>
      <p className="text-[13px] text-ink-500 leading-relaxed">
        Google + Facebook OAuth client credentials. <strong>Server restart required</strong> after changes for the OAuth strategies to pick them up.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Google Client ID" hint={settings.oauth.hasGoogle ? 'Configured' : 'Not set'}>
          <input type="text" placeholder="…apps.googleusercontent.com"
            value={form.googleClientId || ''} onChange={(e) => setForm({ ...form, googleClientId: e.target.value })}
            className="input w-full" autoComplete="off" />
        </Field>
        <Field label="Google Client Secret">
          <input type="password" placeholder="••••••••"
            value={form.googleClientSecret || ''} onChange={(e) => setForm({ ...form, googleClientSecret: e.target.value })}
            className="input w-full" autoComplete="off" />
        </Field>
        <Field label="Facebook App ID" hint={settings.oauth.hasFacebook ? 'Configured' : 'Not set'}>
          <input type="text" placeholder="1234567890"
            value={form.facebookAppId || ''} onChange={(e) => setForm({ ...form, facebookAppId: e.target.value })}
            className="input w-full" autoComplete="off" />
        </Field>
        <Field label="Facebook App Secret">
          <input type="password" placeholder="••••••••"
            value={form.facebookAppSecret || ''} onChange={(e) => setForm({ ...form, facebookAppSecret: e.target.value })}
            className="input w-full" autoComplete="off" />
        </Field>
      </div>
      <div className="flex items-center justify-end">
        <button onClick={save} className="btn-primary" disabled={saving}>Save OAuth</button>
      </div>
    </section>
  );
}

/* ─── Shared field ────────────────────────────────────────────────────── */

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-ink-500 mt-1">{hint}</div>}
    </label>
  );
}
