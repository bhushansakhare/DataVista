import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Pencil, RefreshCw, Share2, ArrowLeft, Plus, Sparkles, AlertCircle, Lightbulb } from 'lucide-react';
import TemplateLayout from '../components/templates/templateChrome.jsx';
import TemplateIframe from '../components/templates/TemplateIframe.jsx';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import { useSocket, getGlobalSocket } from '../hooks/useSocket.js';
import ShareModal from '../components/dashboard/ShareModal.jsx';
import SourceDataPanel from '../components/dashboard/SourceDataPanel.jsx';
import KpiGrid from '../components/dashboard/KpiGrid.jsx';
import DashboardFilters from '../components/dashboard/DashboardFilters.jsx';
import SectionHeader from '../components/dashboard/SectionHeader.jsx';
import ColumnUsageCard from '../components/dashboard/ColumnUsageCard.jsx';
import DashboardSummaryBanner from '../components/dashboard/DashboardSummaryBanner.jsx';
import { fmtDateTime } from '../utils/format.js';
import { applyFilters } from '../utils/chartTransform.js';

const PAGE_SIZE = 6;

export default function DashboardViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState([]);

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

  // Debug log so we can verify the template path is being taken when a saved
  // dashboard has layoutType + styleConfig persisted.
  useEffect(() => {
    if (dashboard?.layoutType) {
      console.log('TEMPLATE USED:', dashboard.layoutType,
        '| STYLE:', dashboard.styleConfig,
        '| SLOTS:', dashboard.charts?.length || 0);
    }
  }, [dashboard?.layoutType, dashboard?.styleConfig, dashboard?.charts?.length]);

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

  const rawRows = sheet?.rawData || [];
  const rows = useMemo(() => applyFilters(rawRows, filters), [rawRows, filters]);

  if (!dashboard) return <div className="p-10 text-ink-500">Loading…</div>;

  const charts = dashboard.charts || [];
  const visible = charts.slice(0, visibleCount);
  const remaining = charts.length - visibleCount;
  const noRawRows = rawRows.length === 0;
  const filtersWipedAll = !noRawRows && rows.length === 0 && filters.length > 0;

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
          <DashboardSummaryBanner sheet={sheet} dashboardId={id} />

          {noRawRows && (
            <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Sheet has no rows yet</div>
                <div className="opacity-80 mt-0.5">
                  Try refreshing the source — your charts will appear once data is available.
                </div>
                <button onClick={refresh} className="btn-secondary mt-2 text-xs py-1 px-2">
                  <RefreshCw className="w-3 h-3" /> Refresh sheet
                </button>
              </div>
            </div>
          )}

          {filtersWipedAll && (
            <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Filters return 0 rows</div>
                <div className="opacity-80 mt-0.5">
                  Clear or widen filters above to see chart data.
                </div>
                <button onClick={() => setFilters([])} className="btn-secondary mt-2 text-xs py-1 px-2">
                  Clear all filters
                </button>
              </div>
            </div>
          )}

          <DashboardFilters sheet={sheet} filters={filters} onChange={setFilters} />

          {/* Raw-HTML / URL template: render the snapshotted artifact via
              sandboxed iframe. The chart pipeline isn't used here — the
              iframe is the renderer and the user's original UI shows. */}
          {dashboard.templateType === 'html' && dashboard.templateCode ? (
            <div className="rounded-2xl border border-ink-200/60 dark:border-ink-800/60 overflow-hidden bg-white dark:bg-ink-950" style={{ height: '80vh' }}>
              <TemplateIframe html={dashboard.templateCode} title={dashboard.title} height="100%" rounded={false} />
            </div>
          ) : dashboard.templateType === 'url' && dashboard.templateUrl ? (
            <div className="rounded-2xl border border-ink-200/60 dark:border-ink-800/60 overflow-hidden bg-white dark:bg-ink-950" style={{ height: '80vh' }}>
              <TemplateIframe url={dashboard.templateUrl} title={dashboard.title} height="100%" rounded={false} />
            </div>
          ) : dashboard.layoutType ? (
            <TemplateLayout
              layoutType={dashboard.layoutType}
              styleConfig={dashboard.styleConfig}
              kpis={Array.isArray(dashboard.kpis) ? dashboard.kpis : []}
              insights={Array.isArray(dashboard.insights) ? dashboard.insights : []}
              entries={visible.map((c) => ({
                chart: c,
                rows,
                meta: { simpleTitle: c.title, explanation: c.config?.explanation },
                hero: Boolean(c.config?.hero),
              }))}
            />
          ) : (
            <>
              <KpiGrid sheet={sheet} filters={filters} />

              {Array.isArray(dashboard.insights) && dashboard.insights.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> 💡 Key Insights
                  </div>
                  <div className="rounded-2xl border border-amber-200/60 dark:border-amber-500/15 bg-gradient-to-br from-amber-50/70 via-white/90 to-white/85 dark:from-amber-500/[0.06] dark:via-ink-900/40 dark:to-ink-900/30 backdrop-blur px-5 py-4 shadow-sm">
                    <ul className="space-y-3.5">
                      {dashboard.insights.map((line, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-7">
                          <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 flex-shrink-0" />
                          <span className="text-ink-700 dark:text-ink-200">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              <SectionHeader
                title="Charts"
                subtitle="Headline chart on top, supporting views below"
              />

              {visible[0]?.config?.hero ? (
            <>
              <motion.div layout className="mb-4">
                <ChartCard
                  key={visible[0].id}
                  chart={visible[0]}
                  rows={rows}
                  height={380}
                  sheet={sheet}
                  onEdit={() => navigate(`/app/dashboards/${id}/edit`)}
                />
              </motion.div>
              {visible.length > 1 && (
                <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr">
                  {visible.slice(1).map((c) => (
                    <ChartCard
                      key={c.id}
                      chart={c}
                      rows={rows}
                      height={300}
                      sheet={sheet}
                      onEdit={() => navigate(`/app/dashboards/${id}/edit`)}
                    />
                  ))}
                </motion.div>
              )}
            </>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr">
              {visible.map((c) => (
                <ChartCard
                  key={c.id}
                  chart={c}
                  rows={rows}
                  height={300}
                  sheet={sheet}
                  onEdit={() => navigate(`/app/dashboards/${id}/edit`)}
                />
              ))}
            </motion.div>
          )}
            </>
          )}

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

      <ColumnUsageCard sheet={sheet} />

      <SourceDataPanel sheet={sheet} />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} dashboardId={id} />
    </div>
  );
}
