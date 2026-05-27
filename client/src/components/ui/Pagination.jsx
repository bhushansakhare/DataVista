/**
 * Compact prev / page-of-total / next pager. Caller owns page state.
 *   <Pagination page={page} totalPages={tp} onChange={setPage} />
 *
 * Renders nothing when totalPages <= 1 so it can be dropped into any list
 * page without a guard.
 */
export default function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="btn-secondary text-xs py-1.5 px-3"
      >
        Prev
      </button>
      <div className="text-xs text-ink-500">Page {page} of {totalPages}</div>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="btn-secondary text-xs py-1.5 px-3"
      >
        Next
      </button>
    </div>
  );
}

export const PAGE_SIZE = 5;
