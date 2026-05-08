import { useMemo } from 'react';
import TemplateLayout from './templateChrome.jsx';

// Live preview of a template's layout, rendered with mock data so the user
// can see exactly what the dashboard will look like before applying it.
//
// Mock data varies by:
//   - template.category   → KPI labels and insight phrasing
//   - slot.purpose + type → chart values
//   - template.id         → deterministic per-template variation in numbers
//
// So previewing two different templates produces visibly different output.

// ── Mock KPI sets per category ──────────────────────────────────────────────

const KPI_SETS = {
  sales: [
    { label: 'Total Revenue',     value: 142_180, description: 'Revenue across the selected period.', trend: 'up' },
    { label: 'Active Customers',  value: 3_274,   description: 'Distinct customers with at least one order.', trend: 'up' },
    { label: 'Avg Order Value',   value: 86,      description: 'Average revenue per order.', trend: 'stable' },
    { label: 'Top Region',        value: 38,      description: 'Share of revenue from the leading region (%).', trend: 'down' },
  ],
  marketing: [
    { label: 'Sessions',          value: 218_400, description: 'Visits in the selected window.', trend: 'up' },
    { label: 'Conversion Rate',   value: 4.6,     description: 'Visitors who completed a goal (%).', trend: 'up' },
    { label: 'Top Channel',       value: 42,      description: 'Share of conversions from the leading channel (%).', trend: 'stable' },
    { label: 'CPC',               value: 1.85,    description: 'Average cost per click.', trend: 'down' },
  ],
  finance: [
    { label: 'Revenue',           value: 412_900, description: 'Total revenue this period.', trend: 'up' },
    { label: 'Gross Margin',      value: 64,      description: 'Gross margin percent.', trend: 'stable' },
    { label: 'Burn Rate',         value: 38_200,  description: 'Monthly net burn.', trend: 'down' },
    { label: 'Runway',            value: 14,      description: 'Months of runway at current burn.', trend: 'stable' },
  ],
  operations: [
    { label: 'Uptime',            value: 99.92,   description: 'Service uptime % this period.', trend: 'stable' },
    { label: 'Open Incidents',    value: 4,       description: 'Currently active incidents.', trend: 'down' },
    { label: 'MTTR',              value: 27,      description: 'Mean time to resolve (minutes).', trend: 'down' },
    { label: 'Deploys',           value: 38,      description: 'Successful deploys this period.', trend: 'up' },
  ],
  product: [
    { label: 'Active Users',      value: 12_840,  description: 'Distinct active users this period.', trend: 'up' },
    { label: 'Retention',         value: 71,      description: 'Week-1 retention (%).', trend: 'up' },
    { label: 'Engaged Sessions',  value: 58,      description: 'Sessions over 30 seconds (%).', trend: 'stable' },
    { label: 'NPS',               value: 47,      description: 'Net promoter score.', trend: 'up' },
  ],
  custom: [
    { label: 'Total',             value: 42_180,  description: 'Headline total for the period.', trend: 'up' },
    { label: 'Active',            value: 1_274,   description: 'Active items in the dataset.', trend: 'up' },
    { label: 'Average',           value: 86,      description: 'Average value across records.', trend: 'stable' },
    { label: 'Top Share',         value: 38,      description: 'Share of the leading category (%).', trend: 'down' },
  ],
};

const INSIGHT_SETS = {
  sales: [
    'Revenue is concentrated in the top 2 categories — they drive 68% of total.',
    'March was the strongest month, up 22% versus the period average.',
    'The smallest segment is shrinking — worth a check on retention there.',
  ],
  marketing: [
    'Email and Direct combined drive 64% of conversions — the rest is long-tail.',
    'Conversion rate rose 0.8 points after the Q2 landing-page redesign.',
    'Social CPC is 3.2× the channel average — review creative quality.',
  ],
  finance: [
    'Gross margin held steady at ~64% despite a 12% revenue lift this quarter.',
    'Burn is down 18% MoM — runway extended by 2 months.',
    'Top-3 customers contribute 41% of revenue — concentration risk is high.',
  ],
  operations: [
    'Uptime stayed above 99.9% across the period — no SLA breaches.',
    'MTTR is trending down: 27min vs 41min last quarter.',
    'Most incidents originate in the auth subsystem — consider a focused review.',
  ],
  product: [
    'Week-1 retention rose 4 points after the onboarding tweak.',
    'Power users (top 5%) account for 38% of all sessions.',
    'NPS is up 6 points — driven by the mobile app cohort.',
  ],
  custom: [
    'A small set of items dominate the totals — prioritise them.',
    'There is a clear upward trend in the most recent period.',
    'The long tail can be safely grouped under "Others" without losing signal.',
  ],
};

function categoryKey(template) {
  const c = (template?.category || '').toLowerCase();
  if (KPI_SETS[c]) return c;
  return 'custom';
}

// Deterministic per-template numeric jitter so two templates with the same
// category don't produce identical preview values.
function templateSeed(template) {
  const id = String(template?.id || template?.name || 'x');
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

// ── Mock KPIs / insights per category, with per-template seed jitter ────────

function mockKpis(template) {
  const set = KPI_SETS[categoryKey(template)];
  const seed = templateSeed(template);
  return set.map((k, i) => {
    const jitter = ((seed + i * 7) % 17) - 8; // -8..+8
    let value = k.value;
    if (typeof value === 'number') {
      const factor = 1 + jitter / 100;
      value = Number.isInteger(value) ? Math.round(value * factor) : Number((value * factor).toFixed(2));
    }
    return { ...k, value };
  });
}

function mockInsights(template) {
  return INSIGHT_SETS[categoryKey(template)];
}

// ── Per-slot mock rows, also deterministic per-template ─────────────────────

function mockRowsForSlot(slot, seed) {
  const months   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const products = ['Product A', 'Product B', 'Product C', 'Product D', 'Product E', 'Product F'];
  const segments = ['Direct', 'Referral', 'Email', 'Social', 'Paid'];

  if (slot.purpose === 'distribution' || slot.type === 'donut') {
    const base = [44, 28, 16, 8, 4];
    return segments.map((s, i) => ({
      name: s,
      value: Math.max(1, base[i] + ((seed + i) % 7) - 3),
    }));
  }
  if (slot.purpose === 'trend' || slot.type === 'line' || slot.type === 'area') {
    return months.slice(0, 7).map((m, i) => ({
      name: m,
      value: 80 + i * 14 + (i % 2 ? 6 : -2) + ((seed + i * 5) % 11) - 5,
    }));
  }
  // comparison / bar fallback
  const base = [120, 96, 84, 68, 52, 38];
  return products.slice(0, 6).map((p, i) => ({
    name: p,
    value: Math.max(8, base[i] + ((seed * (i + 1)) % 13) - 6),
  }));
}

function chartFromSlot(slot) {
  return {
    id: slot.id || 'slot',
    type: slot.type,
    title: slot.title || titleFromPurpose(slot.purpose),
    xField: 'name',
    yField: 'value',
    yFields: ['value'],
    groupBy: '',
    aggregation: 'sum',
    filters: [],
    config: { hero: slot.position === 'hero' },
  };
}

function titleFromPurpose(p) {
  if (p === 'trend') return 'Trend Overview';
  if (p === 'comparison') return 'Top Comparison';
  if (p === 'distribution') return 'Distribution';
  if (p === 'growth') return 'Growth';
  return 'Chart';
}

export default function TemplatePreview({ template }) {
  const slots = Array.isArray(template?.chartSlots) ? template.chartSlots : [];
  const seed = templateSeed(template);

  const entries = useMemo(() => slots.map((s) => ({
    chart: chartFromSlot(s),
    rows: mockRowsForSlot(s, seed),
    hero: s.position === 'hero',
  })), [slots, seed]);

  const kpis = useMemo(() => mockKpis(template), [template]);
  const insights = useMemo(() => mockInsights(template), [template]);

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 dark:border-ink-700 p-10 text-center text-sm text-ink-500">
        This template has no slots yet. Edit it to add charts.
      </div>
    );
  }

  return (
    <TemplateLayout
      layoutType={template.layoutType || template.layoutConfig?.layout || 'hero-grid'}
      styleConfig={template.styleConfig}
      kpis={kpis}
      insights={insights}
      entries={entries}
    />
  );
}
