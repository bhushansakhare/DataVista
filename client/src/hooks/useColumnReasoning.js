import { useMemo } from 'react';
import { reasonColumns } from '../utils/columnReasoning.js';

/**
 * Memoised reasoning per sheet. Recomputes only when the sheet's identity or
 * content hash changes, so this is safe to call from many components.
 */
export function useColumnReasoning(sheet) {
  return useMemo(
    () => reasonColumns(sheet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet?._id, sheet?.contentHash, (sheet?.selectedColumns || []).join('|')]
  );
}
