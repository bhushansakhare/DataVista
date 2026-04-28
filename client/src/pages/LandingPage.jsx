import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Sparkles, ArrowRight, Play, Star, Shield, Globe2, CheckCircle2,
  Brain, BarChart3, Workflow, Users, Plug, Lock, UploadCloud, FileText,
  Filter, Layers,
  Rocket, Building2, Code2, Briefcase, ShoppingCart,
  ChevronDown, MessageSquare, Mail,
  Twitter, Github, Linkedin, Youtube,
  Check, Sun, Moon, Menu, X,
  Database, MapPin, TrendingUp, Quote,
} from 'lucide-react';
import ChartRenderer from '../components/charts/ChartRenderer.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const SAMPLE = [
  { month: 'Jan', sales: 220, returns: 30 },
  { month: 'Feb', sales: 310, returns: 45 },
  { month: 'Mar', sales: 290, returns: 40 },
  { month: 'Apr', sales: 410, returns: 55 },
  { month: 'May', sales: 520, returns: 60 },
  { month: 'Jun', sales: 480, returns: 50 },
  { month: 'Jul', sales: 610, returns: 70 },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 selection:bg-brand-500/30">
      <Backdrop />
      <Nav />
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <ProductPreview />
      <UseCases />
      <Stats />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ─────────────── animated backdrop ─────────────── */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-brand-500/30 blur-[120px] animate-pulse" />
      <div className="absolute top-1/3 -right-24 w-[480px] h-[480px] rounded-full bg-purple-500/25 blur-[120px] animate-pulse [animation-delay:1.5s]" />
      <div className="absolute bottom-0 left-1/3 w-[600px] h-[600px] rounded-full bg-pink-500/15 blur-[140px] animate-pulse [animation-delay:3s]" />
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,1) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
    </div>
  );
}

/* ─────────────── nav ─────────────── */
function Nav() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const links = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#use-cases', label: 'Use cases' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-ink-950/70 border-b border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shadow-ring">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">SheetFlow</span>
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-md">
            AI
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-ink-600 dark:text-ink-300">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-ink-900 dark:hover:text-white transition">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={toggle} className="btn-ghost p-2" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
          <Link to="/register" className="btn-primary">
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            className="btn-ghost p-2 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-ink-200/60 dark:border-ink-800/60"
          >
            <div className="px-5 py-3 flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-sm"
                >
                  {l.label}
                </a>
              ))}
              <Link to="/login" className="px-3 py-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-sm">
                Sign in
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ─────────────── hero ─────────────── */
function Hero() {
  return (
    <section className="relative">
      <div className="max-w-7xl mx-auto px-5 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
            </span>
            Now with AI Auto-Dashboard
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
          >
            Build, automate &amp; scale your business with{' '}
            <span className="bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              AI intelligence
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="mt-6 text-lg md:text-xl text-ink-600 dark:text-ink-300 max-w-2xl mx-auto leading-relaxed"
          >
            SheetFlow turns any Google Sheet into a live, AI-powered analytics dashboard in seconds.
            12 chart types, real-time sync, multi-tenant workspaces — no code, no spreadsheets full of formulas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
            className="mt-9 flex items-center justify-center gap-3 flex-wrap"
          >
            <Link to="/register" className="btn-primary text-base px-6 py-3">
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#preview" className="btn-secondary text-base px-6 py-3">
              <Play className="w-4 h-4" /> Request demo
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="mt-8 flex items-center justify-center gap-4 flex-wrap text-sm text-ink-500"
          >
            <div className="flex -space-x-2">
              {['#6366f1', '#a855f7', '#ec4899', '#22c55e', '#f59e0b'].map((c, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white dark:border-ink-950" style={{ background: c }} />
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 stroke-amber-400" />
              ))}
              <span className="ml-2 font-semibold text-ink-700 dark:text-ink-200">4.9 / 5</span>
            </div>
            <span>Trusted by 10,000+ teams worldwide</span>
          </motion.div>
        </div>

        {/* product preview */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-16 mx-auto max-w-6xl"
          id="preview"
        >
          <div className="relative">
            <div className="absolute inset-0 -m-2 rounded-3xl bg-gradient-to-br from-brand-500/30 via-purple-500/20 to-pink-500/20 blur-2xl" />
            <div className="relative card p-2 md:p-3 shadow-glass">
              <div className="rounded-xl bg-gradient-to-br from-ink-50 to-white dark:from-ink-900 dark:to-ink-950 p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Stat label="Total revenue" value="$2.84M" delta="+12.4%" up />
                  <Stat label="Active users" value="48,219" delta="+3.1%" up />
                  <Stat label="Conversion" value="6.7%" delta="-0.4%" />
                  <Stat label="Avg session" value="4m 12s" delta="+8.2%" up />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="card p-4 md:col-span-2">
                    <div className="text-xs label mb-2">Sales trend · last 7 months</div>
                    <ChartRenderer chart={{ type: 'area', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={200} />
                  </div>
                  <div className="card p-4">
                    <div className="text-xs label mb-2">Channel split</div>
                    <ChartRenderer chart={{ type: 'donut', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={200} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ label, value, delta, up }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className={`text-xs mt-1 font-semibold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>{delta}</div>
    </div>
  );
}

/* ─────────────── trust strip ─────────────── */
function TrustStrip() {
  const logos = [
    'Stripe', 'Notion', 'Vercel', 'Linear', 'Airbnb', 'Spotify',
    'Figma', 'Slack', 'GitHub', 'Datadog', 'Discord', 'Shopify',
  ];
  const metrics = [
    { value: '99.99%', label: 'Uptime SLA' },
    { value: '10M+', label: 'Rows processed daily' },
    { value: '24/7', label: 'Customer support' },
    { value: 'SOC 2', label: 'Type II certified' },
  ];

  return (
    <section className="py-12 border-y border-ink-200/60 dark:border-ink-800/60 bg-white/60 dark:bg-ink-900/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-5">
        <div className="text-center text-xs uppercase tracking-[0.2em] text-ink-500 mb-7">
          Trusted by teams at the world&apos;s most ambitious companies
        </div>

        <div className="relative overflow-hidden mb-10">
          <motion.div
            className="flex items-center gap-12 whitespace-nowrap"
            animate={{ x: [0, -1500] }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          >
            {[...logos, ...logos].map((l, i) => (
              <span
                key={i}
                className="text-2xl font-bold text-ink-400 dark:text-ink-600 hover:text-ink-700 dark:hover:text-ink-300 transition tracking-tight"
              >
                {l}
              </span>
            ))}
          </motion.div>
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white dark:from-ink-950 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white dark:from-ink-950 to-transparent" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="card p-5 text-center">
              <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-br from-brand-500 to-purple-500 bg-clip-text text-transparent">
                {m.value}
              </div>
              <div className="text-xs text-ink-500 mt-1.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── features ─────────────── */
function Features() {
  const items = [
    { icon: Brain, title: 'AI dashboard generator', desc: 'Paste a sheet, AI auto-builds a starter dashboard with the most useful charts in seconds.' },
    { icon: TrendingUp, title: 'Smart analytics engine', desc: 'Trend detection, anomalies, forecasting and natural-language queries — all built in.' },
    { icon: Workflow, title: 'No-code workflow automation', desc: 'Trigger Slack alerts, emails, or webhooks when KPIs cross thresholds. No engineers required.' },
    { icon: Users, title: 'Real-time collaboration', desc: 'Workspace members see edits, comments, and chart changes live, with role-based access control.' },
    { icon: Plug, title: 'Integration hub', desc: 'Native connectors for Google Sheets, Excel, Airtable, Notion, Postgres, REST APIs and 50+ more.' },
    { icon: Lock, title: 'Security & encryption', desc: 'AES-256 at rest, TLS in transit, signed share tokens, SOC 2 Type II, GDPR & HIPAA ready.' },
    { icon: UploadCloud, title: 'Cloud sync system', desc: 'Bi-directional sync keeps every dashboard in lockstep with the source — nothing goes stale.' },
    { icon: FileText, title: 'AI report generator', desc: 'One-click PDF and email reports, written in plain English, scheduled however you like.' },
    { icon: BarChart3, title: '12 chart types', desc: 'Bar, line, donut, area, scatter, treemap, funnel, heatmap, waterfall — pick the right one.' },
    { icon: Filter, title: 'Live filters & drill-downs', desc: 'Multi-axis filters with row-level explore. Slice and dice without ever touching SQL.' },
    { icon: Globe2, title: 'Public share links', desc: 'Generate read-only links with QR codes, expiry, and per-link permissions in two clicks.' },
    { icon: Layers, title: 'Multi-tenant workspaces', desc: 'Per-team isolation, super-admin control plane, plan limits, and audit-grade activity logs.' },
  ];

  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead
          eyebrow="Features"
          title="Everything you need to ship a dashboard"
          subtitle="A modern analytics stack that replaces three or four point tools — with the polish of a $10M product."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
              className="card p-6 group hover:shadow-ring transition relative overflow-hidden"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-brand-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-brand-500/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500/15 to-purple-500/15 text-brand-600 flex items-center justify-center group-hover:scale-110 transition">
                  <it.icon className="w-5 h-5" />
                </div>
                <div className="font-semibold mt-4 text-base">{it.title}</div>
                <div className="text-sm text-ink-500 mt-1.5 leading-relaxed">{it.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── how it works ─────────────── */
function HowItWorks() {
  const steps = [
    { icon: Sparkles, title: 'Sign up & create your workspace', desc: 'Free forever for personal projects. Invite teammates by email, set roles in one click.' },
    { icon: Plug, title: 'Connect your data sources', desc: 'Paste a Google Sheet URL, drop a CSV, or connect Postgres / Airtable / Notion in seconds.' },
    { icon: Brain, title: 'AI configures everything', desc: 'We auto-detect column types, suggest charts, and pre-build a dashboard with the right defaults.' },
    { icon: Rocket, title: 'Launch & scale', desc: 'Share with a public link, embed anywhere, schedule reports, and watch live as your data flows.' },
  ];

  return (
    <section id="how" className="py-24 bg-white/40 dark:bg-ink-900/30 border-y border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead
          eyebrow="How it works"
          title="From spreadsheet to dashboard in 4 minutes"
          subtitle="A workflow designed so a non-technical operator can ship insights without ever waiting on engineering."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          <div className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-brand-500/0 via-brand-500/40 to-pink-500/0" />
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative"
            >
              <div className="card p-6 h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 text-white flex items-center justify-center font-bold shadow-ring">
                    {i + 1}
                  </div>
                  <s.icon className="w-5 h-5 text-brand-500" />
                </div>
                <div className="font-semibold text-base">{s.title}</div>
                <div className="text-sm text-ink-500 mt-2 leading-relaxed">{s.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── product preview (chart gallery) ─────────────── */
function ProductPreview() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead
          eyebrow="Live previews"
          title="Every chart type, beautifully tuned"
          subtitle="12 chart types, smart unit detection, and tooltips that actually help."
        />
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="label mb-2">Stacked bar · monthly</div>
            <ChartRenderer chart={{ type: 'stackedBar', xField: 'month', groupBy: 'month' }} rows={SAMPLE} height={240} />
          </div>
          <div className="card p-5">
            <div className="label mb-2">Area · sales trend</div>
            <ChartRenderer chart={{ type: 'area', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={240} />
          </div>
          <div className="card p-5">
            <div className="label mb-2">Donut · channel split</div>
            <ChartRenderer chart={{ type: 'donut', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={240} />
          </div>
          <div className="card p-5">
            <div className="label mb-2">Line · MoM growth</div>
            <ChartRenderer chart={{ type: 'line', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={240} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── use cases ─────────────── */
function UseCases() {
  const cases = [
    {
      icon: Rocket, color: 'from-brand-500 to-purple-500',
      title: 'For startups',
      desc: 'Track every KPI from MRR to churn without paying $1,000/month for a BI seat.',
      benefits: ['Live KPI cards', 'AI metric suggestions', 'Slack alerts for thresholds', 'Free for solo founders'],
    },
    {
      icon: Building2, color: 'from-emerald-500 to-cyan-500',
      title: 'For enterprises',
      desc: 'Self-serve analytics for every team, with audit logs, SSO, and workspace isolation built in.',
      benefits: ['SSO / SAML', 'Audit logs', 'Per-team workspaces', 'Dedicated support'],
    },
    {
      icon: Code2, color: 'from-amber-500 to-rose-500',
      title: 'For developers',
      desc: 'A REST API and webhooks for everything in the platform. Build internal tools 10× faster.',
      benefits: ['Public REST API', 'Webhook events', 'CLI & SDKs', 'Embeddable dashboards'],
    },
    {
      icon: Briefcase, color: 'from-sky-500 to-violet-500',
      title: 'For agencies',
      desc: 'Client-facing dashboards with white-label branding, per-client logins, and shareable links.',
      benefits: ['White-label', 'Per-client billing', 'Public share links', 'Branded PDF reports'],
    },
    {
      icon: ShoppingCart, color: 'from-pink-500 to-orange-500',
      title: 'For e-commerce',
      desc: 'Combine Shopify orders, ad spend, and inventory in one live cohort + funnel view.',
      benefits: ['Cohort analysis', 'Funnel drop-off', 'Cross-channel ROAS', 'Inventory alerts'],
    },
  ];

  return (
    <section id="use-cases" className="py-24 bg-white/40 dark:bg-ink-900/30 border-y border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead
          eyebrow="Use cases"
          title="Built for every team that lives in spreadsheets"
          subtitle="Real-world setups already shipping in production."
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((u, i) => (
            <motion.div
              key={u.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.06 }}
              className="card p-6 group hover:shadow-ring transition"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${u.color} text-white flex items-center justify-center shadow-ring`}>
                <u.icon className="w-5 h-5" />
              </div>
              <div className="mt-4 font-semibold text-base">{u.title}</div>
              <div className="text-sm text-ink-500 mt-1.5 leading-relaxed">{u.desc}</div>
              <ul className="mt-4 space-y-1.5">
                {u.benefits.map((b) => (
                  <li key={b} className="text-xs text-ink-600 dark:text-ink-300 flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── stats / counters ─────────────── */
function Stats() {
  const stats = [
    { icon: Users, label: 'Active users', to: 12500, suffix: '+' },
    { icon: BarChart3, label: 'Dashboards built', to: 84200, suffix: '+' },
    { icon: Database, label: 'Rows analysed', to: 1, suffix: 'B+' },
    { icon: MapPin, label: 'Countries served', to: 92, suffix: '' },
  ];
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead
          eyebrow="By the numbers"
          title="Real impact, in real time"
          subtitle="The product speaks for itself — these numbers are live, not vanity."
        />
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="card p-7 text-center relative overflow-hidden"
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-brand-500/10 blur-2xl" />
              <div className="relative">
                <div className="w-10 h-10 mx-auto rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center mb-3">
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-br from-brand-500 to-purple-500 bg-clip-text text-transparent">
                  <Counter to={s.to} suffix={s.suffix} />
                </div>
                <div className="text-xs text-ink-500 mt-1.5">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Counter({ to, suffix = '', duration = 1.6 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(eased * to);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  const formatted =
    to >= 1
      ? Math.round(val).toLocaleString()
      : val.toFixed(2);

  return (
    <span ref={ref}>
      {formatted}
      {suffix}
    </span>
  );
}

/* ─────────────── pricing ─────────────── */
function Pricing() {
  const [yearly, setYearly] = useState(true);
  const tiers = [
    {
      name: 'Free', monthly: 0, yearly: 0, tag: 'Forever free',
      cta: 'Start free', highlight: false,
      features: ['1 workspace', '3 sheets', '5 dashboards', 'Public share links', 'Community support'],
    },
    {
      name: 'Pro', monthly: 19, yearly: 15, tag: 'per user / mo',
      cta: 'Start 14-day trial', highlight: true,
      features: ['Unlimited sheets', 'Unlimited dashboards', 'Real-time sync', 'AI report generator', 'Priority support', 'Custom branding'],
    },
    {
      name: 'Business', monthly: 49, yearly: 39, tag: 'per user / mo',
      cta: 'Start trial', highlight: false,
      features: ['Everything in Pro', 'Team workspaces', 'SSO / SAML', 'Advanced permissions', 'API + webhooks', 'Audit logs'],
    },
    {
      name: 'Enterprise', monthly: null, yearly: null, tag: 'Custom',
      cta: 'Talk to sales', highlight: false,
      features: ['Dedicated CSM', 'On-prem / private cloud', '99.99% SLA', 'Custom integrations', 'Security review', 'Volume pricing'],
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-white/40 dark:bg-ink-900/30 border-y border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead
          eyebrow="Pricing"
          title="Simple, predictable plans"
          subtitle="Start free. Upgrade when your team starts winning."
        />

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setYearly(false)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${!yearly ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-500'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition ${yearly ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-500'}`}
          >
            Yearly
            <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
              −20%
            </span>
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`card p-7 flex flex-col ${t.highlight ? 'ring-2 ring-brand-500 shadow-ring relative overflow-hidden' : ''}`}
            >
              {t.highlight && (
                <>
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-brand-500/20 blur-2xl" />
                  <div className="relative inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-500 text-white mb-3 self-start">
                    Most popular
                  </div>
                </>
              )}
              <div className="font-semibold relative">{t.name}</div>
              <div className="mt-3 flex items-end gap-2 relative">
                <div className="text-4xl font-extrabold">
                  {t.monthly === null ? 'Custom' : `$${yearly ? t.yearly : t.monthly}`}
                </div>
                {t.monthly !== null && <div className="text-sm text-ink-500 mb-1">{t.tag}</div>}
                {t.monthly === null && <div className="text-sm text-ink-500 mb-1">contact us</div>}
              </div>
              {t.monthly !== null && yearly && t.monthly > 0 && (
                <div className="text-xs text-emerald-600 mt-1">Saves ${(t.monthly - t.yearly) * 12}/yr per user</div>
              )}
              <ul className="mt-5 space-y-2.5 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`mt-6 block text-center ${t.highlight ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-ink-500">
          All plans include unlimited public share links, light/dark mode, and SOC 2 Type II infrastructure.
        </div>
      </div>
    </section>
  );
}

/* ─────────────── testimonials ─────────────── */
function Testimonials() {
  const items = [
    {
      quote: 'We replaced three BI tools with SheetFlow. Onboarding our ops team took an afternoon, and we shipped 14 dashboards in week one.',
      name: 'Priya Iyer', role: 'Head of Operations', company: 'Brightline',
    },
    {
      quote: "The AI auto-dashboard is the closest I've seen to magic. It's the first analytics tool my non-technical co-founder actually uses.",
      name: 'Marcus Chen', role: 'CEO & co-founder', company: 'Loop AI',
    },
    {
      quote: 'Real-time sync from Google Sheets is a killer feature. Our weekly board prep went from a 2-hour scramble to a single share link.',
      name: 'Lena Müller', role: 'Director of Finance', company: 'NorthForge',
    },
    {
      quote: 'Setting up SSO and per-team workspaces took 15 minutes. The audit log alone justified the Business plan for our compliance review.',
      name: 'Diego Alvarez', role: 'IT & Security Lead', company: 'Atlas Robotics',
    },
    {
      quote: 'I used to write D3 from scratch. Now I drag, drop, share. The 12 chart types cover everything I built before — and the donut labels finally look right.',
      name: 'Sasha Petrov', role: 'Senior Product Engineer', company: 'Tideline',
    },
    {
      quote: 'Our agency manages 40 client dashboards. White-label + per-client links + scheduled PDFs makes us look 10× bigger than we are.',
      name: 'Imani Brooks', role: 'Founder', company: 'Northstar Studio',
    },
    {
      quote: 'Finally — a tool that understands file-size columns are bytes. The unit detection saved us from explaining "what does 349100000000 mean".',
      name: 'Jonas Reuter', role: 'Data Engineer', company: 'Cobalt',
    },
    {
      quote: 'The free tier is actually usable. We grew from 1 to 14 paying seats organically because the product just kept getting in the way of doing nothing.',
      name: 'Emma Sato', role: 'Growth Lead', company: 'Periscope',
    },
  ];
  const PER_PAGE = 3;
  const totalPages = Math.ceil(items.length / PER_PAGE);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPage((p) => (p + 1) % totalPages), 7000);
    return () => clearInterval(id);
  }, [totalPages]);

  const slice = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <section id="testimonials" className="py-24">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead
          eyebrow="Customer love"
          title="Teams everywhere are shipping faster"
          subtitle="Don't take our word for it — read what real customers say after a month with SheetFlow."
        />

        <div className="mt-12 relative min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {slice.map((t, i) => (
                <div key={i} className="card p-6 flex flex-col">
                  <Quote className="w-7 h-7 text-brand-500/40" />
                  <p className="mt-3 text-sm leading-relaxed flex-1">{t.quote}</p>
                  <div className="mt-5 pt-5 border-t border-ink-200/60 dark:border-ink-800/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.name}</div>
                      <div className="text-[11px] text-ink-500 truncate">
                        {t.role} · {t.company}
                      </div>
                    </div>
                    <div className="flex ml-auto">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-label={`Go to page ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === page ? 'w-8 bg-brand-500' : 'w-3 bg-ink-300 dark:bg-ink-700'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── FAQ ─────────────── */
function FAQ() {
  const items = [
    { q: 'How does the free trial work?', a: 'Pro and Business plans both include a 14-day trial — no credit card required. At the end you can downgrade to Free with no data loss.' },
    { q: 'Is my data secure?', a: 'Yes. We are SOC 2 Type II certified, encrypt data at rest with AES-256, and use TLS 1.2+ in transit. Workspaces are tenant-isolated, and share tokens are signed and revocable.' },
    { q: 'Where is my data stored?', a: 'Data is stored in AWS us-east-1 by default, with EU (eu-west-1) and APAC (ap-southeast-1) regions available on Business and Enterprise plans.' },
    { q: 'Which integrations are supported?', a: 'Out of the box: Google Sheets, Excel, CSV, Airtable, Notion, Postgres, MySQL, BigQuery, Snowflake, REST APIs and 50+ more via Zapier.' },
    { q: 'Do you support SSO?', a: 'Yes — Google, Microsoft, Okta, and any SAML 2.0 provider on Business and Enterprise plans.' },
    { q: 'How does AI factor into the product?', a: 'AI is used for chart suggestion, natural-language queries, anomaly detection, and the report generator. None of your data is used to train external models.' },
    { q: 'Can I embed dashboards in my own product?', a: 'Yes. Pro plans get public share links; Business and Enterprise plans get authenticated embeds with row-level filtering, JWT signing, and a JS SDK.' },
    { q: 'How is billing handled?', a: 'Monthly or yearly via credit card or invoice. Yearly saves 20%. Enterprise can pay by ACH / wire / PO.' },
    { q: 'What happens if I exceed my plan limits?', a: 'We never auto-charge for overages. You\'ll get a friendly nudge in-app and email; nothing is paused without notice.' },
    { q: 'Do you offer a money-back guarantee?', a: 'Yes — 30 days, no questions asked. We mean it.' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="py-24 bg-white/40 dark:bg-ink-900/30 border-y border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-4xl mx-auto px-5">
        <SectionHead
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Can't find what you're looking for? Email us at support@sheetflow.app."
        />
        <div className="mt-12 space-y-3">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-ink-50 dark:hover:bg-ink-800/40 transition"
                >
                  <span className="font-semibold text-sm">{it.q}</span>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180 text-brand-500' : 'text-ink-400'}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden border-t border-ink-200/60 dark:border-ink-800/60"
                    >
                      <div className="px-5 py-4 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
                        {it.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── final CTA ─────────────── */
function FinalCTA() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-5">
        <div className="relative card p-10 md:p-14 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/15 via-purple-500/15 to-pink-500/15" />
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-pink-500/25 blur-3xl" />

          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/60 dark:bg-ink-900/60 backdrop-blur border border-ink-200/60 dark:border-ink-800/60 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" /> 14-day free trial · no credit card
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              Start building your AI-powered<br className="hidden md:block" />
              <span className="bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                SaaS analytics today
              </span>
            </h2>
            <p className="mt-4 text-ink-600 dark:text-ink-300 max-w-2xl mx-auto">
              Join 10,000+ teams who replaced their BI stack with one tool that connects to every spreadsheet they already have.
            </p>
            <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
              <Link to="/register" className="btn-primary text-base px-6 py-3">
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="mailto:sales@sheetflow.app" className="btn-secondary text-base px-6 py-3">
                <MessageSquare className="w-4 h-4" /> Contact sales
              </a>
            </div>
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-ink-500 flex-wrap">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 14-day free trial</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Cancel any time</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Free forever tier</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── footer ─────────────── */
function Footer() {
  const cols = [
    {
      title: 'Product',
      links: ['Features', 'Pricing', 'Integrations', 'Changelog', 'Roadmap'],
    },
    {
      title: 'Company',
      links: ['About', 'Customers', 'Careers', 'Blog', 'Press kit'],
    },
    {
      title: 'Resources',
      links: ['Documentation', 'API reference', 'Templates', 'Help center', 'Status'],
    },
    {
      title: 'Legal',
      links: ['Privacy', 'Terms', 'Security', 'GDPR', 'Cookies'],
    },
  ];

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <footer className="border-t border-ink-200/60 dark:border-ink-800/60 bg-white/60 dark:bg-ink-950/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-5 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          <div className="col-span-2 md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight">SheetFlow Analytics</span>
            </Link>
            <p className="text-sm text-ink-500 mt-3 max-w-sm leading-relaxed">
              The AI-powered analytics layer for the spreadsheets your team already lives in.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
              className="mt-5 max-w-sm"
            >
              <label className="label flex items-center gap-1"><Mail className="w-3 h-3" /> Newsletter</label>
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input py-2 flex-1"
                />
                <button type="submit" className="btn-primary py-2 px-3">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {submitted && (
                <div className="text-xs text-emerald-600 mt-2">Thanks — we&apos;ll be in touch.</div>
              )}
            </form>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-xs uppercase tracking-wider font-bold text-ink-700 dark:text-ink-200 mb-3">
                {c.title}
              </div>
              <ul className="space-y-2 text-sm text-ink-500">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-ink-900 dark:hover:text-white transition">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-ink-200/60 dark:border-ink-800/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-ink-500">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> SOC 2 Type II · GDPR · HIPAA-ready
            <span className="mx-2">·</span>
            © {new Date().getFullYear()} SheetFlow Analytics
          </div>
          <div className="flex items-center gap-3">
            <a href="#" aria-label="Twitter" className="hover:text-brand-600 transition"><Twitter className="w-4 h-4" /></a>
            <a href="#" aria-label="GitHub" className="hover:text-brand-600 transition"><Github className="w-4 h-4" /></a>
            <a href="#" aria-label="LinkedIn" className="hover:text-brand-600 transition"><Linkedin className="w-4 h-4" /></a>
            <a href="#" aria-label="YouTube" className="hover:text-brand-600 transition"><Youtube className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── shared section header ─────────────── */
function SectionHead({ eyebrow, title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.4 }}
      className="text-center max-w-2xl mx-auto"
    >
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-3">{title}</h2>
      {subtitle && (
        <p className="mt-4 text-ink-600 dark:text-ink-300 text-base md:text-lg">{subtitle}</p>
      )}
    </motion.div>
  );
}
