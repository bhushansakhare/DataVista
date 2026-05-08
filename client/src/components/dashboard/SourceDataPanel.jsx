import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, FileText, Search, Hash, Type, Calendar, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import { detectUnit, getFormatter } from '../../utils/formatValue.js';
import {
  formatBytesTotal, formatDurationTotal, formatCurrencyTotal, formatNumberTotal,
  getColumnKindMap,
} from '../../utils/businessKpis.js';

const PAGE_SIZE = 25;
const TYPE_ICONS = { number: Hash, string: Type, date: Calendar };

// Match common URL patterns:
//  - http(s):// anything
//  - protocol-less domain like "drive.google.com/..." or "www.example.com/..."
//  - file:// schemes
const URL_RE = /^(https?:\/\/|file:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}\/)\S*$/i;
const URL_NAME_HINT = /\b(url|link|href|file|drive|source|page|website|video[_ ]?url|preview)\b/i;

function isUrl(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 6) return false;
  return URL_RE.test(s);
}

function asHref(v) {
  const s = String(v).trim();
  if (/^https?:\/\//i.test(s) || /^file:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

function shortenUrl(u) {
  try {
    const target = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    const parsed = new URL(target);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname.length > 1 ? parsed.pathname : '';
    const trimmed = `${host}${path}`;
    return trimmed.length > 36 ? `${trimmed.slice(0, 35)}…` : trimmed;
  } catch {
    return u.length > 40 ? `${u.slice(0, 39)}…` : u;
  }
}

export default function SourceDataPanel({ sheet, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [activeRow, setActiveRow] = useState(null);

  const allCols = sheet?.columns || [];
  const types = sheet?.detectedTypes || {};
  const selected = Array.isArray(sheet?.selectedColumns) && sheet.selectedColumns.length
    ? sheet.selectedColumns
    : allCols;
  const visible = allCols.filter((c) => selected.includes(c));
  const rows = sheet?.rawData || [];

  const kindMap = useMemo(() => getColumnKindMap(sheet), [sheet]);

  // Per-column formatter — prefer the businessKpis kind classification (which
  // handles server-coerced byte/duration columns) and fall back to the
  // older detectUnit() for everything else.
  const fmts = useMemo(() => {
    const map = {};
    for (const c of visible) {
      const kind = kindMap[c];
      if (kind === 'bytes')    { map[c] = formatBytesTotal; continue; }
      if (kind === 'duration') { map[c] = formatDurationTotal; continue; }
      if (kind === 'currency') { map[c] = formatCurrencyTotal; continue; }
      const samples = rows.slice(0, 50).map((r) => r[c]);
      const unit = types[c] === 'number' ? detectUnit(c, samples) : null;
      map[c] = unit ? getFormatter(unit) : (types[c] === 'number' ? formatNumberTotal : null);
    }
    return map;
  }, [visible, rows, types, kindMap]);

  // Columns that should render as clickable links (sample values + name hint)
  const urlCols = useMemo(() => {
    const set = new Set();
    for (const c of visible) {
      if (URL_NAME_HINT.test(c)) { set.add(c); continue; }
      // Sample-based detection: ≥50% of non-empty values look like URLs
      let total = 0, hits = 0;
      for (let i = 0; i < rows.length && total < 30; i++) {
        const v = rows[i]?.[c];
        if (v === null || v === undefined || v === '') continue;
        total++;
        if (isUrl(v)) hits++;
      }
      if (total > 0 && hits / total >= 0.5) set.add(c);
    }
    return set;
  }, [rows, visible]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      visible.some((c) => String(r[c] ?? '').toLowerCase().includes(needle))
    );
  }, [rows, q, visible]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (!sheet) return null;

  function renderCell(row, col) {
    const v = row[col];
    if (v === null || v === undefined || v === '') return <span className="text-ink-400">—</span>;
    if ((urlCols.has(col) || isUrl(v)) && typeof v === 'string') {
      const trimmed = v.trim();
      return (
        <a
          href={asHref(trimmed)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 hover:underline max-w-[280px]"
          title={trimmed}
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{shortenUrl(trimmed)}</span>
        </a>
      );
    }
    const f = fmts[col];
    if (f && Number.isFinite(Number(v))) return f(Number(v));
    if (types[col] === 'date') {
      const t = Date.parse(v);
      if (Number.isFinite(t)) return new Date(t).toLocaleDateString();
    }
    return String(v);
  }

  return (
    <div className="card overflow-hidden mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-ink-50 dark:hover:bg-ink-800/40 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm">View source data</div>
            <div className="text-[11px] text-ink-500">
              {sheet.title} · {rows.length.toLocaleString()} rows · {visible.length} of {allCols.length} columns
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-ink-200/60 dark:border-ink-800/60"
          >
            <div className="p-4 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(0); }}
                  placeholder="Search rows…"
                  className="input pl-9 py-2"
                />
              </div>
              <div className="text-xs text-ink-500">
                {total.toLocaleString()} row{total === 1 ? '' : 's'} · click a row for details
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              {slice.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-ink-500">No rows match.</div>
              ) : (
                <table className="text-sm w-full">
                  <thead className="bg-ink-50 dark:bg-ink-800/30 sticky top-0">
                    <tr>
                      {visible.map((c) => {
                        const t = types[c] || 'string';
                        const Icon = TYPE_ICONS[t] || Type;
                        return (
                          <th key={c} className="text-left px-4 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3 h-3 text-ink-400" />
                              <span className="font-semibold text-ink-600 dark:text-ink-300">{c}</span>
                              <span className="text-[10px] uppercase tracking-wider text-ink-400">{t}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((r, i) => (
                      <tr
                        key={i}
                        onClick={() => setActiveRow({ row: r, idx: safePage * PAGE_SIZE + i })}
                        className="border-t border-ink-200/60 dark:border-ink-800/60 hover:bg-brand-500/5 cursor-pointer transition"
                      >
                        {visible.map((c) => (
                          <td key={c} className="px-4 py-2 whitespace-nowrap">
                            {renderCell(r, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {pageCount > 1 && (
              <div className="px-4 py-3 border-t border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between text-xs">
                <div className="text-ink-500">
                  Page {safePage + 1} of {pageCount}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={safePage >= pageCount - 1}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={!!activeRow}
        onClose={() => setActiveRow(null)}
        title={activeRow ? `Row ${activeRow.idx + 1}` : 'Row'}
        size="lg"
      >
        {activeRow && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visible.map((c) => {
              const t = types[c] || 'string';
              const Icon = TYPE_ICONS[t] || Type;
              return (
                <div key={c} className="rounded-xl bg-ink-50 dark:bg-ink-800/40 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3 h-3 text-brand-500" />
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
                      {c}
                    </div>
                    <div className="text-[10px] text-ink-400">· {t}</div>
                  </div>
                  <div className="text-sm font-medium break-words">
                    {renderCell(activeRow.row, c)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
