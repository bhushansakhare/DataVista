import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, X } from 'lucide-react';
import { useColumnReasoning } from '../../hooks/useColumnReasoning.js';
import { ROLES, colsByRole, pickFirstByRole } from '../../utils/columnReasoning.js';

const STORAGE_KEY = 'sf_dismissed_summary_banners';

function joinList(arr, max = 3) {
  if (!arr || arr.length === 0) return '';
  if (arr.length <= max) return arr.join(', ');
  return `${arr.slice(0, max).join(', ')} +${arr.length - max} more`;
}

function readDismissed() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeDismissed(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function summarize(sheet, reasoning) {
  if (!sheet) return null;
  const time = pickFirstByRole(reasoning, ROLES.TIME);
  const metrics = colsByRole(reasoning, ROLES.METRIC);
  const cats = colsByRole(reasoning, ROLES.CATEGORY);

  if (time && metrics.length >= 1) {
    return `This dashboard analyses your data over time using ${time} as the timeline and tracks ${joinList(metrics)}.`;
  }
  if (cats.length && metrics.length) {
    return `This dashboard breaks down ${joinList(metrics)} across ${joinList(cats)}.`;
  }
  if (cats.length >= 2) {
    return `This dashboard compares the distribution of records across ${joinList(cats)}.`;
  }
  if (cats.length === 1) {
    return `This dashboard shows the distribution of records across ${cats[0]}.`;
  }
  if (metrics.length) {
    return `This dashboard summarises ${joinList(metrics)} from ${sheet.title || 'your sheet'}.`;
  }
  return `This dashboard summarises ${sheet.rowCount ?? 'your'} rows from ${sheet.title || 'your sheet'}.`;
}

export default function DashboardSummaryBanner({ sheet, dashboardId, dismissible = true }) {
  const reasoning = useColumnReasoning(sheet);
  const summary = useMemo(() => summarize(sheet, reasoning), [sheet, reasoning]);
  const key = dashboardId || sheet?._id || 'global';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissible) return;
    const map = readDismissed();
    setDismissed(Boolean(map[key]));
  }, [key, dismissible]);

  if (!summary) return null;

  function dismiss() {
    setDismissed(true);
    if (!dismissible) return;
    const map = readDismissed();
    map[key] = Date.now();
    writeDismissed(map);
  }

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mb-4 rounded-xl bg-gradient-to-br from-brand-500/10 via-purple-500/5 to-transparent border border-brand-500/20 px-4 py-3 flex items-start gap-3"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-500/15 text-brand-600 flex items-center justify-center flex-shrink-0">
            <Wand2 className="w-3.5 h-3.5" />
          </div>
          <p className="text-sm text-ink-700 dark:text-ink-200 leading-relaxed flex-1">
            {summary}
          </p>
          {dismissible && (
            <button
              onClick={dismiss}
              className="btn-ghost p-1.5 -mr-1 -mt-1 flex-shrink-0"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
