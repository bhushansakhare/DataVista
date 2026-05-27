import { motion } from 'framer-motion';
import {
  CheckCircle2, Pencil, RefreshCw, Share2, QrCode, Sparkles,
  TrendingUp, TrendingDown, Minus, Lightbulb, BarChart3,
} from 'lucide-react';
import ChartCard from '../charts/ChartCard.jsx';
import { aiSuggestionToDashboard } from '../../utils/aiToChart.js';
import TemplateLayout from '../templates/templateChrome.jsx';
import TemplateIframe from '../templates/TemplateIframe.jsx';

/**
 * Premium live-preview panel for AI-generated dashboards.
 *
 * v4 input shape — AI returns flat `{ title, summary, theme, kpis, charts,
 * insights, source }`. Charts use REAL column references; the renderer
 * aggregates from `sheet.rawData` at render time.
 */
export default function PreviewPanel({
  sheet,
  generated,
  onUse,
  onEdit,
  onRegenerate,
  onShare,
  onQr,
  busy = {},
}) {
  if (!sheet || !generated) return <EmptyPreview />;

  const projection = aiSuggestionToDashboard(generated, sheet);
  const charts = projection.charts;
  // Mode override: if a template is active and pinned a mode, prefer that;
  // otherwise honour the AI's theme choice.
  const templateActive = Boolean(generated.layoutType);
  if (templateActive) {
    console.log('TEMPLATE USED:', generated.layoutType,
      '| STYLE:', generated.styleConfig,
      '| SLOTS:', charts.length);
  }
  // The AI no longer emits a theme field. Templates may still pin a mode
  // via styleConfig.mode — honour that, otherwise default to light.
  const dark = templateActive ? generated.styleConfig?.mode === 'dark' : false;

  const shell = dark
    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100'
    : '';

  return (
    <div className={`h-full flex flex-col ${shell}`}>
      <PreviewHeader
        dark={dark}
        title={generated.title}
        summary={generated.summary || generated.description}
        onUse={onUse}
        onEdit={onEdit}
        onRegenerate={onRegenerate}
        onShare={onShare}
        onQr={onQr}
        busy={busy}
      />

      <div className="flex-1 overflow-hidden">
        {/* Raw-HTML / URL template path: render the resolved template
            verbatim inside a sandboxed iframe. The chart pipeline is not
            used here. */}
        {generated.templateType === 'html' && generated.templateCode ? (
          <TemplateIframe html={generated.templateCode} title="Template result" height="100%" rounded={false} />
        ) : generated.templateType === 'url' && generated.templateUrl ? (
          <TemplateIframe url={generated.templateUrl} title="Template result" height="100%" rounded={false} />
        ) : (
        <div className="h-full overflow-y-auto p-5 space-y-6">
        {/* Slot-template path: TemplateLayout. */}
        {templateActive ? (
          <TemplateLayout
            layoutType={generated.layoutType}
            styleConfig={generated.styleConfig}
            kpis={Array.isArray(generated.kpis) ? generated.kpis : []}
            insights={Array.isArray(generated.insights) ? generated.insights : []}
            entries={charts.map((c, i) => ({
              chart: c,
              rows: sheet.rawData || [],
              meta: generated.charts?.[i] || null,
              hero: Boolean(c.config?.hero),
            }))}
          />
        ) : (
          <>
        {/* AI-computed KPI cards */}
        {Array.isArray(generated.kpis) && generated.kpis.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {generated.kpis.map((k, i) => (
              <KpiCard key={i} kpi={k} dark={dark} index={i} />
            ))}
          </div>
        )}

        {/* AI Insights — plain-English bullets */}
        {Array.isArray(generated.insights) && generated.insights.length > 0 && (
          <section>
            <SectionLabel dark={dark} icon={Lightbulb} accent="amber">
              💡 Key Insights
            </SectionLabel>
            <div className={`mt-2 rounded-2xl border px-5 py-4 shadow-sm ${
              dark
                ? 'border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] via-white/[0.04] to-white/[0.02] backdrop-blur-md'
                : 'border-amber-200/60 bg-gradient-to-br from-amber-50/70 via-white/90 to-white/85 backdrop-blur'
            }`}>
              <ul className="space-y-3.5">
                {generated.insights.map((line, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className="flex gap-3 text-sm leading-7"
                  >
                    <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 flex-shrink-0" />
                    <span className={dark ? 'text-slate-200' : 'text-ink-700'}>{line}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Charts — first chart is the full-width hero; rest in a 2-col grid */}
        {charts.length > 0 ? (
          <section>
            <SectionLabel dark={dark} icon={BarChart3} accent="brand">Charts</SectionLabel>

            {/* Hero chart */}
            <ChartShell
              chart={charts[0]}
              meta={generated.charts?.[0]}
              rows={sheet.rawData || []}
              sheet={sheet}
              dark={dark}
              height={360}
              hero
            />

            {/* Secondary charts — fixed 2-col grid, equal heights */}
            {charts.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 auto-rows-fr">
                {charts.slice(1).map((c, i) => (
                  <ChartShell
                    key={c.id}
                    chart={c}
                    meta={generated.charts?.[i + 1]}
                    rows={sheet.rawData || []}
                    sheet={sheet}
                    dark={dark}
                    height={260}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className={`p-10 text-center text-sm rounded-2xl border ${
            dark ? 'border-white/10 bg-white/5' : 'border-ink-200/60 bg-white/80'
          }`}>
            AI didn't produce any chartable columns from this dataset.
          </div>
        )}
          </>
        )}
        </div>
        )}
      </div>
    </div>
  );
}

/* ─── header ─── */

function PreviewHeader({ dark, title, summary, onUse, onEdit, onRegenerate, onShare, onQr, busy }) {
  const headerCls = dark
    ? 'border-white/10 bg-slate-900/70'
    : 'border-ink-200/60 bg-white/60';
  return (
    <header className={`px-5 py-4 border-b ${headerCls} backdrop-blur-xl sticky top-0 z-10`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 text-white">
              <Sparkles className="w-3 h-3" /> AI Preview
            </span>
            {dark && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Dark theme
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold mt-1 truncate bg-gradient-to-r from-brand-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
            {title || 'Generated Dashboard'}
          </h2>
          {summary && (
            <p className={`text-sm mt-1.5 leading-relaxed max-w-2xl ${dark ? 'text-slate-300' : 'text-ink-600'}`}>
              {summary}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ActionButton dark={dark} onClick={onRegenerate} disabled={busy.regenerate} icon={RefreshCw} spinning={busy.regenerate}>
            Regenerate
          </ActionButton>
          <ActionButton dark={dark} onClick={onShare} disabled={busy.share} icon={Share2}>Share</ActionButton>
          <ActionButton dark={dark} onClick={onQr} disabled={busy.qr} icon={QrCode}>QR</ActionButton>
          <ActionButton dark={dark} onClick={onEdit} disabled={busy.edit} icon={Pencil}>Edit</ActionButton>
          <button
            onClick={onUse}
            disabled={busy.use}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-500 to-purple-500 text-white hover:opacity-95 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            {busy.use ? 'Saving…' : 'Use this dashboard'}
          </button>
        </div>
      </div>
    </header>
  );
}

function ActionButton({ icon: Icon, children, onClick, disabled, dark, spinning }) {
  const cls = dark
    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200'
    : 'border-ink-200/60 bg-white hover:bg-ink-50 text-ink-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border ${cls} transition disabled:opacity-50`}
    >
      <Icon className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} /> {children}
    </button>
  );
}

/* ─── KPI card (simple shape) ─── */

function KpiCard({ kpi, dark, index }) {
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
  const trendCls =
    kpi.trend === 'up'   ? 'text-emerald-500'
    : kpi.trend === 'down' ? 'text-rose-500'
    : (dark ? 'text-slate-500' : 'text-ink-400');

  // Each card gets a hue that cycles through the brand palette so a 6-tile row
  // reads as a unit instead of six identical cards.
  const HUES = [
    'from-brand-500/15', 'from-purple-500/15', 'from-cyan-500/15',
    'from-emerald-500/15', 'from-amber-500/15', 'from-rose-500/15',
  ];
  const hue = HUES[index % HUES.length];
  const cardBase = dark
    ? 'border-white/10 bg-white/5 backdrop-blur-md'
    : 'border-ink-200/60 bg-white/80 backdrop-blur';

  // Subtle lift on hover so the row feels alive but never agitated.
  const trendPillCls =
    kpi.trend === 'up'   ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : kpi.trend === 'down' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    : (dark ? 'bg-slate-700/40 text-slate-400' : 'bg-ink-100 text-ink-500');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={`group relative overflow-hidden rounded-2xl border ${cardBase} p-4 shadow-lg shadow-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/[0.07]`}
    >
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${hue} to-transparent blur-2xl transition-opacity duration-200 group-hover:opacity-80`} />
      <div className="relative">
        <div className={`text-[10px] uppercase tracking-wider font-bold truncate ${dark ? 'text-slate-400' : 'text-ink-500'}`}>
          {kpi.label}
        </div>
        <div className={`text-3xl font-extrabold mt-2.5 tabular-nums truncate tracking-tight ${dark ? 'text-white' : 'text-ink-900'}`} title={String(kpi.value)}>
          {formatValue(kpi.value)}
        </div>
        {kpi.description && (
          <div className={`text-[11px] mt-2 leading-relaxed line-clamp-2 ${dark ? 'text-slate-400/90' : 'text-ink-500/90'}`}>
            {kpi.description}
          </div>
        )}
        <div className={`text-[10px] font-semibold mt-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${trendPillCls}`}>
          <TrendIcon className="w-3 h-3" />
          {kpi.trend}
        </div>
      </div>
    </motion.div>
  );
}

/** Smart number formatter — no jargon, just readable numbers. */
function formatValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  // Show full-precision integers up to 999,999. Beyond that, compact for fit.
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/* ─── small helpers ─── */

function SectionLabel({ icon: Icon, children, accent, dark }) {
  const accentCls = {
    amber: 'text-amber-500',
    brand: 'text-brand-500',
  }[accent] || 'text-brand-500';
  return (
    <div className={`flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold ${dark ? 'text-slate-300' : 'text-ink-600'}`}>
      <Icon className={`w-3.5 h-3.5 ${accentCls}`} /> {children}
    </div>
  );
}

/* ─── chart shell — equal-height card used for both hero and secondary slots ─── */

function ChartShell({ chart, meta, rows, sheet, dark, height, hero = false }) {
  if (!chart) return null;
  // Hero card gets a barely-perceptible gradient — depth without decoration.
  // Secondaries stay quieter so the hero reads as the main story.
  const cardCls = hero
    ? (dark
        ? 'border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-white/[0.02] backdrop-blur-md'
        : 'border-ink-200/70 bg-gradient-to-br from-white via-white to-brand-50/40 backdrop-blur')
    : (dark
        ? 'border-white/10 bg-white/[0.04] backdrop-blur-md'
        : 'border-ink-200/60 bg-white/85 backdrop-blur');
  const headerCls = dark ? 'border-white/10' : 'border-ink-200/60';
  const subCls = dark ? 'text-slate-400' : 'text-ink-500';
  const title = meta?.simpleTitle || chart.title;
  const explanation = meta?.explanation;
  const heroShellCls = hero
    ? 'mt-2 shadow-xl shadow-black/[0.07] dark:shadow-black/30 ring-1 ring-brand-500/[0.04]'
    : 'shadow-sm hover:shadow-md transition-shadow duration-200';
  const headerPad = hero ? 'pt-5 pb-4' : 'pt-3 pb-2.5';
  const titleSize = hero ? 'text-lg' : 'text-sm';
  const explSize  = hero ? 'text-xs' : 'text-[11px]';
  const innerPad  = hero ? 'p-3' : 'p-2';
  return (
    <div className={`rounded-2xl border overflow-hidden h-full flex flex-col ${cardCls} ${heroShellCls}`}>
      {(title || explanation) && (
        <div className={`px-5 ${headerPad} border-b ${headerCls}`}>
          <div className={`font-semibold leading-tight tracking-tight ${titleSize}`}>
            {title}
          </div>
          {explanation && (
            <div className={`${explSize} mt-1 leading-relaxed ${subCls}`}>
              {explanation}
            </div>
          )}
        </div>
      )}
      <div className={`${innerPad} flex-1`}>
        <ChartCard
          chart={chart}
          rows={rows}
          height={height}
          sheet={sheet}
          showDetails={false}
        />
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-mesh-light dark:bg-mesh-dark">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-brand-600" />
      </div>
      <div className="font-semibold text-base mt-4">Your AI dashboard will appear here</div>
      <p className="text-sm text-ink-500 mt-1.5 max-w-sm leading-relaxed">
        Paste a Google Sheet URL, drop a CSV / XLSX file, or describe the dashboard you want — the AI will analyse the data and render charts in this panel.
      </p>
    </div>
  );
}
