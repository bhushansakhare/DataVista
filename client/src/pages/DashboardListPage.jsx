import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Plus, Eye, Pencil, Trash2, BarChart3, FileSpreadsheet, Calendar,
  Grid3X3, List, Table as TableIcon,
} from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { fmtDateTime } from '../utils/format.js';

const PAGE_SIZE = 5;
const VIEW_OPTIONS = [
  { key: 'grid',  label: 'Grid',  icon: Grid3X3 },
  { key: 'list',  label: 'List',  icon: List },
  { key: 'table', label: 'Table', icon: TableIcon },
];

export default function DashboardListPage() {
  const [dashboards, setDashboards] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('sf_dash_view') || 'grid');
  const [page, setPage] = useState(1);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => { localStorage.setItem('sf_dash_view', view); }, [view]);
  // Reset to page 1 whenever the dataset changes (delete, reload).
  useEffect(() => { setPage(1); }, [dashboards?.length]);

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

  const totalPages = Math.max(1, Math.ceil((dashboards?.length || 0) / PAGE_SIZE));
  const visible = (dashboards || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="inline-flex rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-0.5 bg-white/60 dark:bg-ink-900/40">
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = view === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setView(opt.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                      : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
                  }`}
                  title={opt.label}
                >
                  <Icon className="w-3.5 h-3.5" /> {opt.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => navigate('/app/sheets/import')} className="btn-primary">
            <Plus className="w-4 h-4" /> New dashboard
          </button>
        </div>
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
        <>
          {view === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((d, i) => (
                <DashboardListCard key={d._id} dashboard={d} index={i} onDelete={() => remove(d._id)} />
              ))}
            </div>
          )}
          {view === 'list' && (
            <div className="space-y-2">
              {visible.map((d) => (
                <DashboardListRow key={d._id} dashboard={d} onDelete={() => remove(d._id)} />
              ))}
            </div>
          )}
          {view === 'table' && (
            <DashboardListTable dashboards={visible} onDelete={remove} />
          )}

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

function DashboardListRow({ dashboard: d, onDelete }) {
  const chartCount = Array.isArray(d.charts) ? d.charts.length : 0;
  const sheetTitle = d.sheetId?.title || 'Unknown sheet';
  return (
    <div className="card p-3 px-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
        <LayoutDashboard className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/app/dashboards/${d._id}`} className="font-semibold text-sm block truncate hover:text-brand-600">
          {d.title}
        </Link>
        <div className="text-[11px] text-ink-500 truncate">
          {sheetTitle} · {chartCount} chart{chartCount === 1 ? '' : 's'} · Updated {fmtDateTime(d.updatedAt)}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Link to={`/app/dashboards/${d._id}`} className="btn-secondary text-xs py-1.5 px-2" title="View"><Eye className="w-3.5 h-3.5" /></Link>
        <Link to={`/app/dashboards/${d._id}/edit`} className="btn-secondary text-xs py-1.5 px-2" title="Edit"><Pencil className="w-3.5 h-3.5" /></Link>
        <button onClick={onDelete} className="btn-danger text-xs py-1.5 px-2" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function DashboardListTable({ dashboards, onDelete }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-ink-200/60 dark:border-ink-800/60">
          <tr className="text-left text-[11px] uppercase tracking-wider font-bold text-ink-500">
            <th className="px-4 py-2.5">Title</th>
            <th className="px-4 py-2.5">Source sheet</th>
            <th className="px-4 py-2.5 text-right">Charts</th>
            <th className="px-4 py-2.5">Updated</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {dashboards.map((d) => (
            <tr key={d._id} className="border-b border-ink-200/40 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
              <td className="px-4 py-2.5">
                <Link to={`/app/dashboards/${d._id}`} className="font-medium hover:text-brand-600">{d.title}</Link>
              </td>
              <td className="px-4 py-2.5 text-ink-500 truncate max-w-xs">{d.sheetId?.title || '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{Array.isArray(d.charts) ? d.charts.length : 0}</td>
              <td className="px-4 py-2.5 text-ink-500">{fmtDateTime(d.updatedAt)}</td>
              <td className="px-4 py-2.5 text-right">
                <div className="inline-flex gap-1.5">
                  <Link to={`/app/dashboards/${d._id}`} className="btn-secondary text-xs py-1 px-2"><Eye className="w-3 h-3" /></Link>
                  <Link to={`/app/dashboards/${d._id}/edit`} className="btn-secondary text-xs py-1 px-2"><Pencil className="w-3 h-3" /></Link>
                  <button onClick={() => onDelete(d._id)} className="btn-danger text-xs py-1 px-2"><Trash2 className="w-3 h-3" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} className="btn-secondary text-xs py-1.5 px-3">Prev</button>
      <div className="text-xs text-ink-500">Page {page} of {totalPages}</div>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="btn-secondary text-xs py-1.5 px-3">Next</button>
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
