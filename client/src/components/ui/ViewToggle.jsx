import { Grid3X3, List, Table as TableIcon } from 'lucide-react';

const OPTIONS = [
  { key: 'grid',  label: 'Grid',  icon: Grid3X3 },
  { key: 'list',  label: 'List',  icon: List },
  { key: 'table', label: 'Table', icon: TableIcon },
];

/**
 * Compact 3-way view switcher (Grid / List / Table). Caller owns the state.
 *   <ViewToggle value={view} onChange={setView} />
 *
 * Pair with `useLocalStoredView('sf_<key>_view')` (defined below) to persist
 * per-page in localStorage.
 */
export default function ViewToggle({ value, onChange, options = OPTIONS }) {
  return (
    <div className="inline-flex rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-0.5 bg-white/60 dark:bg-ink-900/40">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              active
                ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
            }`}
            title={opt.label}
          >
            <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
