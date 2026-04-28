import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sheet, ArrowRight, Database, Type, Hash, Calendar, ExternalLink } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const TYPE_ICONS = { number: Hash, string: Type, date: Calendar };

export default function SheetImportPage() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  async function importSheet(e) {
    e.preventDefault();
    if (!url) return;
    setBusy(true);
    try {
      const { data } = await api.post('/sheet/import', { sheetUrl: url, title: title || undefined });
      setSheet(data.sheet);
      toast.success(`Imported ${data.sheet.rowCount} rows`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">Import a Google Sheet</h1>
        <p className="text-sm text-ink-500 mt-1">
          Share your sheet as <span className="chip">Anyone with link — Viewer</span> first, then paste the URL below.
        </p>
      </header>

      <motion.form
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={importSheet} className="card p-6 space-y-4"
      >
        <div>
          <label className="label">Google Sheet URL</label>
          <div className="mt-1.5 relative">
            <Sheet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="input pl-10"
            />
          </div>
        </div>
        <div>
          <label className="label">Title <span className="text-ink-400 normal-case font-normal">(optional)</span></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1.5" placeholder="Q3 sales report" />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <a
            href="https://support.google.com/docs/answer/2494822"
            target="_blank" rel="noreferrer"
            className="text-xs text-ink-500 hover:text-ink-700 inline-flex items-center gap-1"
          >
            How to share a sheet <ExternalLink className="w-3 h-3" />
          </a>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? 'Importing…' : <>Import <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </motion.form>

      {sheet && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold">{sheet.title}</div>
                <div className="text-xs text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="chip"><Database className="w-3 h-3" /> {sheet.rowCount} rows</span>
                  <span className="chip">{(sheet.columns || []).length} columns</span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/app/dashboards/new/${sheet._id}`)}
                className="btn-primary"
              >
                Build dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="card p-5">
            <div className="label mb-3">Columns</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {sheet.columns.map((c) => {
                const t = sheet.detectedTypes?.[c] || 'string';
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

          <PreviewTable rows={sheet.rawData} columns={sheet.columns} />
        </motion.div>
      )}
    </div>
  );
}

function PreviewTable({ rows = [], columns = [] }) {
  const display = rows.slice(0, 25);
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between">
        <div className="font-semibold text-sm">Preview</div>
        <div className="text-xs text-ink-500">First 25 rows</div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead className="bg-ink-50 dark:bg-ink-800/30">
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left px-4 py-2.5 font-semibold text-ink-600 dark:text-ink-300 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.map((r, i) => (
              <tr key={i} className="border-t border-ink-200/60 dark:border-ink-800/60">
                {columns.map((c) => (
                  <td key={c} className="px-4 py-2 whitespace-nowrap">{r[c] ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
