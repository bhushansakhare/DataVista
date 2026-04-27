import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Hash, Sigma, Diamond, CalendarRange, Columns3 } from 'lucide-react';
import { summarizeSheet } from '../../utils/summarize.js';

const ICONS = {
  rows: Hash,
  sum: Sigma,
  unique: Diamond,
  date: CalendarRange,
  col: Columns3,
};

const ACCENTS = {
  rows: 'from-brand-500/15 to-brand-500/5 text-brand-600',
  sum: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  unique: 'from-purple-500/15 to-purple-500/5 text-purple-600',
  date: 'from-amber-500/15 to-amber-500/5 text-amber-600',
  col: 'from-ink-500/15 to-ink-500/5 text-ink-600',
};

export default function SummaryStats({ sheet }) {
  const stats = useMemo(() => summarizeSheet(sheet), [sheet]);
  if (!stats.length) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((s, i) => {
        const Icon = ICONS[s.icon] || Hash;
        const accent = ACCENTS[s.icon] || ACCENTS.col;
        return (
          <motion.div
            key={`${s.label}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-ink-500 truncate">
                  {s.label}
                </div>
                <div className="text-2xl font-extrabold mt-1 truncate" title={String(s.value)}>
                  {s.value}
                </div>
                {s.sublabel && (
                  <div className="text-xs text-ink-500 mt-1 truncate" title={s.sublabel}>
                    {s.sublabel}
                  </div>
                )}
              </div>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
