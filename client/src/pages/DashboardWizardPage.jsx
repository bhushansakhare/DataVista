import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Database, Hash, Type, Calendar,
  Sparkles, Save, Plus, Trash2, ChevronUp, ChevronDown, Pencil,
} from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ChartRenderer from '../components/charts/ChartRenderer.jsx';
import ChartEditorPanel from '../components/charts/ChartEditorPanel.jsx';
import ColumnSelector from '../components/sheet/ColumnSelector.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { useSocket, getGlobalSocket } from '../hooks/useSocket.js';
import { describeChart } from '../utils/chartLabels.js';

const STEPS = [
  { key: 'preview', label: 'Preview data' },
  { key: 'columns', label: 'Select columns' },
  { key: 'charts', label: 'Add charts' },
  { key: 'finalize', label: 'Save' },
];

const TYPE_ICONS = { number: Hash, string: Type, date: Calendar };

function newChart(defaults = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'bar',
    title: 'Untitled chart',
    xField: '',
    yField: '',
    groupBy: '',
    aggregation: 'sum',
    filters: [],
    config: {},
    layout: { x: 0, y: 0, w: 6, h: 4 },
    ...defaults,
  };
}

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
        const types = data.sheet.detectedTypes || {};
        const firstNum = persisted.find((c) => types[c] === 'number') || cols.find((c) => types[c] === 'number');
        const firstNonNum = persisted.find((c) => types[c] !== 'number') || persisted[0] || cols[0];
        setCharts([
          newChart({
            type: 'bar',
            title: firstNum && firstNonNum ? `${firstNum} by ${firstNonNum}` : 'Chart 1',
            xField: firstNonNum || '',
            yField: firstNum || '',
          }),
        ]);
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
    if (step === 3) return Boolean(title.trim());
    return false;
  }, [step, sheet, rows, selected, charts, title]);

  async function persistColumns() {
    if (!sheet) return;
    setSavingCols(true);
    try {
      await api.patch(`/sheet/${sheet._id}/columns`, { selectedColumns: selected });
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
                cols={visibleCols}
                numericCols={numericVisible}
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
        <div className="label mb-3">Detected columns</div>
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

function ChartsStep({ charts, setCharts, sheet, rows, cols, numericCols }) {
  const [editingId, setEditingId] = useState(null);

  const editingChart = useMemo(
    () => (editingId ? charts.find((c) => c.id === editingId) || null : null),
    [editingId, charts]
  );

  function add() {
    if (!Array.isArray(cols) || cols.length === 0) {
      console.warn('[wizard] add chart blocked: no columns selected');
      return;
    }
    const numeric = numericCols[0] || '';
    const cat = cols.find((c) => c !== numeric) || cols[0] || '';
    const next = newChart({
      title: '',
      type: charts.length % 2 === 0 ? 'bar' : 'line',
      xField: cat,
      yField: numeric,
    });
    console.log('[wizard] add chart:', next);
    setCharts((arr) => [...(arr || []), next]);
    setEditingId(next.id);
  }
  function update(chartId, patch) {
    console.log('[wizard] update chart', chartId, patch);
    setCharts((arr) => (arr || []).map((c) => (c.id === chartId ? { ...c, ...patch } : c)));
  }
  function remove(chartId) {
    console.log('[wizard] remove chart', chartId);
    setCharts((arr) => (arr || []).filter((c) => c.id !== chartId));
    setEditingId((curr) => (curr === chartId ? null : curr));
  }
  function move(chartId, dir) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-semibold">Charts in this dashboard</div>
          <div className="text-xs text-ink-500 mt-0.5">
            {charts.length} chart{charts.length === 1 ? '' : 's'} configured · click any chart to edit
          </div>
        </div>
        <button onClick={add} className="btn-primary">
          <Plus className="w-4 h-4" /> Add chart
        </button>
      </div>

      {charts.length === 0 ? (
        <EmptyChartsTile onAdd={add} />
      ) : (
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
                onMove={(dir) => move(c.id, dir)}
                onRemove={() => remove(c.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ChartEditorPanel
        open={!!editingChart}
        chart={editingChart}
        sheet={sheet}
        rows={rows}
        title="Edit chart"
        onSave={(updated) => editingChart && update(editingChart.id, updated)}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

function EmptyChartsTile({ onAdd }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-12 text-center"
    >
      <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white">
        <Sparkles className="w-7 h-7" />
      </div>
      <div className="font-semibold text-lg mt-4">No charts added yet</div>
      <p className="text-sm text-ink-500 mt-1.5 max-w-sm mx-auto">
        Click <span className="font-semibold text-ink-700 dark:text-ink-200">Add chart</span> to start
        building. Each click creates a new chart with a live preview you can tweak.
      </p>
      <button onClick={onAdd} className="btn-primary mt-6">
        <Plus className="w-4 h-4" /> Add your first chart
      </button>
    </motion.div>
  );
}

function ChartTile({ chart, rows, index, total, onEdit, onMove, onRemove }) {
  const labels = describeChart(chart);
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
            <div className="font-semibold truncate">{labels.title}</div>
          </div>
          <div className="text-[11px] text-ink-500 mt-1 truncate">{labels.subtitle}</div>
        </div>
        <span className="chip uppercase text-[10px] tracking-wider flex-shrink-0">{labels.typeLabel}</span>
      </div>

      <div className="rounded-xl bg-ink-50/60 dark:bg-ink-800/30 p-2 flex-1">
        {chart.xField ? (
          <ChartRenderer chart={chart} rows={rows} height={180} />
        ) : (
          <div className="h-[180px] flex items-center justify-center text-xs text-ink-500 text-center px-4">
            Pick an X axis column to preview.
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mt-3">
        <button onClick={onEdit} className="btn-secondary flex-1 py-1.5 text-xs">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button onClick={() => onMove(-1)} disabled={index === 0} className="btn-ghost p-1.5 disabled:opacity-30" title="Move up">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="btn-ghost p-1.5 disabled:opacity-30" title="Move down">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button onClick={onRemove} disabled={total <= 1} className="btn-danger p-1.5 disabled:opacity-30" title="Remove">
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
