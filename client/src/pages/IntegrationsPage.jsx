import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plug, Plus, Trash2, RefreshCw, Globe, Sheet as SheetIcon, Database, Table as TableIcon,
  FileText, Sparkles, AlertCircle,
} from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ConnectIntegrationModal from '../components/integrations/ConnectIntegrationModal.jsx';
import ViewToggle from '../components/ui/ViewToggle.jsx';
import Pagination, { PAGE_SIZE as SHARED_PAGE_SIZE } from '../components/ui/Pagination.jsx';

const TYPE_META = {
  rest_api:      { label: 'REST API',      icon: Globe,     ready: true  },
  google_sheets: { label: 'Google Sheets', icon: SheetIcon, ready: true  },
  airtable:      { label: 'Airtable',      icon: TableIcon, ready: true  },
  notion:        { label: 'Notion',        icon: FileText,  ready: true  },
  postgres:      { label: 'Postgres',      icon: Database,  ready: false },
};

const PAGE_SIZE = SHARED_PAGE_SIZE;

export default function IntegrationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState(() => localStorage.getItem('sf_integrations_view') || 'grid');
  useEffect(() => { localStorage.setItem('sf_integrations_view', view); }, [view]);
  useEffect(() => { setPage(1); }, [view]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/integrations');
      setItems(Array.isArray(data?.integrations) ? data.integrations : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not load integrations');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleFetch(id) {
    setBusyId(id);
    try {
      const { data } = await api.post(`/integrations/${id}/fetch-data`);
      toast.success(`Fetched ${data.rowCount} rows. Opening AI Assistant…`);
      setItems((arr) => arr.map((it) => (it._id === id ? data.integration : it)));
      // Pipe the fetched rows into the existing AI Assistant flow via
      // router state. AiAssistantPage reads `state.fetchedRows` on mount
      // and runs the same upload + generate pipeline as a CSV file.
      navigate('/app/ai', {
        state: {
          fetchedRows: data.rows,
          fetchedColumns: data.columns,
          fetchedName: data.integration?.name || 'Integration data',
          fetchedFrom: 'integration',
        },
      });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Fetch failed');
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/integrations/${item._id}`);
      setItems((arr) => arr.filter((it) => it._id !== item._id));
      toast.success('Integration deleted');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Delete failed');
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <Plug className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-tight">Integration Hub</h1>
            <p className="text-sm text-ink-500 leading-tight mt-0.5">
              Connect external data sources. Fetch rows, then pipe them into your dashboards.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle value={view} onChange={setView} />
          <button onClick={() => setConnectOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Connect Source
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 h-40 animate-pulse bg-ink-100/40 dark:bg-ink-800/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-brand-500" />
          <div className="font-semibold mt-3">No integrations yet</div>
          <p className="text-sm text-ink-500 mt-1.5 max-w-sm mx-auto">
            Connect a REST API, Google Sheet, Airtable, or Notion database to pipe live data into your dashboards.
          </p>
          <button onClick={() => setConnectOpen(true)} className="btn-primary mt-5 inline-flex">
            <Plus className="w-4 h-4" /> Connect your first source
          </button>
        </div>
      ) : (
        <>
          {view === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visible.map((item, i) => (
                <IntegrationCard
                  key={item._id}
                  item={item}
                  index={i}
                  busy={busyId === item._id}
                  onFetch={() => handleFetch(item._id)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          )}
          {view === 'list' && (
            <div className="space-y-2">
              {visible.map((item) => (
                <IntegrationRow
                  key={item._id}
                  item={item}
                  busy={busyId === item._id}
                  onFetch={() => handleFetch(item._id)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          )}
          {view === 'table' && (
            <IntegrationTable
              rows={visible}
              busyId={busyId}
              onFetch={handleFetch}
              onDelete={handleDelete}
            />
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <ConnectIntegrationModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={(integration) => {
          setItems((arr) => [integration, ...arr]);
          setConnectOpen(false);
          setPage(1);
          toast.success(`Connected "${integration.name}"`);
        }}
      />
    </div>
  );
}

function IntegrationCard({ item, index, busy, onFetch, onDelete }) {
  const meta = TYPE_META[item.type] || { label: item.type, icon: Plug, ready: true };
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="card p-5 group"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight truncate">{item.name}</div>
          <div className="text-[11px] text-ink-500 mt-0.5">{meta.label}</div>
        </div>
        <button
          onClick={onDelete}
          className="text-ink-500 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-3 text-[12px] text-ink-500 space-y-1">
        {item.lastSyncAt ? (
          <div>Last sync: {new Date(item.lastSyncAt).toLocaleString()} · {item.lastSyncRows} rows</div>
        ) : (
          <div>Not synced yet</div>
        )}
        {item.lastError && (
          <div className="text-rose-600 dark:text-rose-400 flex items-start gap-1.5 text-[11px]">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{item.lastError}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onFetch}
          disabled={busy || !meta.ready}
          className="btn-primary flex-1 justify-center"
          title={meta.ready ? 'Fetch data' : 'Connector not yet enabled'}
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Fetching…' : 'Fetch data'}
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Compact list-view row ─── */
function IntegrationRow({ item, busy, onFetch, onDelete }) {
  const meta = TYPE_META[item.type] || { label: item.type, icon: Plug, ready: true };
  const Icon = meta.icon;
  return (
    <div className="card p-3 px-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{item.name}</div>
        <div className="text-[11px] text-ink-500 truncate">
          {meta.label} · {item.lastSyncAt
            ? `synced ${new Date(item.lastSyncAt).toLocaleString()} · ${item.lastSyncRows} rows`
            : 'not synced yet'}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onFetch} disabled={busy || !meta.ready} className="btn-primary text-xs py-1.5 px-3">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? '…' : 'Fetch'}
        </button>
        <button onClick={onDelete} className="btn-danger text-xs py-1.5 px-2" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Table view ─── */
function IntegrationTable({ rows, busyId, onFetch, onDelete }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-ink-200/60 dark:border-ink-800/60">
          <tr className="text-left text-[11px] uppercase tracking-wider font-bold text-ink-500">
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Last sync</th>
            <th className="px-4 py-2.5 text-right">Rows</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const meta = TYPE_META[item.type] || { label: item.type, ready: true };
            const busy = busyId === item._id;
            return (
              <tr key={item._id} className="border-b border-ink-200/40 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                <td className="px-4 py-2.5 font-medium">{item.name}</td>
                <td className="px-4 py-2.5 text-ink-500">{meta.label}</td>
                <td className="px-4 py-2.5 text-ink-500 truncate max-w-[18ch]">
                  {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{item.lastSyncRows ?? 0}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1.5">
                    <button onClick={() => onFetch(item._id)} disabled={busy || !meta.ready} className="btn-primary text-xs py-1 px-2">
                      <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} /> {busy ? '…' : 'Fetch'}
                    </button>
                    <button onClick={() => onDelete(item)} className="btn-danger text-xs py-1 px-2"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
