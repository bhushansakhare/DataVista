import { motion } from 'framer-motion';
import {
  BarChart3, LineChart as LineIcon, PieChart, AreaChart, ScatterChart, Table2,
  Sparkles, ArrowRight, Loader2,
} from 'lucide-react';

const CHART_ICONS = {
  bar: BarChart3,
  line: LineIcon,
  donut: PieChart,
  area: AreaChart,
  scatter: ScatterChart,
  table: Table2,
};

const CHART_ACCENT = {
  bar: 'bg-brand-500/10 text-brand-700 dark:text-brand-300',
  line: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  donut: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  area: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  scatter: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  table: 'bg-ink-500/10 text-ink-700 dark:text-ink-300',
};

export default function SuggestionCard({ suggestion, onUse, busy = false, index = 0 }) {
  const charts = Array.isArray(suggestion.charts) ? suggestion.charts : [];
  const kpis = Array.isArray(suggestion.kpis) ? suggestion.kpis : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
      className="card p-5 flex flex-col h-full hover:shadow-ring transition"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{suggestion.title}</div>
          {suggestion.useCase && (
            <div className="text-xs text-ink-500 mt-1 leading-snug">{suggestion.useCase}</div>
          )}
        </div>
      </div>

      {charts.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-ink-500 mb-1.5">
            Charts ({charts.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {charts.map((c, i) => {
              const Icon = CHART_ICONS[c.type] || BarChart3;
              const accent = CHART_ACCENT[c.type] || CHART_ACCENT.bar;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${accent}`}
                  title={`${c.type}: ${c.xField} → ${c.yField}`}
                >
                  <Icon className="w-3 h-3" />
                  {c.yField} by {c.xField}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-ink-500 mb-1.5">
            KPIs ({kpis.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {kpis.map((k, i) => (
              <span
                key={i}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestion.insight && (
        <div className="mt-1 mb-4 text-xs text-ink-600 dark:text-ink-300 leading-relaxed bg-ink-50/60 dark:bg-ink-800/40 rounded-lg px-3 py-2">
          {suggestion.insight}
        </div>
      )}

      <div className="mt-auto pt-3">
        <button
          onClick={onUse}
          disabled={busy}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Building…</>
          ) : (
            <>Use this dashboard <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </motion.div>
  );
}
