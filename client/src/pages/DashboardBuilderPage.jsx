import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Save, ChevronUp, ChevronDown, Sparkles, Wand2 } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import ChartEditorPanel from '../components/charts/ChartEditorPanel.jsx';
import SuggestChartsModal from '../components/charts/SuggestChartsModal.jsx';
import { useSocket, getGlobalSocket } from '../hooks/useSocket.js';

function makeChart(defaults = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'bar',
    title: '',
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

function pickDefaults(sheet) {
  const types = sheet?.detectedTypes || {};
  const all = sheet?.columns || [];
  const selected = Array.isArray(sheet?.selectedColumns) && sheet.selectedColumns.length
    ? sheet.selectedColumns
    : all;
  const visible = all.filter((c) => selected.includes(c));
  const numeric = visible.find((c) => types[c] === 'number') || '';
  const cat = visible.find((c) => c !== numeric) || visible[0] || '';
  return { xField: cat, yField: numeric };
}

export default function DashboardBuilderPage() {
  const { sheetId, id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [sheet, setSheet] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const isEdit = Boolean(id);

  useEffect(() => {
    (async () => {
      try {
        if (isEdit) {
          const { data } = await api.get(`/dashboard/${id}`);
          setDashboard(data.dashboard);
          setSheet(data.sheet);
        } else {
          const { data } = await api.get(`/sheet/${sheetId}`);
          setSheet(data.sheet);
          const seed = makeChart({
            type: 'bar',
            ...pickDefaults(data.sheet),
          });
          setDashboard({
            title: `Dashboard from ${data.sheet.title}`,
            description: '',
            sheetId: data.sheet._id,
            charts: [seed],
          });
        }
      } catch {
        toast.error('Could not load');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sheetId]);

  useSocket(
    sheet?._id
      ? {
          'sheet:updated': async (msg) => {
            if (msg.sheetId !== String(sheet._id)) return;
            const { data } = await api.get(`/sheet/${sheet._id}`);
            setSheet(data.sheet);
            toast.info('Sheet updated — preview refreshed');
          },
        }
      : {},
    [sheet?._id]
  );

  useEffect(() => {
    if (!sheet?._id) return;
    const sid = String(sheet._id);
    const s = getGlobalSocket();
    s.emit('subscribe:sheet', sid);
    return () => s.emit('unsubscribe:sheet', sid);
  }, [sheet?._id]);

  const rows = sheet?.rawData || [];

  const editingChart = useMemo(() => {
    if (!editingId || !dashboard) return null;
    return dashboard.charts.find((c) => c.id === editingId) || null;
  }, [editingId, dashboard]);

  async function save() {
    setBusy(true);
    try {
      if (isEdit) {
        const { data } = await api.put(`/dashboard/${id}`, {
          title: dashboard.title,
          description: dashboard.description,
          charts: dashboard.charts,
        });
        setDashboard(data.dashboard);
        toast.success('Dashboard saved');
      } else {
        const { data } = await api.post('/dashboard', {
          sheetId: sheet._id,
          title: dashboard.title,
          description: dashboard.description,
          charts: dashboard.charts,
        });
        toast.success('Dashboard created');
        navigate(`/app/dashboards/${data.dashboard._id}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  function addChart() {
    if (!sheet) {
      console.warn('[builder] add chart blocked: sheet not loaded yet');
      toast.error('Sheet still loading — try again in a moment');
      return;
    }
    const next = makeChart({
      type: (dashboard.charts || []).length % 2 === 0 ? 'bar' : 'line',
      ...pickDefaults(sheet),
    });
    console.log('[builder] add chart:', next);
    setDashboard((d) => ({ ...d, charts: [...(d.charts || []), next] }));
    setEditingId(next.id);
  }

  function updateChart(chartId, patch) {
    console.log('[builder] update chart', chartId, patch);
    setDashboard((d) => ({
      ...d,
      charts: (d.charts || []).map((c) => (c.id === chartId ? { ...c, ...patch } : c)),
    }));
  }

  function removeChart(chartId) {
    console.log('[builder] remove chart', chartId);
    setDashboard((d) => ({ ...d, charts: (d.charts || []).filter((c) => c.id !== chartId) }));
    setEditingId((curr) => (curr === chartId ? null : curr));
  }

  function moveChart(chartId, dir) {
    setDashboard((d) => {
      const idx = d.charts.findIndex((c) => c.id === chartId);
      if (idx < 0) return d;
      const target = idx + dir;
      if (target < 0 || target >= d.charts.length) return d;
      const charts = [...d.charts];
      [charts[idx], charts[target]] = [charts[target], charts[idx]];
      return { ...d, charts };
    });
  }

  function applySuggestions(suggested) {
    if (!Array.isArray(suggested) || suggested.length === 0) return;
    console.log('[builder] apply', suggested.length, 'suggested charts');
    setDashboard((d) => ({ ...d, charts: [...(d.charts || []), ...suggested] }));
    toast.success(`Added ${suggested.length} suggested chart${suggested.length === 1 ? '' : 's'}`);
  }

  if (!dashboard || !sheet) {
    return (
      <div className="p-10 flex items-center gap-3 text-ink-500">
        <div className="h-5 w-5 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button>
          <input
            value={dashboard.title}
            onChange={(e) => setDashboard((d) => ({ ...d, title: e.target.value }))}
            className="bg-transparent text-2xl font-extrabold focus:outline-none flex-1 min-w-0"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setSuggestOpen(true)} className="btn-secondary" title="AI-suggested charts">
            <Wand2 className="w-4 h-4" /> Suggest charts
          </button>
          <button onClick={addChart} className="btn-secondary"><Plus className="w-4 h-4" /> Add chart</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-50">
            <Save className="w-4 h-4" /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {(dashboard.charts || []).length === 0 ? (
        <EmptyChartsState onAdd={addChart} />
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboard.charts.map((c, i) => (
            <div key={c.id} className="relative group">
              <ChartCard
                chart={c}
                rows={rows}
                onEdit={() => setEditingId(c.id)}
                onDelete={() => removeChart(c.id)}
                height={300}
                sheetTitle={sheet?.title}
              />
              <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => moveChart(c.id, -1)}
                  disabled={i === 0}
                  className="btn-secondary p-1.5 disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveChart(c.id, 1)}
                  disabled={i === dashboard.charts.length - 1}
                  className="btn-secondary p-1.5 disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      <ChartEditorPanel
        open={!!editingChart}
        chart={editingChart}
        sheet={sheet}
        rows={rows}
        title={editingChart ? `Edit chart` : 'Edit chart'}
        onSave={(updated) => editingChart && updateChart(editingChart.id, updated)}
        onClose={() => setEditingId(null)}
      />

      <SuggestChartsModal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        sheet={sheet}
        rows={rows}
        onApply={applySuggestions}
      />
    </div>
  );
}

function EmptyChartsState({ onAdd }) {
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
        building your dashboard. Each chart gets its own card with a live preview.
      </p>
      <button onClick={onAdd} className="btn-primary mt-6">
        <Plus className="w-4 h-4" /> Add your first chart
      </button>
    </motion.div>
  );
}
