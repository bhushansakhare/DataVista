import { useMemo } from 'react';
import { BarChart3, CalendarRange, PieChart, Link2, FileText, IdCard } from 'lucide-react';
import { analyzeSheet } from '../../utils/columnInsights.js';
import { looksNumeric } from '../../utils/chartTransform.js';

export default function ColumnUsageCard({ sheet }) {
  const sections = useMemo(() => {
    if (!sheet) return [];
    const a = analyzeSheet(sheet);
    const rows = Array.isArray(sheet.rawData) ? sheet.rawData : [];
    const types = sheet.detectedTypes || {};
    const allCols = Array.isArray(sheet.columns) ? sheet.columns : [];
    const selected = Array.isArray(sheet.selectedColumns) && sheet.selectedColumns.length
      ? sheet.selectedColumns
      : allCols;
    const visible = allCols.filter((c) => selected.includes(c));

    // Promote string columns whose values parse as numbers (e.g. "120 MB").
    const numericNames = new Set([
      ...a.numeric.map((c) => c.name),
      ...visible.filter(
        (c) => types[c] !== 'number' && types[c] !== 'date' && looksNumeric(rows, c)
      ),
    ]);
    const dateNames = new Set(a.date.map((c) => c.name));
    const categoryNames = new Set(a.category.map((c) => c.name).filter((n) => !numericNames.has(n)));
    const urlNames = new Set(a.url.map((c) => c.name));
    const idNames = new Set(a.id.map((c) => c.name).filter((n) => !numericNames.has(n)));
    const tableOnly = visible.filter(
      (c) => !numericNames.has(c) && !dateNames.has(c) && !categoryNames.has(c) && !urlNames.has(c) && !idNames.has(c)
    );

    const out = [
      {
        key: 'plot',
        title: 'Plotted as values',
        icon: BarChart3,
        cls: 'bg-emerald-500/10 text-emerald-600',
        desc: 'Numeric columns shown as Y-axis series in the combined chart and trend line.',
        cols: [...numericNames],
      },
      {
        key: 'date',
        title: 'Used as time axis',
        icon: CalendarRange,
        cls: 'bg-amber-500/10 text-amber-600',
        desc: 'Date columns drive the X-axis of the combined and trend charts.',
        cols: [...dateNames],
      },
      {
        key: 'cat',
        title: 'Used for grouping',
        icon: PieChart,
        cls: 'bg-brand-500/10 text-brand-600',
        desc: 'Categorical columns power the distribution donut and breakdown bar.',
        cols: [...categoryNames],
      },
      {
        key: 'url',
        title: 'Clickable links in table',
        icon: Link2,
        cls: 'bg-purple-500/10 text-purple-600',
        desc: 'URL columns are kept out of charts and shown as clickable links in the data table.',
        cols: [...urlNames],
      },
      {
        key: 'id',
        title: 'Identifiers (table only)',
        icon: IdCard,
        cls: 'bg-ink-200/50 dark:bg-ink-800 text-ink-600 dark:text-ink-300',
        desc: 'ID-style columns stay in the data table — not useful as chart axes.',
        cols: [...idNames],
      },
      {
        key: 'table',
        title: 'Shown in data table',
        icon: FileText,
        cls: 'bg-ink-200/50 dark:bg-ink-800 text-ink-600 dark:text-ink-300',
        desc: 'High-cardinality text (titles, names) — visible only in the source data preview.',
        cols: tableOnly,
      },
    ].filter((s) => s.cols.length > 0);
    return out;
  }, [sheet]);

  if (!sections.length) return null;

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <div className="font-semibold">How your data is used</div>
          <p className="text-xs text-ink-500 mt-0.5">
            Every column from your sheet has a clear role in this dashboard.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {sections.map((s) => (
          <div key={s.key} className="rounded-xl bg-ink-50/60 dark:bg-ink-800/30 border border-ink-200/40 dark:border-ink-800/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.cls}`}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
              <div className="font-semibold text-sm">{s.title}</div>
            </div>
            <p className="text-[11px] text-ink-500 mb-3 leading-relaxed">{s.desc}</p>
            <div className="flex flex-wrap gap-1.5">
              {s.cols.map((c) => (
                <span
                  key={c}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white dark:bg-ink-900/60 border border-ink-200/60 dark:border-ink-800/60"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
