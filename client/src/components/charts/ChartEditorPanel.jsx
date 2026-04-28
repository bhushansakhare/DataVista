import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';
import ChartTypePicker from './ChartTypePicker.jsx';
import ChartRenderer from './ChartRenderer.jsx';
import { describeChart, columnsUsed } from '../../utils/chartLabels.js';
import { getAxisCandidates } from '../../utils/columnInsights.js';

const FILTER_OPS = [
  { id: 'equals', label: 'equals' },
  { id: 'not_equals', label: '!=' },
  { id: 'contains', label: 'contains' },
  { id: 'gt', label: '>' },
  { id: 'gte', label: '>=' },
  { id: 'lt', label: '<' },
  { id: 'lte', label: '<=' },
  { id: 'not_empty', label: 'is set' },
];

export default function ChartEditorPanel({ open, chart, sheet, rows, onSave, onClose, title = 'Chart settings' }) {
  // Derived state pattern: keep `draft` in sync with the `chart` prop without
  // an effect. If we used useEffect, the first render after `chart` becomes
  // truthy would still see the previous (possibly null) draft and crash.
  const [draft, setDraft] = useState(chart);
  const [syncedId, setSyncedId] = useState(chart?.id || null);
  const currentId = chart?.id || null;
  if (currentId !== syncedId) {
    setSyncedId(currentId);
    setDraft(chart);
  }

  // Safe data extraction — never let undefined sheet/columns crash the modal.
  // URLs are dropped from every axis; IDs are dropped from Y-axis only.
  const candidates = useMemo(() => getAxisCandidates(sheet), [sheet]);
  const cols = candidates.xCandidates;
  const numericCols = candidates.yCandidates;
  const groupCols = candidates.groupCandidates;
  const skipped = candidates.excluded;
  const safeRows = Array.isArray(rows) ? rows : [];

  // Use draft for rendering, but never assume non-null.
  const view = draft || chart;
  const isPie = view?.type === 'donut' || view?.type === 'radial';
  const labels = describeChart(view || {});
  const usedCols = columnsUsed(view || {});

  function set(patch) {
    setDraft((d) => ({ ...(d || chart || {}), ...patch }));
  }

  function commit() {
    if (!view) return;
    if (typeof console !== 'undefined') {
      console.log('[ChartEditorPanel] save chart:', view);
    }
    onSave?.(view);
    onClose?.();
  }

  // Only mount the modal contents when both `open` AND a usable `view` exist.
  // This prevents any blank-modal renders if the parent toggles `open` faster
  // than the chart prop arrives.
  const shouldRender = open && !!view;
  const filters = Array.isArray(view?.filters) ? view.filters : [];

  return (
    <AnimatePresence>
      {shouldRender && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[640px] z-50 glass border-l border-ink-200/60 dark:border-ink-800/60 flex flex-col"
          >
            <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0">
                <div className="font-semibold truncate">{title}</div>
                <div className="text-xs text-ink-500 mt-0.5 truncate">{labels.subtitle}</div>
              </div>
              <button onClick={onClose} className="btn-ghost p-1.5 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="rounded-xl bg-ink-50/60 dark:bg-ink-800/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="label flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Live preview</div>
                  <span className="chip text-[10px]">{labels.typeLabel}</span>
                </div>
                {view.xField ? (
                  <ChartRenderer chart={view} rows={safeRows} height={220} />
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-sm text-ink-500 text-center px-4">
                    Pick a column for the X axis to see a preview.
                  </div>
                )}
              </div>

              {usedCols.length > 0 && (
                <div className="rounded-lg bg-ink-50 dark:bg-ink-800/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1.5">
                    Columns used
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {usedCols.map((c) => (
                      <span
                        key={c}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white dark:bg-ink-900/60 border border-ink-200/60 dark:border-ink-800/60"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Chart title</label>
                <input
                  value={view.title || ''}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder={labels.autoTitle}
                  className="input mt-1.5"
                />
                <p className="text-[11px] text-ink-500 mt-1.5">Leave blank to use auto title: <span className="font-medium">{labels.autoTitle}</span></p>
              </div>

              <div>
                <label className="label mb-2 block">Chart type</label>
                <ChartTypePicker value={view.type} onChange={(t) => set({ type: t })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={isPie ? 'Slice / category' : 'X axis'}
                  value={view.xField}
                  options={[{ value: '', label: '— pick —' }, ...cols]}
                  onChange={(v) => set({ xField: v })}
                  hint="Categories or dates — pick what you want to break the data down by."
                />
                <Field
                  label={isPie ? 'Value' : 'Y axis'}
                  value={view.yField}
                  options={[{ value: '', label: '— count rows —' }, ...numericCols]}
                  onChange={(v) => set({ yField: v })}
                  hint={numericCols.length === 0
                    ? 'No numeric columns detected — chart will count rows.'
                    : 'Only numeric columns can be plotted as values.'}
                />
                <Field
                  label="Group by"
                  value={view.groupBy}
                  options={[{ value: '', label: '— none —' }, ...groupCols]}
                  onChange={(v) => set({ groupBy: v })}
                />
                <Field
                  label="Aggregation"
                  value={view.aggregation}
                  options={[
                    { value: 'sum', label: 'Sum' },
                    { value: 'avg', label: 'Average' },
                    { value: 'count', label: 'Count' },
                    { value: 'min', label: 'Min' },
                    { value: 'max', label: 'Max' },
                    { value: 'none', label: 'None' },
                  ]}
                  onChange={(v) => set({ aggregation: v })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">Filters</label>
                  <button
                    onClick={() => set({ filters: [...filters, { field: '', op: 'equals', value: '' }] })}
                    className="btn-ghost text-xs"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {filters.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <select
                        value={f.field || ''}
                        onChange={(e) => {
                          const arr = [...filters];
                          arr[i] = { ...f, field: e.target.value };
                          set({ filters: arr });
                        }}
                        className="input flex-1 min-w-[120px]"
                      >
                        <option value="">field…</option>
                        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        value={f.op || 'equals'}
                        onChange={(e) => {
                          const arr = [...filters];
                          arr[i] = { ...f, op: e.target.value };
                          set({ filters: arr });
                        }}
                        className="input w-28"
                      >
                        {FILTER_OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      {f.op !== 'not_empty' && (
                        <input
                          value={f.value || ''}
                          onChange={(e) => {
                            const arr = [...filters];
                            arr[i] = { ...f, value: e.target.value };
                            set({ filters: arr });
                          }}
                          className="input flex-1 min-w-[100px]"
                          placeholder="value"
                        />
                      )}
                      <button
                        onClick={() => set({ filters: filters.filter((_, j) => j !== i) })}
                        className="btn-danger p-2"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {filters.length === 0 && (
                    <div className="text-[11px] text-ink-500">No filters — chart uses every row in the sheet.</div>
                  )}
                </div>
              </div>

              {(skipped.urls.length > 0 || skipped.ids.length > 0) && (
                <div className="rounded-lg bg-ink-50 dark:bg-ink-800/40 px-3 py-2 text-[11px] text-ink-500 leading-relaxed">
                  <span className="font-semibold text-ink-700 dark:text-ink-200">Hidden from axes: </span>
                  {skipped.urls.length > 0 && (
                    <>URL columns ({skipped.urls.join(', ')}){skipped.ids.length > 0 ? ' · ' : ''}</>
                  )}
                  {skipped.ids.length > 0 && (
                    <>ID columns ({skipped.ids.join(', ')}) skipped from Y-axis</>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-ink-200/60 dark:border-ink-800/60 flex items-center gap-2 flex-shrink-0">
              <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button onClick={commit} disabled={!view.xField} className="btn-primary flex-1 disabled:opacity-50">
                Save chart
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, options, onChange, hint }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div>
      <label className="label">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input mt-1.5">
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-[10px] text-ink-500 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}
