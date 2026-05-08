import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BookOpen, Filter as FilterIcon, EyeOff } from 'lucide-react';
import ColumnTip from '../ui/ColumnTip.jsx';
import { useColumnReasoning } from '../../hooks/useColumnReasoning.js';
import { columnsUsed, formatFilter, describeChart } from '../../utils/chartLabels.js';

/**
 * "How this chart is built" — replaces the older "View details" disclosure.
 * Pure read-only panel; no chart-rendering or aggregation logic.
 */
export default function ChartExplanationPanel({ chart, sheet, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const reasoning = useColumnReasoning(sheet);
  if (!chart) return null;

  const labels = describeChart(chart);
  const used = columnsUsed(chart);
  const allCols = Array.isArray(sheet?.columns) ? sheet.columns : [];
  const excluded = allCols.filter((c) => !used.includes(c));
  const filters = Array.isArray(chart.filters) ? chart.filters.filter((f) => f && f.field) : [];

  const yCols = Array.isArray(chart.yFields) && chart.yFields.length
    ? chart.yFields
    : (chart.yField ? [chart.yField] : []);
  const groupCols = chart.groupBy ? [chart.groupBy] : [];
  const xCols = chart.xField ? [chart.xField] : [];

  return (
    <div className="mt-3 pt-3 border-t border-ink-200/60 dark:border-ink-800/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 transition"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <BookOpen className="w-3.5 h-3.5" /> How this chart is built
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              <Row label="X-axis"      cols={xCols}     reasoning={reasoning} fallback="—" />
              <Row label="Y-axis"      cols={yCols}     reasoning={reasoning} fallback="Row count" />
              <Row label="Grouping"    cols={groupCols} reasoning={reasoning} fallback="None" />
              <FlatRow label="Aggregation" value={labels.aggregation} />
              {sheet?.title && <FlatRow label="Source" value={sheet.title} />}

              {filters.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 flex items-center gap-1 mb-1.5">
                    <FilterIcon className="w-3 h-3" /> Filters
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {filters.map((f, i) => (
                      <span key={i} className="chip text-[10px]">{formatFilter(f)}</span>
                    ))}
                  </div>
                </div>
              )}

              {excluded.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 flex items-center gap-1 mb-1.5">
                    <EyeOff className="w-3 h-3" /> Excluded columns
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {excluded.map((c) => (
                      <ColumnTip key={c} column={c} reasoning={reasoning}>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800/60 text-ink-500 dark:text-ink-400 cursor-help">
                          {c}
                        </span>
                      </ColumnTip>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-ink-500 leading-relaxed pt-2">
                We selected these columns automatically based on data-type detection.
                Hover any column to see why.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, cols, reasoning, fallback }) {
  const has = Array.isArray(cols) && cols.length > 0;
  return (
    <div className="grid grid-cols-[80px,1fr] gap-3 items-start text-xs">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 pt-1">{label}</div>
      <div>
        {has ? (
          <div className="flex flex-wrap gap-1.5">
            {cols.map((c) => (
              <ColumnTip key={c} column={c} reasoning={reasoning}>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 cursor-help">
                  {c}
                </span>
              </ColumnTip>
            ))}
          </div>
        ) : (
          <span className="text-ink-500">{fallback}</span>
        )}
      </div>
    </div>
  );
}

function FlatRow({ label, value }) {
  return (
    <div className="grid grid-cols-[80px,1fr] gap-3 items-center text-xs">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
