import { useEffect, useState } from 'react';
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

export default function SheetsPage() {
  const [sheets, setSheets] = useState(null);
  const [editing, setEditing] = useState(null); // {sheet, selected}
  const [savingCols, setSavingCols] = useState(false);
  const [aiSheet, setAiSheet] = useState(null); // sheet summary for AI modal
  const toast = useToast();
  const navigate = useNavigate();

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Sheets</h1>
          <p className="text-sm text-ink-500 mt-0.5">Connected Google Sheets.</p>
        </div>
        <button onClick={() => navigate('/app/sheets/import')} className="btn-primary">
          <Plus className="w-4 h-4" /> Import sheet
        </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sheets.map((s) => (
            <div key={s._id} className="card p-5">
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
                onClick={() => setAiSheet(s)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold bg-gradient-to-r from-brand-500 to-purple-500 text-white hover:opacity-95 transition shadow-sm"
              >
                <Sparkles className="w-4 h-4" /> Generate AI Dashboard
              </button>

              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => navigate(`/app/dashboards/new/${s._id}`)} className="btn-secondary flex-1">
                  Build manually <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => openColumnEditor(s)} className="btn-secondary p-2.5" title="Manage columns">
                  <Columns3 className="w-4 h-4" />
                </button>
                <button onClick={() => refresh(s._id)} className="btn-secondary p-2.5" title="Refresh now">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => remove(s._id)} className="btn-danger p-2.5" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
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
