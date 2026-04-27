import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, ArrowRight, Sheet, BarChart3, Zap, Users, Shield, Check,
  LineChart, PieChart, AreaChart, Layers, Boxes, TrendingUp, Filter, CircleDot, Grid3x3, ScatterChart, AlignLeft,
} from 'lucide-react';
import ChartRenderer from '../components/charts/ChartRenderer.jsx';

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
    <div className="min-h-screen bg-mesh-light dark:bg-mesh-dark">
      <Nav />
      <Hero />
      <LogoCloud />
      <Features />
      <Preview />
      <Charts />
      <Pricing />
      <Trust />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 glass border-b border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">SheetFlow</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-ink-600 dark:text-ink-300">
          <a href="#features" className="hover:text-ink-900 dark:hover:text-white">Features</a>
          <a href="#charts" className="hover:text-ink-900 dark:hover:text-white">Charts</a>
          <a href="#pricing" className="hover:text-ink-900 dark:hover:text-white">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
          <Link to="/register" className="btn-primary">
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 pt-16 pb-24 md:pt-24 md:pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-700 dark:text-brand-300 mb-6"
        >
          <Sparkles className="w-3.5 h-3.5" /> Now with real-time sync
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto"
        >
          Turn Google Sheets into
          <span className="block bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            powerful dashboards instantly
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6 text-lg text-ink-600 dark:text-ink-300 max-w-2xl mx-auto"
        >
          SheetFlow connects to any Google Sheet and gives you 12 chart types, real-time sync, and a multi-tenant SaaS workspace — no setup, no spreadsheets full of formulas.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-9 flex items-center justify-center gap-3 flex-wrap"
        >
          <Link to="/register" className="btn-primary text-base px-6 py-3">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#preview" className="btn-secondary text-base px-6 py-3">View demo</a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-16 mx-auto max-w-5xl"
          id="preview"
        >
          <div className="card p-2 md:p-3 shadow-glass">
            <div className="rounded-xl bg-gradient-to-br from-ink-50 to-white dark:from-ink-900 dark:to-ink-950 p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <Stat label="Total revenue" value="$2.84M" delta="+12.4%" up />
                <Stat label="Active users" value="48,219" delta="+3.1%" up />
                <Stat label="Conversion" value="6.7%" delta="-0.4%" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="card p-4">
                  <div className="text-xs label mb-2">Sales trend</div>
                  <ChartRenderer chart={{ type: 'area', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={180} />
                </div>
                <div className="card p-4">
                  <div className="text-xs label mb-2">Sales vs returns</div>
                  <ChartRenderer chart={{ type: 'bar', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={180} />
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
      <div className={`text-xs mt-1 ${up ? 'text-emerald-600' : 'text-rose-500'}`}>{delta}</div>
    </div>
  );
}

function LogoCloud() {
  const items = ['Stripe', 'Notion', 'Vercel', 'Linear', 'Airbnb', 'Spotify'];
  return (
    <div className="border-y border-ink-200/60 dark:border-ink-800/60 bg-white/40 dark:bg-ink-900/40">
      <div className="max-w-6xl mx-auto px-5 py-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-ink-400 text-sm font-semibold">
        <span className="text-xs uppercase tracking-wider">Trusted by data teams at</span>
        {items.map((i) => <span key={i}>{i}</span>)}
      </div>
    </div>
  );
}

function Features() {
  const items = [
    { icon: Sheet, title: 'Google Sheets, native', desc: 'Paste a public sheet URL — we parse, type-detect, and stream rows in.' },
    { icon: BarChart3, title: '12 chart types', desc: 'Bar, line, donut, area, scatter, treemap, funnel, heatmap, waterfall and more.' },
    { icon: Zap, title: 'Real-time sync', desc: 'Edit your sheet, the dashboard updates over Socket.io within seconds.' },
    { icon: Users, title: 'Multi-tenant teams', desc: 'Workspaces, role-based access, and per-dashboard public share links.' },
    { icon: Shield, title: 'Secure by default', desc: 'JWT auth, workspace isolation, signed share tokens, rate-limited APIs.' },
    { icon: Sparkles, title: 'Drag-and-drop builder', desc: 'Pick X / Y / group, filter, preview, save — no SQL, no formulas.' },
  ];
  return (
    <section id="features" className="py-20">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead eyebrow="Features" title="Everything you need to ship a dashboard" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {items.map((it) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.4 }}
              className="card p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
                <it.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold mt-4">{it.title}</div>
              <div className="text-sm text-ink-500 mt-1.5">{it.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Preview() {
  return (
    <section id="preview-2" className="py-20 bg-white/40 dark:bg-ink-900/30 border-y border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead eyebrow="Live preview" title="Built for the data you actually have" />
        <div className="grid md:grid-cols-2 gap-4 mt-10">
          <div className="card p-5"><div className="label mb-2">Stacked bar</div><ChartRenderer chart={{ type: 'stackedBar', xField: 'month', yFields: ['sales','returns'], groupBy: 'month' }} rows={SAMPLE.map(r=>({...r}))} height={220} /></div>
          <div className="card p-5"><div className="label mb-2">Area</div><ChartRenderer chart={{ type: 'area', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={220} /></div>
          <div className="card p-5"><div className="label mb-2">Donut</div><ChartRenderer chart={{ type: 'donut', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={220} /></div>
          <div className="card p-5"><div className="label mb-2">Line</div><ChartRenderer chart={{ type: 'line', xField: 'month', yField: 'sales' }} rows={SAMPLE} height={220} /></div>
        </div>
      </div>
    </section>
  );
}

function Charts() {
  const items = [
    { i: BarChart3, n: 'Bar' }, { i: LineChart, n: 'Line' }, { i: PieChart, n: 'Donut' }, { i: AreaChart, n: 'Area' },
    { i: Layers, n: 'Stacked' }, { i: AlignLeft, n: 'Horizontal' }, { i: ScatterChart, n: 'Scatter' }, { i: Boxes, n: 'Treemap' },
    { i: Filter, n: 'Funnel' }, { i: CircleDot, n: 'Radial' }, { i: Grid3x3, n: 'Heatmap' }, { i: TrendingUp, n: 'Waterfall' },
  ];
  return (
    <section id="charts" className="py-20">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead eyebrow="12 chart types" title="From bar charts to waterfalls" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-10">
          {items.map((c) => (
            <div key={c.n} className="card p-5 flex flex-col items-center gap-2">
              <c.i className="w-7 h-7 text-brand-500" />
              <div className="text-sm font-semibold">{c.n}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: 'Free', price: '$0', tag: 'Forever', features: ['1 workspace', '3 sheets', '5 dashboards', 'Public share links', 'Community support'], cta: 'Start free' },
    { name: 'Pro', price: '$19', tag: 'per user / mo', highlighted: true, features: ['Unlimited sheets', 'Unlimited dashboards', 'Real-time sync', 'Priority support', 'Custom branding'], cta: 'Start 14-day trial' },
    { name: 'Enterprise', price: 'Custom', tag: 'SSO + API', features: ['SSO / SAML', 'API access', 'Dedicated support', 'On-prem deploy', 'SLA'], cta: 'Talk to sales' },
  ];
  return (
    <section id="pricing" className="py-20 bg-white/40 dark:bg-ink-900/30 border-y border-ink-200/60 dark:border-ink-800/60">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead eyebrow="Pricing" title="Simple, predictable plans" />
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`card p-7 ${t.highlighted ? 'ring-2 ring-brand-500 shadow-ring' : ''}`}
            >
              {t.highlighted && (
                <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-500 text-white mb-3">
                  Most popular
                </div>
              )}
              <div className="font-semibold">{t.name}</div>
              <div className="mt-3 flex items-end gap-2">
                <div className="text-4xl font-bold">{t.price}</div>
                <div className="text-sm text-ink-500 mb-1">{t.tag}</div>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className={`mt-6 block text-center ${t.highlighted ? 'btn-primary' : 'btn-secondary'}`}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  const items = [
    { icon: Shield, t: 'Secure auth', d: 'JWT, bcrypt-hashed passwords, role-based access, rate-limited APIs.' },
    { icon: Zap, t: 'Real-time engine', d: 'Socket.io rooms per sheet & dashboard, change-detected over content hash.' },
    { icon: Users, t: 'Multi-tenant from day one', d: 'Every query is workspace-scoped — no data ever crosses tenants.' },
  ];
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-5">
        <SectionHead eyebrow="Built right" title="Architecture you can trust" />
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {items.map((it) => (
            <div key={it.t} className="card p-6">
              <it.icon className="w-6 h-6 text-brand-500" />
              <div className="font-semibold mt-3">{it.t}</div>
              <div className="text-sm text-ink-500 mt-1.5">{it.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-5">
        <div className="card p-10 md:p-14 text-center bg-gradient-to-br from-brand-500/10 to-purple-500/10">
          <h2 className="text-3xl md:text-4xl font-extrabold">Start building dashboards in seconds</h2>
          <p className="mt-3 text-ink-600 dark:text-ink-300">Free to start. Paste a sheet, ship a dashboard, share a link.</p>
          <Link to="/register" className="btn-primary text-base px-6 py-3 mt-7">
            Create your free account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-200/60 dark:border-ink-800/60 py-10">
      <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ink-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-purple-500" />
          <span className="font-semibold text-ink-700 dark:text-ink-200">SheetFlow Analytics</span>
        </div>
        <div>© {new Date().getFullYear()} SheetFlow. All rights reserved.</div>
      </div>
    </footer>
  );
}

function SectionHead({ eyebrow, title }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{eyebrow}</div>
      <h2 className="text-3xl md:text-4xl font-extrabold mt-2">{title}</h2>
    </div>
  );
}
