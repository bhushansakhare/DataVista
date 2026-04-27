import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Plus, Eye, Pencil, Trash2, BarChart3, FileSpreadsheet, Calendar,
} from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { fmtDateTime } from '../utils/format.js';

export default function DashboardListPage() {
  const [dashboards, setDashboards] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/dashboard');
        setDashboards(data.dashboards);
      } catch (err) {
        toast.error('Could not load dashboards');
        setDashboards([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id) {
    if (!confirm('Delete this dashboard? This cannot be undone.')) return;
    try {
      await api.delete(`/dashboard/${id}`);
      setDashboards((arr) => arr.filter((d) => d._id !== id));
      toast.success('Dashboard deleted');
    } catch {
      toast.error('Could not delete');
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboards</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {dashboards?.length
              ? `${dashboards.length} dashboard${dashboards.length === 1 ? '' : 's'} in your workspace`
              : 'All dashboards in your workspace.'}
          </p>
        </div>
        <button onClick={() => navigate('/app/sheets/import')} className="btn-primary">
          <Plus className="w-4 h-4" /> New dashboard
        </button>
      </header>

      {dashboards === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : dashboards.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No dashboards yet"
          description="Import a Google Sheet and build your first dashboard in minutes."
          action={
            <Link to="/app/sheets/import" className="btn-primary">
              <Plus className="w-4 h-4" /> Import a sheet
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d, i) => (
            <DashboardListCard
              key={d._id}
              dashboard={d}
              index={i}
              onDelete={() => remove(d._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardListCard({ dashboard: d, index, onDelete }) {
  const chartCount = Array.isArray(d.charts) ? d.charts.length : 0;
  const sheetTitle = d.sheetId?.title || 'Unknown sheet';
  const sheetCols = d.sheetId?.columns?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="card p-5 hover:shadow-ring transition flex flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
          <LayoutDashboard className="w-5 h-5" />
        </div>
        <span className="chip flex-shrink-0">
          <BarChart3 className="w-3 h-3" /> {chartCount} chart{chartCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-4 min-w-0">
        <Link
          to={`/app/dashboards/${d._id}`}
          className="font-semibold text-base block truncate hover:text-brand-600 transition"
          title={d.title}
        >
          {d.title}
        </Link>
        {d.description && (
          <p className="text-xs text-ink-500 mt-1 line-clamp-2">{d.description}</p>
        )}
      </div>

      <dl className="mt-4 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-ink-500">
          <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
          <dt className="sr-only">Source sheet</dt>
          <dd className="truncate" title={sheetTitle}>
            {sheetTitle}{sheetCols ? ` · ${sheetCols} columns` : ''}
          </dd>
        </div>
        <div className="flex items-center gap-2 text-ink-500">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <dt className="sr-only">Last updated</dt>
          <dd className="truncate">Updated {fmtDateTime(d.updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Link
          to={`/app/dashboards/${d._id}`}
          className="btn-secondary text-xs py-2 justify-center"
          title="View dashboard"
        >
          <Eye className="w-3.5 h-3.5" /> View
        </Link>
        <Link
          to={`/app/dashboards/${d._id}/edit`}
          className="btn-secondary text-xs py-2 justify-center"
          title="Edit charts"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Link>
        <button
          onClick={onDelete}
          className="btn-danger text-xs py-2 justify-center"
          title="Delete dashboard"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </motion.div>
  );
}
