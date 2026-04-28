import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertCircle, Wand2 } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import ChartRenderer from './ChartRenderer.jsx';
import { recommendCharts } from '../../utils/chartRecommender.js';
import { analyzeSheet } from '../../utils/columnInsights.js';
import { describeChart, explainChart } from '../../utils/chartLabels.js';

export default function SuggestChartsModal({ open, onClose, sheet, rows, onApply }) {
  const [recs, setRecs] = useState([]);
  const [chosen, setChosen] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const r = recommendCharts(sheet, { max: 6 });
    setRecs(r);
    const next = {};
    r.forEach((c) => { next[c.id] = true; });
    setChosen(next);
    setError('');
  }, [open, sheet?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const insights = useMemo(() => analyzeSheet(sheet), [sheet]);
  const safeRows = Array.isArray(rows) ? rows : [];
  const selectedCount = Object.values(chosen).filter(Boolean).length;

  function toggle(id) {
    setChosen((prev) => ({ ...prev, [id]: !prev[id] }));
    setError('');
  }
  function setAll(value) {
    const next = {};
    recs.forEach((c) => { next[c.id] = value; });
    setChosen(next);
    setError('');
  }

  function apply() {
    const out = recs.filter((c) => chosen[c.id]);
    if (out.length === 0) {
      setError('Select at least one chart to add to your dashboard.');
      return;
    }
    // Strip the `insight` field — not part of the schema
    const cleaned = out.map(({ insight, ...rest }) => rest);
    onApply?.(cleaned);
    onClose?.();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Suggested charts"
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={apply} className="btn-primary">
            <Sparkles className="w-4 h-4" />
            Add {selectedCount} chart{selectedCount === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/20 p-4">
          <div className="flex items-start gap-3">
            <Wand2 className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm leading-relaxed">
              <div className="font-semibold">AI-suggested dashboard</div>
              <div className="text-xs text-ink-500 mt-1">
                We analysed your sheet and picked {recs.length} different chart{recs.length === 1 ? '' : 's'} that
                each tell you something distinct. Uncheck any you don&apos;t want, then add the rest.
              </div>
            </div>
          </div>
          <ColumnUsageSummary insights={insights} />
        </div>

        {recs.length === 0 ? (
          <div className="card p-10 text-center">
            <AlertCircle className="w-7 h-7 mx-auto text-amber-500" />
            <div className="font-semibold mt-3">Not enough signal to suggest charts</div>
            <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto">
              We need at least one numeric or categorical column to build something useful.
              Add a metric column or pick a different sheet, then try again.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-xs text-ink-500">
                {selectedCount} of {recs.length} selected
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAll(true)} className="btn-ghost text-xs">Select all</button>
                <button onClick={() => setAll(false)} className="btn-ghost text-xs">Clear</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recs.map((c, i) => (
                <SuggestionCard
                  key={c.id}
                  chart={c}
                  rows={safeRows}
                  index={i}
                  checked={!!chosen[c.id]}
                  onToggle={() => toggle(c.id)}
                />
              ))}
            </div>
          </>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </div>
    </Modal>
  );
}

function ColumnUsageSummary({ insights }) {
  const counts = [
    { label: 'Numeric metrics', n: insights.numeric.length, color: 'emerald' },
    { label: 'Date columns', n: insights.date.length, color: 'amber' },
    { label: 'Categories', n: insights.category.length, color: 'brand' },
    { label: 'IDs (skipped)', n: insights.id.length, color: 'ink' },
    { label: 'URLs (skipped)', n: insights.url.length, color: 'ink' },
  ].filter((c) => c.n > 0);
  if (!counts.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {counts.map((c) => (
        <span
          key={c.label}
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
            c.color === 'emerald'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : c.color === 'amber'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : c.color === 'brand'
              ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
              : 'bg-ink-200/50 dark:bg-ink-800 text-ink-600 dark:text-ink-300'
          }`}
        >
          {c.n} {c.label}
        </span>
      ))}
    </div>
  );
}

function SuggestionCard({ chart, rows, index, checked, onToggle }) {
  const labels = describeChart(chart);
  const explanation = explainChart(chart);
  return (
    <motion.label
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04 }}
      className={`card p-4 cursor-pointer transition flex flex-col ${
        checked ? 'ring-2 ring-brand-500/60 shadow-ring' : 'hover:shadow-soft'
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 mt-1 accent-brand-500 cursor-pointer flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-sm truncate">{labels.title}</div>
            <span className="chip uppercase text-[10px] tracking-wider flex-shrink-0">{labels.typeLabel}</span>
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">{labels.subtitle}</div>
        </div>
      </div>

      <div className="rounded-xl bg-ink-50/60 dark:bg-ink-800/30 p-2 flex-1">
        <ChartRenderer chart={chart} rows={rows} height={170} />
      </div>

      <p className="mt-3 text-[11px] text-ink-600 dark:text-ink-300 leading-relaxed">
        {explanation}
      </p>
    </motion.label>
  );
}
