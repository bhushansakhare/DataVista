// Template rendering primitives. SINGLE source of truth used by:
//   - TemplatePreview (mock data)
//   - PreviewPanel    (AI-Assistant live preview)
//   - DashboardViewPage (saved view)
//
// So all three views look identical for any given (layoutType, styleConfig)
// pair. Adding a new layout = add a renderer here and the enum in the
// server-side schema. No component duplication.

import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, Lightbulb, BarChart3,
} from 'lucide-react';
import ChartCard from '../charts/ChartCard.jsx';

// ───────────────────────────────────────────────────────────────────────────
// Style config → Tailwind class composition.
// ───────────────────────────────────────────────────────────────────────────

export const DEFAULT_STYLE = Object.freeze({
  density: 'airy',
  cardStyle: 'soft',
  accent: 'brand',
  mode: 'light',
});

function safeStyle(s) {
  return {
    density:   s?.density === 'compact' ? 'compact' : 'airy',
    cardStyle: s?.cardStyle === 'sharp' ? 'sharp' : 'soft',
    accent:    ['emerald', 'purple', 'amber', 'brand'].includes(s?.accent) ? s.accent : 'brand',
    mode:      s?.mode === 'dark' ? 'dark' : 'light',
  };
}

const ACCENT_TOKENS = {
  brand:   { ring: 'ring-brand-500/[0.04]',   tint: 'to-brand-50/40',   gradFromDark: 'from-brand-500/[0.08]' },
  emerald: { ring: 'ring-emerald-500/[0.05]', tint: 'to-emerald-50/40', gradFromDark: 'from-emerald-500/[0.08]' },
  purple:  { ring: 'ring-purple-500/[0.05]',  tint: 'to-purple-50/40',  gradFromDark: 'from-purple-500/[0.08]' },
  amber:   { ring: 'ring-amber-500/[0.06]',   tint: 'to-amber-50/40',   gradFromDark: 'from-amber-500/[0.08]' },
};

/**
 * Resolve a styleConfig into the class fragments the layout components need.
 */
export function resolveStyle(styleConfig) {
  const s = safeStyle(styleConfig);
  const accent = ACCENT_TOKENS[s.accent];
  const compact = s.density === 'compact';
  const sharp = s.cardStyle === 'sharp';
  const dark = s.mode === 'dark';

  return {
    raw: s,
    dark,
    sectionGap: compact ? 'space-y-3' : 'space-y-7',
    gridGap:    compact ? 'gap-2' : 'gap-5',
    cardRadius: sharp ? 'rounded-md' : 'rounded-2xl',
    cardShadow: sharp ? 'shadow-md' : 'shadow-sm',
    cardPad:    compact ? 'p-2.5' : 'p-4',
    headerPad:  compact ? 'pt-2 pb-1.5 px-3' : 'pt-3 pb-2.5 px-5',
    heroHeaderPad: compact ? 'pt-3 pb-2 px-3' : 'pt-5 pb-4 px-5',
    accent,
    // Card surfaces — light vs dark mode.
    cardSurface: dark
      ? 'border-white/10 bg-white/[0.04] backdrop-blur-md'
      : 'border-ink-200/60 bg-white/85 backdrop-blur',
    heroSurface: sharp
      // Sharp = no soft gradient, just a clean filled card.
      ? (dark
          ? 'border-white/10 bg-white/[0.05] backdrop-blur-md'
          : 'border-ink-200/70 bg-white backdrop-blur')
      // Soft = subtle gradient from the accent colour.
      : (dark
          ? `border-white/10 bg-gradient-to-br ${accent.gradFromDark} via-white/[0.03] to-white/[0.02] backdrop-blur-md`
          : `border-ink-200/70 bg-gradient-to-br from-white via-white ${accent.tint} backdrop-blur`),
    heroExtra: sharp ? '' : `ring-1 ${accent.ring}`,
    insightsSurface: dark
      ? 'border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] via-white/[0.04] to-white/[0.02]'
      : 'border-amber-200/60 bg-gradient-to-br from-amber-50/70 via-white/90 to-white/85',
    subText: dark ? 'text-slate-400' : 'text-ink-500',
    bodyText: dark ? 'text-slate-200' : 'text-ink-700',
    valueText: dark ? 'text-white' : 'text-ink-900',
    headerBorder: dark ? 'border-white/10' : 'border-ink-200/60',
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Shared sub-components.
// ───────────────────────────────────────────────────────────────────────────

export function TemplateChartShell({ chart, rows, height, hero = false, meta, st }) {
  if (!chart) return null;
  const surface = hero ? `${st.heroSurface} ${st.heroExtra} ${hero ? 'shadow-xl shadow-black/[0.07] dark:shadow-black/30' : st.cardShadow}` : `${st.cardSurface} ${st.cardShadow}`;
  const titleSize = hero ? 'text-lg' : 'text-sm';
  const innerPad = hero ? 'p-3' : 'p-2';
  const title = meta?.simpleTitle || chart.title;
  const explanation = meta?.explanation;
  return (
    <div className={`${st.cardRadius} border overflow-hidden h-full flex flex-col ${surface}`}>
      {(title || explanation) && (
        <div className={`${hero ? st.heroHeaderPad : st.headerPad} border-b ${st.headerBorder}`}>
          <div className={`font-semibold leading-tight tracking-tight ${titleSize}`}>{title}</div>
          {explanation && (
            <div className={`text-[11px] mt-1 leading-relaxed ${st.subText}`}>{explanation}</div>
          )}
        </div>
      )}
      <div className={`${innerPad} flex-1`}>
        <ChartCard chart={chart} rows={rows} height={height} showDetails={false} />
      </div>
    </div>
  );
}

export function TemplateKpiStrip({ kpis, st }) {
  if (!Array.isArray(kpis) || kpis.length === 0) return null;
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(kpis.length, 5)} ${st.gridGap}`}>
      {kpis.map((k, i) => <KpiTile key={i} kpi={k} st={st} index={i} />)}
    </div>
  );
}

function KpiTile({ kpi, st, index }) {
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
  const trendPillCls =
    kpi.trend === 'up' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : kpi.trend === 'down' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    : (st.dark ? 'bg-slate-700/40 text-slate-400' : 'bg-ink-100 text-ink-500');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className={`relative overflow-hidden ${st.cardRadius} border ${st.cardSurface} ${st.cardPad} ${st.cardShadow} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className={`text-[10px] uppercase tracking-wider font-bold truncate ${st.subText}`}>{kpi.label}</div>
      <div className={`text-3xl font-extrabold mt-2.5 tabular-nums truncate tracking-tight ${st.valueText}`} title={String(kpi.value)}>
        {formatValue(kpi.value)}
      </div>
      {kpi.description && (
        <div className={`text-[11px] mt-2 leading-relaxed line-clamp-2 ${st.subText}`}>{kpi.description}</div>
      )}
      <div className={`text-[10px] font-semibold mt-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${trendPillCls}`}>
        <TrendIcon className="w-3 h-3" /> {kpi.trend}
      </div>
    </motion.div>
  );
}

function formatValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '—');
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function TemplateInsights({ insights, st }) {
  if (!Array.isArray(insights) || insights.length === 0) return null;
  return (
    <section>
      <SectionLabel st={st} icon={Lightbulb} accent="amber">💡 Key Insights</SectionLabel>
      <div className={`mt-2 ${st.cardRadius} border px-5 py-4 ${st.cardShadow} ${st.insightsSurface} backdrop-blur`}>
        <ul className="space-y-3.5">
          {insights.map((line, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="flex gap-3 text-sm leading-7"
            >
              <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 flex-shrink-0" />
              <span className={st.bodyText}>{line}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionLabel({ icon: Icon, children, accent, st }) {
  const accentCls = accent === 'amber' ? 'text-amber-500' : 'text-brand-500';
  return (
    <div className={`flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold ${st.dark ? 'text-slate-300' : 'text-ink-600'}`}>
      <Icon className={`w-3.5 h-3.5 ${accentCls}`} /> {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Layouts.
// `entries` is an array of { chart, rows, meta } — one per chart. Each entry
// is independent so the same component renders mock data (preview), shared
// rawData (saved view), or per-slot mock rows.
// ───────────────────────────────────────────────────────────────────────────

/** HERO-GRID: full-width headline + 2-col grid. Big spacing, premium feel. */
function HeroGridLayout({ entries, st }) {
  const heroIdx = entries.findIndex((e) => e.chart?.config?.hero || e.hero);
  const hero = heroIdx >= 0 ? entries[heroIdx] : entries[0];
  const others = entries.filter((e) => e !== hero);
  const heroHeight = st.raw.density === 'compact' ? 300 : 380;
  const gridHeight = st.raw.density === 'compact' ? 220 : 280;
  return (
    <section>
      <SectionLabel st={st} icon={BarChart3}>Charts</SectionLabel>
      {hero && (
        <div className="mt-2">
          <TemplateChartShell {...hero} hero st={st} height={heroHeight} />
        </div>
      )}
      {others.length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${st.gridGap} mt-6 auto-rows-fr`}>
          {others.map((e, i) => <TemplateChartShell key={i} {...e} st={st} height={gridHeight} />)}
        </div>
      )}
    </section>
  );
}

/**
 * DENSE-GRID: no hero. Equal-weight cards in a tight 3-col grid. Compact
 * by default (smaller heights, lighter section gap) so the visual feels
 * distinctly different from hero-grid even at default density.
 */
function DenseGridLayout({ entries, st }) {
  const gridHeight = st.raw.density === 'compact' ? 160 : 200;
  return (
    <section>
      <SectionLabel st={st} icon={BarChart3}>Status board</SectionLabel>
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${st.gridGap} mt-2 auto-rows-fr`}>
        {entries.map((e, i) => <TemplateChartShell key={i} {...e} st={st} height={gridHeight} />)}
      </div>
    </section>
  );
}

/**
 * SIDEBAR: tall primary chart on the LEFT (col-span-1, full row height),
 * stacked secondaries on the RIGHT (col-span-2). Strong visual asymmetry
 * so the layout is unmistakable vs hero-grid and dense-grid.
 */
function SidebarLayout({ entries, st }) {
  const primaryIdx = entries.findIndex((e) => e.chart?.config?.hero || e.hero);
  const primary = primaryIdx >= 0 ? entries[primaryIdx] : entries[0];
  const others = entries.filter((e) => e !== primary);
  const primaryHeight = st.raw.density === 'compact' ? 460 : 560;
  const sideHeight = st.raw.density === 'compact' ? 180 : 220;
  return (
    <section>
      <SectionLabel st={st} icon={BarChart3}>Charts</SectionLabel>
      <div className={`grid grid-cols-1 lg:grid-cols-3 ${st.gridGap} mt-2`}>
        {primary && (
          <div className="lg:col-span-1 lg:sticky lg:top-2">
            <TemplateChartShell {...primary} hero st={st} height={primaryHeight} />
          </div>
        )}
        <div className={`lg:col-span-2 flex flex-col ${st.gridGap}`}>
          {others.map((e, i) => <TemplateChartShell key={i} {...e} st={st} height={sideHeight} />)}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// The single entry point everyone uses.
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {'hero-grid'|'dense-grid'|'sidebar'} props.layoutType
 * @param {object} props.styleConfig
 * @param {Array<{label, value, description, trend}>} props.kpis
 * @param {Array<string>} props.insights
 * @param {Array<{chart, rows, meta?, hero?: boolean}>} props.entries
 */
export default function TemplateLayout({
  layoutType = 'hero-grid',
  styleConfig,
  kpis = [],
  insights = [],
  entries = [],
}) {
  const st = resolveStyle(styleConfig);

  let LayoutBody;
  if (layoutType === 'dense-grid') LayoutBody = DenseGridLayout;
  else if (layoutType === 'sidebar') LayoutBody = SidebarLayout;
  else LayoutBody = HeroGridLayout;

  return (
    <div className={st.sectionGap}>
      <TemplateKpiStrip kpis={kpis} st={st} />
      <TemplateInsights insights={insights} st={st} />
      {entries.length > 0 ? <LayoutBody entries={entries} st={st} /> : null}
    </div>
  );
}
