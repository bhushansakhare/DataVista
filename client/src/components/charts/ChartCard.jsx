import { motion } from 'framer-motion';
import { MoreVertical, Pencil, Trash2, BarChart2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ChartRenderer from './ChartRenderer.jsx';
import ChartExplanationPanel from './ChartExplanationPanel.jsx';
import ColumnTip from '../ui/ColumnTip.jsx';
import { useColumnReasoning } from '../../hooks/useColumnReasoning.js';
import { describeChart, columnsUsed } from '../../utils/chartLabels.js';
import { reconcileAggregation } from '../../utils/columnAggregations.js';

export default function ChartCard({
  chart,
  rows,
  onEdit,
  onDelete,
  height = 280,
  /** Optional — pass the full sheet to enable hover-explanations + How-it's-built panel. */
  sheet,
  /** Legacy prop — used as a fallback when sheet isn't passed. */
  sheetTitle,
  showDetails = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const reasoning = useColumnReasoning(sheet);
  // Auto-reconcile saved aggregation against current Y column role.
  // Protects legacy charts saved with `sum` over text columns (would render flat zero bars).
  const safeChart = useMemo(() => {
    if (!chart) return null;
    if (!reasoning) return chart;
    const fixed = reconcileAggregation(chart, reasoning);
    if (fixed === chart.aggregation) return chart;
    return { ...chart, aggregation: fixed };
  }, [chart, reasoning]);
  if (!safeChart) return null;
  const safeRows = Array.isArray(rows) ? rows : [];
  const labels = describeChart(safeChart);
  const usedCols = columnsUsed(safeChart);
  const hasData = Boolean(safeChart.xField);
  const effectiveSheet = sheet || (sheetTitle ? { title: sheetTitle, columns: usedCols, detectedTypes: {} } : null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="card p-5 flex flex-col hover:shadow-ring transition"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold truncate">{labels.title}</div>
            <span className="chip uppercase text-[10px] tracking-wider flex-shrink-0">{labels.typeLabel}</span>
          </div>
          <div className="text-[11px] text-ink-500 mt-1 truncate">{labels.subtitle}</div>
        </div>
        {(onEdit || onDelete) && (
          <div className="relative flex-shrink-0">
            <button onClick={() => setMenuOpen((v) => !v)} className="btn-ghost p-1.5">
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 card py-1 w-36">
                  {onEdit && (
                    <button
                      onClick={() => { setMenuOpen(false); onEdit(); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => { setMenuOpen(false); onDelete(); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1">
        {hasData ? (
          <ChartRenderer chart={safeChart} rows={safeRows} height={height} />
        ) : (
          <div
            className="flex flex-col items-center justify-center text-center px-6 rounded-xl bg-ink-50/60 dark:bg-ink-800/30"
            style={{ height }}
          >
            <BarChart2 className="w-7 h-7 text-ink-300 mb-2" />
            <div className="text-sm font-medium text-ink-500">Chart not configured</div>
            <div className="text-xs text-ink-400 mt-1">
              {onEdit ? 'Click Edit to pick X / Y columns.' : 'X axis is missing.'}
            </div>
          </div>
        )}
      </div>

      {hasData && usedCols.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ink-200/60 dark:border-ink-800/60">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1.5">
            Columns used
          </div>
          <div className="flex flex-wrap gap-1.5">
            {usedCols.map((c) => (
              <ColumnTip key={c} column={c} reasoning={reasoning}>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200 cursor-help">
                  {c}
                </span>
              </ColumnTip>
            ))}
          </div>
        </div>
      )}

      {showDetails && effectiveSheet && (
        <ChartExplanationPanel chart={safeChart} sheet={effectiveSheet} />
      )}
    </motion.div>
  );
}
