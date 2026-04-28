


import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Database, Hash, Type, Calendar,
  Sparkles, Save, Trash2, ChevronUp, ChevronDown, Pencil,
  Plus, AlertCircle, CheckSquare, Square,
  BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon,
  Layers, AlignLeft, ScatterChart as ScatterIcon, Boxes,
  Filter as FunnelIcon, CircleDot, Grid3x3, TrendingUp, Link2,
} from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ChartRenderer from '../components/charts/ChartRenderer.jsx';
import ChartEditorPanel from '../components/charts/ChartEditorPanel.jsx';
import ColumnSelector from '../components/sheet/ColumnSelector.jsx';
import ColumnUsageCard from '../components/dashboard/ColumnUsageCard.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { useSocket, getGlobalSocket } from '../hooks/useSocket.js';
import { describeChart, columnsUsed } from '../utils/chartLabels.js';
import { getAxisCandidates } from '../utils/columnInsights.js';
import { looksNumeric } from '../utils/chartTransform.js';

const STEPS = [
  { key: 'preview', label: 'Preview data' },
  { key: 'columns', label: 'Select columns' },
  { key: 'charts', label: 'Add charts' },
  { key: 'finalize', label: 'Save' },
];

const TYPE_ICONS = { number: Hash, string: Type, date: Calendar };

export default function DashboardWizardPage() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [sheet, setSheet] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savingCols, setSavingCols] = useState(false);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState([]);
  const [charts, setCharts] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/sheet/${sheetId}`);
        setSheet(data.sheet);
        setTitle(`Dashboard from ${data.sheet.title}`);
        const cols = data.sheet.columns || [];
        const persisted =
          Array.isArray(data.sheet.selectedColumns) && data.sheet.selectedColumns.length
            ? data.sheet.selectedColumns
            : cols;
        setSelected(persisted);
        // Charts are auto-generated when the user reaches step 2 — leave empty.
        setCharts([]);
      } catch {
        toast.error('Could not load sheet');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  useEffect(() => {
    if (!sheet?._id) return;
    const id = String(sheet._id);
    const s = getGlobalSocket();
    s.emit('subscribe:sheet', id);
    return () => s.emit('unsubscribe:sheet', id);
  }, [sheet?._id]);

  useSocket(
    {
      'sheet:updated': async (msg) => {
        if (!sheet || msg.sheetId !== String(sheet._id)) return;
        const { data } = await api.get(`/sheet/${sheet._id}`);
        setSheet(data.sheet);
        toast.info('Sheet updated — preview refreshed');
      },
    },
    [sheet?._id]
  );

  const rows = sheet?.rawData || [];
  const allCols = sheet?.columns || [];
  const types = sheet?.detectedTypes || {};
  const visibleCols = useMemo(() => allCols.filter((c) => selected.includes(c)), [allCols, selected]);
  const numericVisible = useMemo(() => visibleCols.filter((c) => types[c] === 'number'), [visibleCols, types]);

  const canNext = useMemo(() => {
    if (!sheet) return false;
    if (step === 0) return rows.length > 0;
    if (step === 1) return selected.length > 0;
    if (step === 2) return charts.length > 0 && charts.every((c) => Boolean(c.xField));
    if (step === 3) return Boolean(title.trim()) && charts.length > 0;
    return false;
  }, [step, sheet, rows, selected, charts, title]);

  async function persistColumns() {
    if (!sheet) return;
    setSavingCols(true);
    try {
      await api.patch(`/sheet/${sheet._id}/columns`, { selectedColumns: selected });
      // Keep local sheet in sync so the recommender sees the latest pick
      setSheet((s) => (s ? { ...s, selectedColumns: [...selected] } : s));
    } catch {
      // non-blocking; we'll still proceed
    } finally {
      setSavingCols(false);
    }
  }

  async function next() {
    if (!canNext) return;
    if (step === 1) await persistColumns();
    if (step === 2) {
      // sanitize chart fields when leaving the charts step
      setCharts((arr) =>
        arr.map((c) => ({
          ...c,
          xField: selected.includes(c.xField) ? c.xField : selected[0] || '',
          yField: c.yField && !selected.includes(c.yField) ? '' : c.yField,
          groupBy: c.groupBy && !selected.includes(c.groupBy) ? '' : c.groupBy,
        }))
      );
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  async function save() {
    if (!canNext) return;
    setBusy(true);
    try {
      const { data } = await api.post('/dashboard', {
        sheetId,
        title: title.trim(),
        charts,
      });
      toast.success(`Dashboard created with ${charts.length} chart${charts.length === 1 ? '' : 's'}`);
      navigate(`/app/dashboards/${data.dashboard._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not create dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold">Build a dashboard</h1>
            <p className="text-sm text-ink-500 mt-0.5">
              {sheet ? <>From sheet <span className="font-medium text-ink-700 dark:text-ink-200">{sheet.title}</span></> : 'Loading sheet…'}
            </p>
          </div>
        </div>
      </header>

      <Stepper step={step} />

      <div className="mt-6 min-h-[420px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={STEPS[step].key}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            {!sheet && step === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CardSkeleton /><CardSkeleton />
              </div>
            ) : step === 0 ? (
              <PreviewStep sheet={sheet} />
            ) : step === 1 ? (
              <ColumnsStep
                sheet={sheet}
                selected={selected}
                onChange={setSelected}
              />
            ) : step === 2 ? (
              <ChartsStep
                charts={charts}
                setCharts={setCharts}
                sheet={sheet}
                rows={rows}
                selected={selected}
              />
            ) : (
              <FinalizeStep
                charts={charts}
                rows={rows}
                title={title}
                setTitle={setTitle}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button onClick={back} disabled={step === 0} className="btn-secondary disabled:opacity-40">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} disabled={!canNext || savingCols} className="btn-primary disabled:opacity-50">
            {savingCols ? 'Saving…' : <>Next <ArrowRight className="w-4 h-4" /></>}
          </button>
        ) : (
          <button onClick={save} disabled={!canNext || busy} className="btn-primary disabled:opacity-50">
            <Save className="w-4 h-4" /> {busy ? 'Creating…' : 'Create dashboard'}
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <div className="card p-4">
      <ol className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.key} className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-brand-500 text-white shadow-ring'
                      : 'bg-ink-100 dark:bg-ink-800 text-ink-500'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <div className={`text-sm font-medium ${active ? 'text-ink-900 dark:text-white' : 'text-ink-500'} hidden sm:block`}>
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`hidden sm:block w-8 h-px ${done ? 'bg-emerald-500' : 'bg-ink-200 dark:bg-ink-700'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PreviewStep({ sheet }) {
  const rows = sheet?.rawData || [];
  const cols = sheet?.columns || [];
  const types = sheet?.detectedTypes || {};
  const display = rows.slice(0, 25);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{sheet.title}</div>
            <div className="text-xs text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="chip">{rows.length} rows</span>
              <span className="chip">{cols.length} columns</span>
              <span className="chip">auto-typed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="label mb-3">Columns</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {cols.map((c) => {
            const t = types[c] || 'string';
            const Icon = TYPE_ICONS[t] || Type;
            return (
              <div key={c} className="px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800/50 flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-brand-500" />
                <div className="text-sm font-medium truncate flex-1">{c}</div>
                <div className="text-[10px] uppercase tracking-wider text-ink-500">{t}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between">
          <div className="font-semibold text-sm">Data preview</div>
          <div className="text-xs text-ink-500">First {display.length} of {rows.length}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead className="bg-ink-50 dark:bg-ink-800/30">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="text-left px-4 py-2.5 font-semibold text-ink-600 dark:text-ink-300 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.map((r, i) => (
                <tr key={i} className="border-t border-ink-200/60 dark:border-ink-800/60">
                  {cols.map((c) => (
                    <td key={c} className="px-4 py-2 whitespace-nowrap">{r[c] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ColumnsStep({ sheet, selected, onChange }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <ColumnSelector
          columns={sheet?.columns || []}
          types={sheet?.detectedTypes || {}}
          selected={selected}
          onChange={onChange}
          height={420}
        />
      </div>
      <div className="card p-5">
        <div className="font-semibold mb-2">Why this matters</div>
        <p className="text-sm text-ink-500 leading-relaxed">
          Only the columns you check will be available when picking X / Y / group axes.
          Useful for hiding internal IDs, audit columns, or anything you don&apos;t want in your charts.
        </p>
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Numeric — usable as Y-axis</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Date — auto-sortable</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-ink-400" /> Text — usable as X-axis or group-by</div>
        </div>
        <div className="mt-5 chip">
          <Sparkles className="w-3 h-3" /> Saved on the sheet
        </div>
      </div>
    </div>
  );
}

const COL_ICON = { number: Hash, string: Type, date: Calendar };

const CHART_TYPE_OPTIONS = [
  { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { id: 'line', label: 'Line Chart', icon: LineIcon },
  { id: 'donut', label: 'Donut Chart', icon: PieIcon },
  { id: 'area', label: 'Area Chart', icon: AreaIcon },
  { id: 'stackedBar', label: 'Stacked Bar', icon: Layers },
  { id: 'horizontalBar', label: 'Horizontal Bar', icon: AlignLeft },
  { id: 'scatter', label: 'Scatter Plot', icon: ScatterIcon },
  { id: 'treemap', label: 'Treemap', icon: Boxes },
  { id: 'funnel', label: 'Funnel Chart', icon: FunnelIcon },
  { id: 'radial', label: 'Radial Bar', icon: CircleDot },
  { id: 'heatmap', label: 'Heatmap', icon: Grid3x3 },
  { id: 'waterfall', label: 'Waterfall Chart', icon: TrendingUp },
];

function makeChartId() {
  return Math.random().toString(36).slice(2);
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

function ChartsStep({ charts, setCharts, sheet, rows, selected }) {
  const types = sheet?.detectedTypes || {};

  const liveSheet = useMemo(
    () => (sheet ? { ...sheet, selectedColumns: selected } : null),
    [sheet, selected]
  );
  const candidates = useMemo(
    () => (liveSheet ? getAxisCandidates(liveSheet) : { xCandidates: [], excluded: { urls: [], ids: [] } }),
    [liveSheet]
  );
  const plottableCols = candidates.xCandidates;
  const skippedUrls = candidates.excluded.urls || [];

  // Numeric-eligible columns for the Y-axis (multi-checkbox).
  // Promotes string-typed columns whose values parse as numbers (e.g. "120 MB").
  const numericCols = useMemo(
    () => plottableCols.filter(
      (c) => types[c] === 'number' || (types[c] !== 'date' && looksNumeric(rows || [], c))
    ),
    [plottableCols, types, rows]
  );

  // ─────────── Builder form state ───────────
  const [chartTypes, setChartTypes] = useState(['bar']);
  const [xField, setXField] = useState('');
  const [yColumns, setYColumns] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [aggregation, setAggregation] = useState('sum');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Initialise sane defaults whenever the column selection changes upstream.
  useEffect(() => {
    if (!xField || !plottableCols.includes(xField)) {
      setXField(plottableCols[0] || '');
    }
    setYColumns((prev) => prev.filter((c) => numericCols.includes(c)));
    setGroupBy((prev) => (prev && plottableCols.includes(prev) ? prev : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plottableCols.join('|'), numericCols.join('|')]);

  // Pre-check the first 1-2 numeric columns by default if user hasn't picked any.
  useEffect(() => {
    if (yColumns.length === 0 && numericCols.length > 0) {
      setYColumns(numericCols.slice(0, Math.min(2, numericCols.length)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericCols.join('|')]);

  const allTypesChecked = chartTypes.length === CHART_TYPE_OPTIONS.length;
  const allYChecked = yColumns.length === numericCols.length && numericCols.length > 0;

  function toggleType(t) {
    setChartTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
    setError('');
  }
  function toggleAllTypes() {
    setChartTypes(allTypesChecked ? [] : CHART_TYPE_OPTIONS.map((t) => t.id));
    setError('');
  }
  function toggleY(col) {
    setYColumns((p) => (p.includes(col) ? p.filter((c) => c !== col) : [...p, col]));
    setError('');
  }
  function toggleAllY() {
    setYColumns(allYChecked ? [] : [...numericCols]);
    setError('');
  }

  // Build a fully-shaped chart config from the form.
  function buildChartConfig(type) {
    const isPie = type === 'donut' || type === 'radial' || type === 'treemap' || type === 'funnel';
    const useMultiY = yColumns.length >= 2 && !isPie;
    return {
      id: makeChartId(),
      type,
      title: '',
      xField,
      yField: useMultiY ? '' : (yColumns[0] || ''),
      yFields: useMultiY ? yColumns : [],
      groupBy: useMultiY ? '' : groupBy,
      aggregation: yColumns.length > 0 ? aggregation : 'count',
      filters: [],
      config: {},
      layout: { x: 0, y: 0, w: 6, h: 4 },
    };
  }

  // Live preview chart = first selected type with current axes.
  const previewChart = useMemo(() => {
    if (!xField || chartTypes.length === 0) return null;
    return buildChartConfig(chartTypes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xField, yColumns, groupBy, aggregation, chartTypes]);

  function addCharts() {
    if (!xField) { setError('Pick an X axis column'); return; }
    if (chartTypes.length === 0) { setError('Pick at least one chart type'); return; }
    const newCharts = chartTypes.map((t) => buildChartConfig(t));
    console.log('[wizard] add', newCharts.length, 'chart(s)');
    setCharts((arr) => [...(arr || []), ...newCharts]);
    setError('');
  }

  function clearAll() {
    setCharts([]);
  }
  function removeChart(chartId) {
    setCharts((arr) => (arr || []).filter((c) => c.id !== chartId));
  }
  function moveChart(chartId, dir) {
    setCharts((arr) => {
      const idx = arr.findIndex((c) => c.id === chartId);
      if (idx < 0) return arr;
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      const out = [...arr];
      [out[idx], out[target]] = [out[target], out[idx]];
      return out;
    });
  }
  function updateChart(chartId, patch) {
    setCharts((arr) => (arr || []).map((c) => (c.id === chartId ? { ...c, ...patch } : c)));
  }

  const editingChart = useMemo(
    () => (editingId ? charts.find((c) => c.id === editingId) || null : null),
    [editingId, charts]
  );

  return (
    <div className="space-y-6">
      {/* Custom Chart Builder form */}
      <div className="card p-5 space-y-5">
        <div>
          <h3 className="font-semibold text-base">Custom chart builder</h3>
          <p className="text-xs text-ink-500 mt-1">
            Pick chart types, X/Y axes, and group-by — then click Add.
            Repeat to build your dashboard chart by chart.
          </p>
        </div>

        {/* Plottable columns chips (read-only) */}
        <div>
          <div className="label mb-2">Available columns · {plottableCols.length}</div>
          {plottableCols.length === 0 ? (
            <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 px-3 py-4 text-sm text-ink-500">
              No plottable columns. Go back and pick at least one column that isn&apos;t a URL.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {plottableCols.map((c) => {
                const t = types[c] || 'string';
                const Icon = COL_ICON[t] || Hash;
                const chipCls =
                  numericCols.includes(c)
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                    : t === 'date'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                    : 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/20';
                return (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${chipCls}`}
                  >
                    <Icon className="w-3 h-3" />
                    {c}
                  </span>
                );
              })}
            </div>
          )}
          {skippedUrls.length > 0 && (
            <p className="text-[11px] text-ink-500 mt-2 flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              <span className="font-medium">Shown only in data table:</span> {skippedUrls.join(', ')}
            </p>
          )}
        </div>

        {/* Chart types multi-checkbox */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <label className="label">
              Chart types · {chartTypes.length} of {CHART_TYPE_OPTIONS.length}
            </label>
            <button onClick={toggleAllTypes} className="btn-ghost text-xs py-1">
              {allTypesChecked ? <><Square className="w-3 h-3" /> Clear</> : <><CheckSquare className="w-3 h-3" /> Select all</>}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {CHART_TYPE_OPTIONS.map((t) => {
              const checked = chartTypes.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleType(t.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition ${
                    checked
                      ? 'border-brand-500 bg-brand-500/10 shadow-ring'
                      : 'border-ink-200 dark:border-ink-800 hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-800/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={checked}
                    className="w-3.5 h-3.5 accent-brand-500 pointer-events-none"
                  />
                  <t.icon className={`w-4 h-4 flex-shrink-0 ${checked ? 'text-brand-600' : 'text-ink-400'}`} />
                  <span className="text-sm font-medium truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-500 mt-2">
            Picking multiple chart types creates one chart per type using the same X/Y configuration.
          </p>
        </div>

        {/* Two columns: axes form + live preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="label">X axis</label>
              <select
                value={xField}
                onChange={(e) => { setXField(e.target.value); setError(''); }}
                className="input mt-1.5"
              >
                <option value="">— pick a column —</option>
                {plottableCols.map((c) => (
                  <option key={c} value={c}>
                    {c} · {types[c] || 'string'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="label">
                  Y axis (multi-select) · {yColumns.length} of {numericCols.length}
                </label>
                <button onClick={toggleAllY} className="btn-ghost text-xs py-1" disabled={numericCols.length === 0}>
                  {allYChecked ? <><Square className="w-3 h-3" /> Clear</> : <><CheckSquare className="w-3 h-3" /> Select all</>}
                </button>
              </div>
              {numericCols.length === 0 ? (
                <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 px-3 py-3 text-xs text-ink-500">
                  No numeric columns detected — chart will count rows.
                </div>
              ) : (
                <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 max-h-[180px] overflow-y-auto p-1">
                  {numericCols.map((c) => {
                    const checked = yColumns.includes(c);
                    return (
                      <label
                        key={c}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer transition ${
                          checked ? 'bg-brand-500/10 hover:bg-brand-500/15' : 'hover:bg-ink-100 dark:hover:bg-ink-800/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleY(c)}
                          className="w-4 h-4 accent-brand-500 cursor-pointer"
                        />
                        <Hash className={`w-3.5 h-3.5 ${checked ? 'text-brand-600' : 'text-ink-400'}`} />
                        <span className="font-medium text-sm flex-1 truncate">{c}</span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600">
                          number
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Group by (optional)</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="input mt-1.5"
                  disabled={yColumns.length >= 2}
                  title={yColumns.length >= 2 ? 'Disabled when 2+ Y columns are picked' : ''}
                >
                  <option value="">— none —</option>
                  {plottableCols.filter((c) => c !== xField).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Aggregation</label>
                <select
                  value={aggregation}
                  onChange={(e) => setAggregation(e.target.value)}
                  className="input mt-1.5"
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="count">Count</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Live preview</label>
              {previewChart && <span className="chip text-[10px]">{describeChart(previewChart).typeLabel}</span>}
            </div>
            <div className="card p-3">
              {previewChart ? (
                <ChartRenderer chart={previewChart} rows={rows || []} height={220} />
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-ink-500 text-center px-4">
                  Pick an X axis and at least one chart type to see a preview.
                </div>
              )}
              {previewChart && columnsUsed(previewChart).length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
                    Columns used
                  </span>
                  {columnsUsed(previewChart).map((c) => (
                    <span
                      key={c}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

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

        <button
          onClick={addCharts}
          disabled={!xField || chartTypes.length === 0}
          className="btn-primary w-full py-2.5 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add {chartTypes.length > 1 ? `${chartTypes.length} charts` : 'chart'}
        </button>
      </div>

      {/* Charts already added */}
      {charts.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-semibold">Charts in your dashboard · {charts.length}</div>
              <div className="text-xs text-ink-500 mt-0.5">
                Click a chart to edit its settings, drag arrows to reorder.
              </div>
            </div>
            <button onClick={clearAll} className="btn-ghost text-xs">
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence initial={false}>
              {charts.map((c, i) => (
                <ChartTile
                  key={c.id}
                  chart={c}
                  rows={rows}
                  index={i}
                  total={charts.length}
                  onEdit={() => setEditingId(c.id)}
                  onMove={(dir) => moveChart(c.id, dir)}
                  onRemove={() => removeChart(c.id)}
                  onRename={(t) => updateChart(c.id, { title: t })}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Reference: how each column is used */}
      <ColumnUsageCard sheet={liveSheet} />

      {/* Per-chart editor (opened from a tile's Edit button) */}
      <ChartEditorPanel
        open={!!editingChart}
        chart={editingChart}
        sheet={liveSheet}
        rows={rows}
        title="Edit chart"
        onSave={(updated) => editingChart && updateChart(editingChart.id, updated)}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

function ChartTile({ chart, rows, index, total, onEdit, onMove, onRemove, onRename }) {
  const labels = describeChart(chart);
  const usedCols = columnsUsed(chart);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="card p-4 hover:shadow-ring transition group flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-500/10 text-brand-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {index + 1}
            </div>
            <input
              value={chart.title || ''}
              onChange={(e) => onRename(e.target.value)}
              placeholder={labels.autoTitle}
              className="bg-transparent font-semibold text-sm focus:outline-none flex-1 min-w-0"
            />
          </div>
          <div className="text-[11px] text-ink-500 mt-1 truncate">{labels.subtitle}</div>
        </div>
        <span className="chip uppercase text-[10px] tracking-wider flex-shrink-0">{labels.typeLabel}</span>
      </div>

      <div className="rounded-xl bg-ink-50/60 dark:bg-ink-800/30 p-2 flex-1">
        <ChartRenderer chart={chart} rows={rows} height={180} />
      </div>

      {usedCols.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mr-1">
            Columns used
          </span>
          {usedCols.map((c) => (
            <span
              key={c}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mt-2">
        {onEdit && (
          <button onClick={onEdit} className="btn-secondary text-xs py-1.5 px-2.5 flex-1" title="Edit chart">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        <button onClick={() => onMove(-1)} disabled={index === 0} className="btn-ghost p-1.5 disabled:opacity-30" title="Move up">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="btn-ghost p-1.5 disabled:opacity-30" title="Move down">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button onClick={onRemove} className="btn-danger p-1.5" title="Remove">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function FinalizeStep({ charts, rows, title, setTitle }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <label className="label">Dashboard title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input mt-1.5 text-base font-medium"
          placeholder="Q3 sales overview"
        />
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-500 flex-wrap">
          <span className="chip">{charts.length} charts</span>
          {charts.map((c) => {
            const l = describeChart(c);
            return (
              <span key={c.id} className="chip">
                <Sparkles className="w-3 h-3" /> {l.title}
              </span>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Final preview</div>
          <span className="text-xs text-ink-500">This is exactly how it will render.</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map((c) => {
            const l = describeChart(c);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="card p-5"
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{l.title}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5 truncate">{l.subtitle}</div>
                  </div>
                  <span className="chip flex-shrink-0">{l.typeLabel}</span>
                </div>
                <ChartRenderer chart={c} rows={rows} height={280} />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
