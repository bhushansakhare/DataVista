import { useMemo, useState } from 'react';
import { Hash, Type, Calendar, Search, CheckSquare, Square } from 'lucide-react';

const TYPE_ICONS = { number: Hash, string: Type, date: Calendar };

export default function ColumnSelector({
  columns = [],
  types = {},
  selected = [],
  onChange,
  height = 360,
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => columns.filter((c) => c.toLowerCase().includes(q.toLowerCase())),
    [columns, q]
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allChecked = columns.length > 0 && selected.length === columns.length;
  const noneChecked = selected.length === 0;

  function toggle(col) {
    if (selectedSet.has(col)) onChange(selected.filter((c) => c !== col));
    else onChange([...selected, col]);
  }

  function toggleAll() {
    onChange(allChecked ? [] : [...columns]);
  }

  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search columns…"
            className="input pl-9 py-2"
          />
        </div>
        <button onClick={toggleAll} className="btn-secondary text-xs">
          {allChecked ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
          {allChecked ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-ink-500">
          <span className="font-semibold text-ink-700 dark:text-ink-200">{selected.length}</span> of{' '}
          {columns.length} columns selected
        </div>
        {noneChecked && (
          <div className="text-xs text-rose-600">At least one column needed</div>
        )}
      </div>

      <div
        className="space-y-1 overflow-y-auto rounded-lg border border-ink-200/60 dark:border-ink-800/60 p-1"
        style={{ maxHeight: height }}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-sm text-ink-500 text-center">No columns match &quot;{q}&quot;.</div>
        ) : (
          filtered.map((c) => {
            const t = types[c] || 'string';
            const Icon = TYPE_ICONS[t] || Type;
            const checked = selectedSet.has(c);
            return (
              <label
                key={c}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                  checked
                    ? 'bg-brand-500/10 hover:bg-brand-500/15'
                    : 'hover:bg-ink-100 dark:hover:bg-ink-800/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c)}
                  className="w-4 h-4 accent-brand-500 cursor-pointer"
                />
                <Icon className={`w-3.5 h-3.5 ${checked ? 'text-brand-600' : 'text-ink-400'}`} />
                <span className="font-medium text-sm flex-1 truncate">{c}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                    t === 'number'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : t === 'date'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-ink-200/60 dark:bg-ink-800 text-ink-600 dark:text-ink-300'
                  }`}
                >
                  {t}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
