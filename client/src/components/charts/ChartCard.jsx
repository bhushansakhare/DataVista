import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Pencil, Trash2, ChevronDown, Filter, BarChart2 } from 'lucide-react';
import { useState } from 'react';
import ChartRenderer from './ChartRenderer.jsx';
import { describeChart, columnsUsed, formatFilter } from '../../utils/chartLabels.js';

export default function ChartCard({
  chart,
  rows,
  onEdit,
  onDelete,
  height = 280,
  sheetTitle,
  showDetails = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!chart) return null;
  const safeRows = Array.isArray(rows) ? rows : [];
  const labels = describeChart(chart);
  const usedCols = columnsUsed(chart);
  const filters = Array.isArray(chart.filters) ? chart.filters.filter((f) => f && f.field) : [];
  const hasData = Boolean(chart.xField);

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
          <ChartRenderer chart={chart} rows={safeRows} height={height} />
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
              <span
                key={c}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-ink-200/60 dark:border-ink-800/60">
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="w-full flex items-center justify-between text-xs text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 transition"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <BarChart2 className="w-3.5 h-3.5" /> View details
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <DetailRow label="Type" value={labels.typeLabel} />
                  {labels.xAxis && <DetailRow label="X axis" value={labels.xAxis} />}
                  <DetailRow label="Y axis" value={labels.yAxis} />
                  {labels.groupBy && <DetailRow label="Grouped by" value={labels.groupBy} />}
                  <DetailRow label="Aggregation" value={labels.aggregation} />
                  {sheetTitle && <DetailRow label="Source" value={sheetTitle} />}
                </div>
                {filters.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5 flex items-center gap-1">
                      <Filter className="w-3 h-3" /> Filters
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {filters.map((f, i) => (
                        <span key={i} className="chip text-[10px]">{formatFilter(f)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function DetailRow({ label, value }) {
  return (
    <>
      <div className="text-ink-500 uppercase tracking-wider text-[10px] font-semibold pt-1">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </>
  );
}
