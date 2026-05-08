// Hover tooltip wrapper for any column chip / label / option.
// Pure CSS via Tailwind's `group` + `group-hover:` — no portals, no extra deps.

const ROLE_DOT = {
  time:     'bg-amber-500',
  category: 'bg-brand-500',
  metric:   'bg-emerald-500',
  id:       'bg-ink-400',
  url:      'bg-purple-500',
  text:     'bg-ink-400',
};

export default function ColumnTip({
  column,
  reasoning,
  children,
  side = 'bottom',
  className = '',
}) {
  const r = reasoning?.[column];
  const sideCls =
    side === 'top'
      ? 'bottom-full mb-2'
      : side === 'left'
      ? 'right-full mr-2 top-1/2 -translate-y-1/2'
      : side === 'right'
      ? 'left-full ml-2 top-1/2 -translate-y-1/2'
      : 'top-full mt-2';

  return (
    <span className={`relative group ${className || 'inline-flex'}`}>
      {children}
      {r && (
        <span
          role="tooltip"
          className={`pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 transition absolute ${sideCls} z-50 left-1/2 -translate-x-1/2 w-64 max-w-[80vw] rounded-xl border border-ink-200/70 dark:border-ink-700/70 bg-white dark:bg-ink-900 shadow-soft p-3 text-left`}
        >
          <span className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT[r.role] || 'bg-ink-400'}`} />
            <span className="font-semibold text-ink-900 dark:text-ink-100 text-xs truncate">
              {column}
            </span>
          </span>
          <span className="block text-[11px] font-medium text-ink-600 dark:text-ink-300 mt-1">
            {r.label}
          </span>
          <span className="block text-[11px] text-ink-500 dark:text-ink-400 mt-2 leading-relaxed">
            {r.why}
          </span>
          {Array.isArray(r.sample) && r.sample.length > 0 && (
            <span className="block text-[10px] text-ink-400 dark:text-ink-500 mt-2 truncate">
              e.g. {r.sample.slice(0, 2).map(String).join(', ')}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
