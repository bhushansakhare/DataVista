import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sheet, Plus, RefreshCw, Trash2, Database, ArrowRight, Columns3,
  Sparkles, ExternalLink,
} from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { fmtDateTime } from '../utils/format.js';
import Modal from '../components/ui/Modal.jsx';
import ColumnSelector from '../components/sheet/ColumnSelector.jsx';
import AiSuggestionsModal from '../components/ai/AiSuggestionsModal.jsx';
import ViewToggle from '../components/ui/ViewToggle.jsx';
import Pagination, { PAGE_SIZE } from '../components/ui/Pagination.jsx';

export default function SheetsPage() {
  const [sheets, setSheets] = useState(null);
  const [editing, setEditing] = useState(null); // {sheet, selected}
  const [savingCols, setSavingCols] = useState(false);
  const [aiSheet, setAiSheet] = useState(null); // sheet summary for AI modal
  const [view, setView] = useState(() => localStorage.getItem('sf_sheets_view') || 'grid');
  const [page, setPage] = useState(1);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => { localStorage.setItem('sf_sheets_view', view); }, [view]);
  useEffect(() => { setPage(1); }, [sheets?.length, view]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/sheet');
        setSheets(data.sheets);
      } catch {
        toast.error('Could not load sheets');
        setSheets([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(id) {
    try {
      const { data } = await api.post(`/sheet/${id}/refresh`);
      setSheets((arr) => arr.map((s) => (s._id === id ? { ...s, ...data.sheet, rawData: undefined } : s)));
      toast.success('Sheet refreshed');
    } catch {
      toast.error('Refresh failed');
    }
  }

  async function remove(id) {
    if (!confirm('Delete this sheet? Dashboards using it will break.')) return;
    try {
      await api.delete(`/sheet/${id}`);
      setSheets((arr) => arr.filter((s) => s._id !== id));
      toast.success('Sheet deleted');
    } catch {
      toast.error('Delete failed');
    }
  }

  async function openColumnEditor(s) {
    try {
      const { data } = await api.get(`/sheet/${s._id}`);
      const sheet = data.sheet;
      const sel = Array.isArray(sheet.selectedColumns) && sheet.selectedColumns.length
        ? sheet.selectedColumns
        : sheet.columns;
      setEditing({ sheet, selected: sel });
    } catch {
      toast.error('Could not load sheet');
    }
  }

  async function saveColumns() {
    if (!editing) return;
    setSavingCols(true);
    try {
      const { data } = await api.patch(`/sheet/${editing.sheet._id}/columns`, {
        selectedColumns: editing.selected,
      });
      setSheets((arr) => arr.map((s) =>
        s._id === editing.sheet._id ? { ...s, selectedColumns: data.sheet.selectedColumns } : s
      ));
      toast.success('Column selection saved');
      setEditing(null);
    } catch {
      toast.error('Could not save');
    } finally {
      setSavingCols(false);
    }
  }

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((sheets?.length || 0) / PAGE_SIZE)),
    [sheets?.length],
  );
  const visible = useMemo(
    () => (sheets || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sheets, page],
  );

  const handlers = {
    onAi: (s) => setAiSheet(s),
    onBuild: (s) => navigate(`/app/dashboards/new/${s._id}`),
    onColumns: openColumnEditor,
    onRefresh: (s) => refresh(s._id),
    onDelete: (s) => remove(s._id),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Sheets</h1>
          <p className="text-sm text-ink-500 mt-0.5">Connected Google Sheets.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sheets && sheets.length > 0 && <ViewToggle value={view} onChange={setView} />}
          <button onClick={() => navigate('/app/sheets/import')} className="btn-primary">
            <Plus className="w-4 h-4" /> Import sheet
          </button>
        </div>
      </header>

      {sheets === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      ) : sheets.length === 0 ? (
        <EmptyState
          icon={Sheet}
          title="No sheets connected"
          description="Paste a public Google Sheet URL and we'll pull it in for you."
          action={
            <Link to="/app/sheets/import" className="btn-primary">
              <Plus className="w-4 h-4" /> Import sheet
            </Link>
          }
        />
      ) : (
        <>
          {view === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visible.map((s) => <SheetCard key={s._id} s={s} {...handlers} />)}
            </div>
          )}
          {view === 'list' && (
            <div className="space-y-2">
              {visible.map((s) => <SheetRow key={s._id} s={s} {...handlers} />)}
            </div>
          )}
          {view === 'table' && (
            <SheetTable rows={visible} {...handlers} />
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Columns — ${editing.sheet.title}` : 'Columns'}
        size="xl"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
            <button onClick={saveColumns} disabled={savingCols || !editing?.selected?.length} className="btn-primary disabled:opacity-50">
              {savingCols ? 'Saving…' : 'Save selection'}
            </button>
          </>
        }
      >
        {editing && (
          <ColumnSelector
            columns={editing.sheet.columns || []}
            types={editing.sheet.detectedTypes || {}}
            selected={editing.selected}
            onChange={(sel) => setEditing((e) => ({ ...e, selected: sel }))}
            height={420}
          />
        )}
      </Modal>

      <AiSuggestionsModal
        open={!!aiSheet}
        onClose={() => setAiSheet(null)}
        sheetSummary={aiSheet}
      />
    </div>
  );
}

/* ─── Card view (the original layout) ─────────────────────────────── */

function SheetCard({ s, onAi, onBuild, onColumns, onRefresh, onDelete }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{s.title}</div>
          <div className="text-xs text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="chip"><Database className="w-3 h-3" /> {s.rowCount} rows</span>
            <span className="chip">{(s.columns || []).length} cols</span>
            <span>last sync {fmtDateTime(s.lastSyncedAt)}</span>
          </div>
          {s.sheetUrl && (
            <a
              href={s.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline truncate max-w-full"
              title={s.sheetUrl}
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{shortenSheetUrl(s.sheetUrl)}</span>
            </a>
          )}
        </div>
      </div>

      <button
        onClick={() => onAi(s)}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold bg-gradient-to-r from-brand-500 to-purple-500 text-white hover:opacity-95 transition shadow-sm"
      >
        <Sparkles className="w-4 h-4" /> Generate AI Dashboard
      </button>

      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => onBuild(s)} className="btn-secondary flex-1">
          Build manually <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={() => onColumns(s)} className="btn-secondary p-2.5" title="Manage columns">
          <Columns3 className="w-4 h-4" />
        </button>
        <button onClick={() => onRefresh(s)} className="btn-secondary p-2.5" title="Refresh now">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(s)} className="btn-danger p-2.5" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── List view: compact horizontal row ───────────────────────────── */

function SheetRow({ s, onAi, onBuild, onColumns, onRefresh, onDelete }) {
  return (
    <div className="card p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
      <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center flex-shrink-0">
        <Sheet className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">{s.title}</div>
        <div className="text-[11px] text-ink-500 flex items-center gap-2 flex-wrap mt-0.5">
          <span><Database className="w-3 h-3 inline -mt-0.5" /> {s.rowCount} rows</span>
          <span>·</span>
          <span>{(s.columns || []).length} cols</span>
          <span>·</span>
          <span>last sync {fmtDateTime(s.lastSyncedAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => onAi(s)} className="btn-primary text-xs py-1.5" title="Generate AI Dashboard">
          <Sparkles className="w-3.5 h-3.5" /> AI
        </button>
        <button onClick={() => onBuild(s)} className="btn-secondary p-1.5" title="Build manually">
          <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={() => onColumns(s)} className="btn-secondary p-1.5" title="Manage columns">
          <Columns3 className="w-4 h-4" />
        </button>
        <button onClick={() => onRefresh(s)} className="btn-secondary p-1.5" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(s)} className="btn-danger p-1.5" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── Table view: dense and sortable-looking ──────────────────────── */

function SheetTable({ rows, onAi, onBuild, onColumns, onRefresh, onDelete }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead className="bg-ink-50 dark:bg-ink-800/30">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Title</th>
              <th className="text-left px-4 py-2.5 font-semibold">Rows</th>
              <th className="text-left px-4 py-2.5 font-semibold">Cols</th>
              <th className="text-left px-4 py-2.5 font-semibold">Last sync</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                <td className="px-4 py-2 font-medium">
                  <div className="truncate max-w-[280px]">{s.title}</div>
                  {s.sheetUrl && (
                    <a
                      href={s.sheetUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-brand-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      <ExternalLink className="w-3 h-3" /> source
                    </a>
                  )}
                </td>
                <td className="px-4 py-2">{s.rowCount}</td>
                <td className="px-4 py-2">{(s.columns || []).length}</td>
                <td className="px-4 py-2 text-ink-500 text-xs">{fmtDateTime(s.lastSyncedAt)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => onAi(s)} className="btn-ghost p-1.5 text-brand-600" title="AI dashboard">
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button onClick={() => onBuild(s)} className="btn-ghost p-1.5" title="Build manually">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => onColumns(s)} className="btn-ghost p-1.5" title="Columns">
                    <Columns3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onRefresh(s)} className="btn-ghost p-1.5" title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(s)} className="btn-ghost p-1.5 text-rose-500" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function shortenSheetUrl(u) {
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname.length > 1 ? parsed.pathname : '';
    const trimmed = `${host}${path}`;
    return trimmed.length > 48 ? `${trimmed.slice(0, 47)}…` : trimmed;
  } catch {
    return u.length > 50 ? `${u.slice(0, 49)}…` : u;
  }
}
