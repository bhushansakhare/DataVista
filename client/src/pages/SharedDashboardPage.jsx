import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import api from '../api/client.js';
import ChartCard from '../components/charts/ChartCard.jsx';
import SourceDataPanel from '../components/dashboard/SourceDataPanel.jsx';
import KpiGrid from '../components/dashboard/KpiGrid.jsx';
import DashboardFilters from '../components/dashboard/DashboardFilters.jsx';
import SectionHeader from '../components/dashboard/SectionHeader.jsx';
import ColumnUsageCard from '../components/dashboard/ColumnUsageCard.jsx';
import DashboardSummaryBanner from '../components/dashboard/DashboardSummaryBanner.jsx';
import { applyFilters } from '../utils/chartTransform.js';

const PAGE_SIZE = 6;

export default function SharedDashboardPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/share/${token}`);
        setData(data);
      } catch (err) {
        setError(err?.response?.data?.error || 'Link not found');
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-mesh-light dark:bg-mesh-dark">
        <div className="card p-10 text-center max-w-md">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="font-semibold text-lg mt-4">Link unavailable</div>
          <div className="text-sm text-ink-500 mt-1.5">{error}</div>
          <Link to="/" className="btn-primary mt-6 inline-flex">Go home</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh-light dark:bg-mesh-dark">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  return <SharedView data={data} />;
}

function SharedView({ data }) {
  const { dashboard, sheet } = data;
  const rawRows = sheet?.rawData || [];
  const [filters, setFilters] = useState([]);
  const rows = useMemo(() => applyFilters(rawRows, filters), [rawRows, filters]);
  const charts = dashboard.charts || [];
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = charts.slice(0, visibleCount);
  const remaining = charts.length - visibleCount;
  const noRawRows = rawRows.length === 0;
  const filtersWipedAll = !noRawRows && rows.length === 0 && filters.length > 0;

  return (
    <div className="min-h-screen bg-mesh-light dark:bg-mesh-dark">
      <header className="glass border-b border-ink-200/60 dark:border-ink-800/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{dashboard.title}</div>
              <div className="text-[11px] text-ink-500">Shared via SheetFlow Analytics</div>
            </div>
          </div>
          <Link to="/register" className="btn-primary hidden sm:inline-flex">
            Build your own <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8">
        <DashboardSummaryBanner sheet={sheet} dashboardId={dashboard?._id} dismissible={false} />

        {noRawRows && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Sheet has no rows yet</div>
              <div className="opacity-80 mt-0.5">Charts will appear once the owner refreshes the source.</div>
            </div>
          </div>
        )}

        {filtersWipedAll && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Filters return 0 rows</div>
              <div className="opacity-80 mt-0.5">Clear or widen filters above to see chart data.</div>
              <button onClick={() => setFilters([])} className="btn-secondary mt-2 text-xs py-1 px-2">
                Clear all filters
              </button>
            </div>
          </div>
        )}

        <DashboardFilters sheet={sheet} filters={filters} onChange={setFilters} />

        <KpiGrid sheet={sheet} filters={filters} />

        {charts.length === 0 ? (
          <div className="card p-10 text-center text-ink-500">This dashboard has no charts yet.</div>
        ) : (
          <>
            <SectionHeader
              title="Charts"
              subtitle="Bar, line and pie charts for numeric and categorical data"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visible.map((c) => (
                <ChartCard
                  key={c.id}
                  chart={c}
                  rows={rows}
                  height={300}
                  sheet={sheet}
                />
              ))}
            </div>

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
          </>
        )}

        <ColumnUsageCard sheet={sheet} />

        <SourceDataPanel sheet={sheet} />
      </main>

      <footer className="py-8 text-center text-xs text-ink-500">
        Powered by <Link to="/" className="font-semibold text-brand-600">SheetFlow Analytics</Link>
      </footer>
    </div>
  );
}

