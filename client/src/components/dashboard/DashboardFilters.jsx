import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter as FilterIcon, Plus, X, Search, ChevronDown, CheckSquare, Square,
  Hash, Type, Calendar,
} from 'lucide-react';
import { useColumnReasoning } from '../../hooks/useColumnReasoning.js';
import { ROLES } from '../../utils/columnReasoning.js';

/**
 * Sticky top-bar dashboard filter. Lifts filter state via `onChange`.
 *
 * Filter shape:
 *   { field, op, value }
 *
 * Op chosen by column role:
 *   metric / numeric → 'between' (numeric range)
 *   time / date      → 'date_between'
 *   category         → 'in'      (multi-select)
 *   text             → 'contains' (substring)
 *   url / id         → not filterable from this UI
 */
export default function DashboardFilters({ sheet, filters = [], onChange }) {
  const reasoning = useColumnReasoning(sheet);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef(null);

  const filterableCols = useMemo(() => {
    if (!sheet) return [];
    const allCols = Array.isArray(sheet.columns) ? sheet.columns : [];
    const selected =
      Array.isArray(sheet.selectedColumns) && sheet.selectedColumns.length
        ? sheet.selectedColumns
        : allCols;
    return allCols
      .filter((c) => selected.includes(c))
      .filter((c) => {
        const r = reasoning?.[c]?.role;
        return r && r !== ROLES.LINK; // URLs aren't useful in a filter UI
      });
  }, [sheet, reasoning]);

  const usedFields = new Set(filters.map((f) => f.field));
  const availableCols = filterableCols.filter((c) => !usedFields.has(c));

  function defaultFilterFor(col) {
    const role = reasoning?.[col]?.role;
    if (role === ROLES.METRIC)         return { field: col, op: 'between',     value: ['', ''] };
    if (role === ROLES.TIME)           return { field: col, op: 'date_between', value: ['', ''] };
    if (role === ROLES.CATEGORY)       return { field: col, op: 'in',          value: [] };
    if (role === ROLES.TEXT)           return { field: col, op: 'contains',    value: '' };
    if (role === ROLES.IDENTIFIER)     return { field: col, op: 'equals',      value: '' };
    return { field: col, op: 'contains', value: '' };
  }

  function addFilter(col) {
    onChange?.([...filters, defaultFilterFor(col)]);
    setPickerOpen(false);
  }
  function updateFilter(idx, patch) {
    onChange?.(filters.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function removeFilter(idx) {
    onChange?.(filters.filter((_, i) => i !== idx));
  }
  function clearAll() {
    onChange?.([]);
  }

  // Close the column picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  if (filterableCols.length === 0) return null;

  return (
    <div className="flex items-start gap-2 flex-wrap mb-4">
      <div className="flex items-center gap-1.5 text-xs text-ink-500 font-semibold uppercase tracking-wider px-2 py-1.5 flex-shrink-0">
        <FilterIcon className="w-3.5 h-3.5" /> Filters
      </div>

      {filters.map((f, i) => (
        <FilterPill
          key={`${f.field}-${i}`}
          filter={f}
          sheet={sheet}
          reasoning={reasoning}
          onChange={(patch) => updateFilter(i, patch)}
          onRemove={() => removeFilter(i)}
        />
      ))}

      <div ref={wrapRef} className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="btn-secondary text-xs py-1.5 px-3"
          disabled={availableCols.length === 0}
          title={availableCols.length === 0 ? 'All columns are already filtered' : 'Add filter'}
        >
          <Plus className="w-3.5 h-3.5" /> Add filter
        </button>
        <AnimatePresence>
          {pickerOpen && availableCols.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-30 card py-1 w-64 max-h-72 overflow-y-auto"
            >
              {availableCols.map((c) => {
                const r = reasoning?.[c];
                const Icon = r?.role === ROLES.METRIC ? Hash : r?.role === ROLES.TIME ? Calendar : Type;
                return (
                  <button
                    key={c}
                    onClick={() => addFilter(c)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center gap-2"
                  >
                    <Icon className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" />
                    <span className="font-medium truncate flex-1">{c}</span>
                    <span className="text-[10px] uppercase tracking-wider text-ink-400">{r?.role}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {filters.length > 0 && (
        <button onClick={clearAll} className="btn-ghost text-xs py-1.5 px-2">
          Clear all
        </button>
      )}
    </div>
  );
}

/* ─────────── filter pill (one per active filter) ─────────── */

function FilterPill({ filter, sheet, reasoning, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const summary = filterSummary(filter);
  const isActive = filterIsActive(filter);

  return (
    <div ref={ref} className="relative">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          isActive
            ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
            : 'border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900/60 text-ink-700 dark:text-ink-200'
        }`}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5"
        >
          <span className="font-semibold">{filter.field}</span>
          <span className="text-ink-500">{summary}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={onRemove} className="ml-0.5 -mr-1 p-0.5 hover:bg-ink-200/60 dark:hover:bg-ink-700/60 rounded-full" title="Remove">
          <X className="w-3 h-3" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1 z-30 card p-3 w-72"
          >
            <FilterEditor
              filter={filter}
              sheet={sheet}
              reasoning={reasoning}
              onChange={onChange}
              onClose={() => setOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function filterIsActive(f) {
  if (!f) return false;
  if (f.op === 'in') return Array.isArray(f.value) && f.value.length > 0;
  if (f.op === 'between' || f.op === 'date_between') {
    return Array.isArray(f.value) && (f.value[0] !== '' || f.value[1] !== '');
  }
  if (f.op === 'not_empty') return true;
  return f.value !== undefined && f.value !== '';
}

function filterSummary(f) {
  if (!filterIsActive(f)) return 'any';
  if (f.op === 'in') {
    if (!Array.isArray(f.value) || f.value.length === 0) return 'any';
    if (f.value.length === 1) return `= ${f.value[0]}`;
    return `${f.value.length} selected`;
  }
  if (f.op === 'between') {
    const [a, b] = f.value || [];
    if (a !== '' && b !== '') return `between ${a}–${b}`;
    if (a !== '') return `≥ ${a}`;
    if (b !== '') return `≤ ${b}`;
    return 'any';
  }
  if (f.op === 'date_between') {
    const [a, b] = f.value || [];
    if (a && b) return `${a} → ${b}`;
    if (a) return `from ${a}`;
    if (b) return `until ${b}`;
    return 'any';
  }
  if (f.op === 'contains') return `contains "${f.value}"`;
  if (f.op === 'equals') return `= ${f.value}`;
  return f.op;
}

/* ─────────── filter editors ─────────── */

function FilterEditor({ filter, sheet, reasoning, onChange }) {
  const role = reasoning?.[filter.field]?.role;
  if (role === ROLES.CATEGORY) {
    return <MultiSelectEditor filter={filter} sheet={sheet} onChange={onChange} />;
  }
  if (role === ROLES.METRIC) {
    return <RangeEditor filter={filter} onChange={onChange} />;
  }
  if (role === ROLES.TIME) {
    return <DateRangeEditor filter={filter} onChange={onChange} />;
  }
  return <TextEditor filter={filter} onChange={onChange} />;
}

function MultiSelectEditor({ filter, sheet, onChange }) {
  const rows = sheet?.rawData || [];
  const [q, setQ] = useState('');
  const counts = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const v = r?.[filter.field];
      if (v === null || v === undefined || v === '') continue;
      const key = String(v);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  }, [rows, filter.field]);

  const filtered = q.trim()
    ? counts.filter((c) => c.value.toLowerCase().includes(q.toLowerCase()))
    : counts;

  const selected = Array.isArray(filter.value) ? filter.value : [];
  const allChecked = filtered.length > 0 && filtered.every((c) => selected.includes(c.value));

  function toggle(value) {
    if (selected.includes(value)) onChange({ value: selected.filter((v) => v !== value) });
    else onChange({ value: [...selected, value] });
  }
  function toggleAll() {
    if (allChecked) onChange({ value: selected.filter((v) => !filtered.some((c) => c.value === v)) });
    else {
      const next = new Set(selected);
      filtered.forEach((c) => next.add(c.value));
      onChange({ value: Array.from(next) });
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search values…"
          className="input pl-8 py-1.5 text-xs"
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-ink-500">
        <span>{selected.length} of {counts.length} selected</span>
        <button onClick={toggleAll} className="btn-ghost py-0.5 px-1.5 text-[11px]">
          {allChecked ? <><Square className="w-3 h-3" /> Clear shown</> : <><CheckSquare className="w-3 h-3" /> Select shown</>}
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-ink-200/60 dark:border-ink-800/60 p-1">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-ink-500">No values match.</div>
        ) : (
          filtered.map((c) => {
            const checked = selected.includes(c.value);
            return (
              <label
                key={c.value}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition ${
                  checked ? 'bg-brand-500/10' : 'hover:bg-ink-100 dark:hover:bg-ink-800/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c.value)}
                  className="w-3.5 h-3.5 accent-brand-500 cursor-pointer"
                />
                <span className="flex-1 truncate">{c.value}</span>
                <span className="text-[10px] text-ink-400 tabular-nums">{c.count}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function RangeEditor({ filter, onChange }) {
  const [min, max] = Array.isArray(filter.value) ? filter.value : ['', ''];
  return (
    <div className="space-y-2">
      <label className="label text-[10px]">Min</label>
      <input
        type="number"
        value={min}
        onChange={(e) => onChange({ value: [e.target.value, max] })}
        placeholder="—"
        className="input py-1.5 text-sm"
      />
      <label className="label text-[10px]">Max</label>
      <input
        type="number"
        value={max}
        onChange={(e) => onChange({ value: [min, e.target.value] })}
        placeholder="—"
        className="input py-1.5 text-sm"
      />
    </div>
  );
}

function DateRangeEditor({ filter, onChange }) {
  const [from, to] = Array.isArray(filter.value) ? filter.value : ['', ''];
  return (
    <div className="space-y-2">
      <label className="label text-[10px]">From</label>
      <input
        type="date"
        value={from || ''}
        onChange={(e) => onChange({ value: [e.target.value, to] })}
        className="input py-1.5 text-sm"
      />
      <label className="label text-[10px]">To</label>
      <input
        type="date"
        value={to || ''}
        onChange={(e) => onChange({ value: [from, e.target.value] })}
        className="input py-1.5 text-sm"
      />
    </div>
  );
}

function TextEditor({ filter, onChange }) {
  return (
    <div className="space-y-2">
      <label className="label text-[10px]">Contains</label>
      <input
        value={filter.value || ''}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="search…"
        className="input py-1.5 text-sm"
      />
    </div>
  );
}
