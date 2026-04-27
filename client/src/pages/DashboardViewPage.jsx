import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Pencil, RefreshCw, Share2, ArrowLeft, Plus, Sparkles } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import { useSocket, getGlobalSocket } from '../hooks/useSocket.js';
import ShareModal from '../components/dashboard/ShareModal.jsx';
import SourceDataPanel from '../components/dashboard/SourceDataPanel.jsx';
import SummaryStats from '../components/dashboard/SummaryStats.jsx';
import SectionHeader from '../components/dashboard/SectionHeader.jsx';
import { fmtDateTime } from '../utils/format.js';

const PAGE_SIZE = 6;

export default function DashboardViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/dashboard/${id}`);
      setDashboard(data.dashboard);
      setSheet(data.sheet);
    } catch {
      toast.error('Could not load dashboard');
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!sheet?._id) return;
    const s = getGlobalSocket();
    s.emit('subscribe:sheet', String(sheet._id));
    return () => s.emit('unsubscribe:sheet', String(sheet._id));
  }, [sheet?._id]);

  useSocket({
    'sheet:updated': async (msg) => {
      if (!sheet || msg.sheetId !== String(sheet._id)) return;
      const { data } = await api.get(`/sheet/${sheet._id}`);
      setSheet(data.sheet);
      toast.info('Live update — sheet refreshed');
    },
  }, [sheet?._id]);

  async function refresh() {
    try {
      const { data } = await api.post(`/sheet/${sheet._id}/refresh`);
      setSheet(data.sheet);
      toast.success('Refreshed');
    } catch {
      toast.error('Refresh failed');
    }
  }

  if (!dashboard) return <div className="p-10 text-ink-500">Loading…</div>;

  const rows = sheet?.rawData || [];
  const charts = dashboard.charts || [];
  const visible = charts.slice(0, visibleCount);
  const remaining = charts.length - visibleCount;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/app')} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold truncate">{dashboard.title}</h1>
            <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <Link to={`/app/sheets`} className="hover:text-brand-600">{sheet?.title}</Link>
              <span>·</span>
              <span>{charts.length} chart{charts.length === 1 ? '' : 's'}</span>
              <span>·</span>
              <span>last sync {fmtDateTime(sheet?.lastSyncedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={refresh} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setShareOpen(true)} className="btn-secondary"><Share2 className="w-4 h-4" /> Share</button>
          <Link to={`/app/dashboards/${id}/edit`} className="btn-primary"><Pencil className="w-4 h-4" /> Edit dashboard</Link>
        </div>
      </div>

      {charts.length === 0 ? (
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
            Click <span className="font-semibold text-ink-700 dark:text-ink-200">Add charts</span> to
            start building your dashboard. You can add as many as you need.
          </p>
          <Link to={`/app/dashboards/${id}/edit`} className="btn-primary mt-6 inline-flex">
            <Plus className="w-4 h-4" /> Add charts
          </Link>
        </motion.div>
      ) : (
        <>
          <SummaryStats sheet={sheet} />

          <SectionHeader
            title="Charts"
            subtitle="Bar, line and pie charts for numeric and categorical data"
          />

          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map((c) => (
              <ChartCard
                key={c.id}
                chart={c}
                rows={rows}
                height={300}
                sheetTitle={sheet?.title}
                onEdit={() => navigate(`/app/dashboards/${id}/edit`)}
              />
            ))}
          </motion.div>

          {remaining > 0 && (
            <div className="mt-6 flex items-center justify-center">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="btn-secondary"
              >
                Load {Math.min(remaining, PAGE_SIZE)} more · {remaining} remaining
              </button>
            </div>
          )}

          {visibleCount > PAGE_SIZE && remaining === 0 && (
            <div className="mt-6 flex items-center justify-center">
              <button onClick={() => setVisibleCount(PAGE_SIZE)} className="btn-ghost text-xs">
                Collapse charts
              </button>
            </div>
          )}
        </>
      )}

      <SourceDataPanel sheet={sheet} />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} dashboardId={id} />
    </div>
  );
}
