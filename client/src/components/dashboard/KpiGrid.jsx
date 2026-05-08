import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, Columns3, Database, Clock, DollarSign, Sigma, Diamond,
  AlertCircle, Copy, ChevronDown, ShieldCheck, Link2, Calendar, Layers,
} from 'lucide-react';
import { buildKpis, buildPerColumnKpis } from '../../utils/businessKpis.js';

/**
 * Business-style KPI grid (PowerBI-flavored).
 *
 *  ┌─ headline tiles (Total Records, Total Data Size, Total Duration, …)
 *  └─ per-column tiles (one per visible column — Total <col>, <col>: N categories, …)
 *
 * Both reflect active filters via `useMemo` deps.
 */
export default function KpiGrid({ sheet, filters = [] }) {
  const kpi = useMemo(() => buildKpis(sheet, filters), [sheet, filters]);
  const perColumn = useMemo(() => buildPerColumnKpis(sheet, filters), [sheet, filters]);
  const [colsOpen, setColsOpen] = useState(false);

  const tiles = kpi?.tiles || [
    { key: 'records', icon: 'records', accent: 'brand', label: 'Total Records', value: '0', sublabel: 'no data loaded' },
  ];
  const meta = kpi?.meta || { totalRows: 0, filteredFromRows: 0, filterActive: false };

  const allWipedByFilters = meta.filterActive && meta.totalRows === 0;
  const noRows = !meta.filterActive && meta.totalRows === 0;

  return (
    <div className="space-y-3">
      {allWipedByFilters && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-2.5 text-[13px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Active filters return <span className="font-semibold">0 rows</span> — clear or widen your filters to see data.
          </span>
        </div>
      )}
      {noRows && (
        <div className="rounded-xl border border-ink-200/60 dark:border-ink-700/60 bg-ink-50/60 dark:bg-ink-800/40 px-4 py-2.5 text-[13px] text-ink-600 dark:text-ink-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>No data rows yet — refresh the sheet or check the source.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t, i) => (
          <KpiTile key={t.key || `${t.label}-${i}`} {...t} index={i} />
        ))}
      </div>

      {perColumn.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setColsOpen((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-ink-50 dark:hover:bg-ink-800/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Column metrics</div>
                <div className="text-[11px] text-ink-500">
                  {perColumn.length} column{perColumn.length === 1 ? '' : 's'} · totals, counts and category breakdowns
                </div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${colsOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence initial={false}>
            {colsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-ink-200/60 dark:border-ink-800/60"
              >
                <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {perColumn.map((t, i) => (
                    <KpiTile key={t.key || `${t.label}-${i}`} {...t} index={i} dense />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

const ICON_MAP = {
  records:    Hash,
  'data-size': Database,
  duration:   Clock,
  currency:   DollarSign,
  sum:        Sigma,
  unique:     Diamond,
  missing:    ShieldCheck,
  duplicates: Copy,
  columns:    Columns3,
  link:       Link2,
  date:       Calendar,
  category:   Layers,
};

const ACCENT_CLS = {
  brand:    'from-brand-500/15 to-brand-500/5 text-brand-600',
  emerald:  'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  amber:    'from-amber-500/15 to-amber-500/5 text-amber-600',
  rose:     'from-rose-500/15 to-rose-500/5 text-rose-600',
  purple:   'from-purple-500/15 to-purple-500/5 text-purple-600',
  ink:      'from-ink-500/15 to-ink-500/5 text-ink-600',
};

function KpiTile({ icon, label, value, sublabel, accent = 'brand', index = 0, dense = false }) {
  const Icon = ICON_MAP[icon] || Hash;
  const cls = ACCENT_CLS[accent] || ACCENT_CLS.brand;
  // Adaptive value font: shrink long strings so they don't truncate.
  const valueLen = String(value).length;
  const valueSize =
    valueLen >= 18 ? 'text-base'
    : valueLen >= 12 ? 'text-lg'
    : dense ? 'text-lg'
    : 'text-xl';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={`card ${dense ? 'p-3' : 'p-4'} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider font-bold text-ink-500 truncate" title={String(label)}>{label}</div>
          <div className={`${valueSize} font-extrabold mt-1 tabular-nums break-words leading-tight tracking-tight text-ink-900 dark:text-white`} title={String(value)}>
            {value}
          </div>
          {sublabel && (
            <div className="text-[11px] text-ink-500 mt-1 truncate" title={String(sublabel)}>
              {sublabel}
            </div>
          )}
        </div>
        <div className={`${dense ? 'w-8 h-8' : 'w-9 h-9'} rounded-xl bg-gradient-to-br ${cls} flex items-center justify-center flex-shrink-0`}>
          <Icon className={dense ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </div>
      </div>
    </motion.div>
  );
}
