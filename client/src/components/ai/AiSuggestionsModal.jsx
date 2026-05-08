import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertTriangle, RefreshCw, Wand2 } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import SuggestionCard from './SuggestionCard.jsx';
import { aiSuggestionToDashboard } from '../../utils/aiToChart.js';

/**
 * AI Suggestions modal.
 *  - Fetches the sheet's rawData (excluded from list endpoint).
 *  - POSTs to /api/ai/suggestions.
 *  - Renders 4–5 cards.
 *  - On "Use this dashboard": creates the dashboard via /api/dashboard and
 *    navigates to /app/dashboards/:id.
 */
export default function AiSuggestionsModal({ open, onClose, sheetSummary }) {
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(null); // index of card being built
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [source, setSource] = useState(null); // 'claude' | 'fallback'
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!open || !sheetSummary?._id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSuggestions([]);
      try {
        // 1) load full sheet (rawData is excluded from list endpoint)
        const { data: sheetRes } = await api.get(`/sheet/${sheetSummary._id}`);
        if (cancelled) return;
        setSheet(sheetRes.sheet);
        const sheetData = Array.isArray(sheetRes.sheet?.rawData) ? sheetRes.sheet.rawData : [];

        if (sheetData.length === 0) {
          throw new Error('Sheet has no data — refresh it first.');
        }

        // 2) ask the AI engine for suggestions
        const { data } = await api.post('/ai/suggestions', { sheetData });
        if (cancelled) return;
        setSuggestions(Array.isArray(data?.dashboards) ? data.dashboards : []);
        setSource(data?.source || null);
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.error || err?.message || 'Could not generate suggestions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, sheetSummary?._id]);

  async function useDashboard(suggestion, index) {
    if (!sheet) return;
    setBuilding(index);
    try {
      const payload = aiSuggestionToDashboard(suggestion, sheet);
      if (!payload.charts.length) {
        throw new Error('AI did not produce any chartable columns.');
      }
      const { data } = await api.post('/dashboard', payload);
      toast.success('Dashboard created');
      onClose?.();
      navigate(`/app/dashboards/${data.dashboard._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'Could not build dashboard.');
    } finally {
      setBuilding(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="card w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold leading-tight truncate">AI Dashboard Suggestions</div>
                  <div className="text-[11px] text-ink-500 mt-0.5 truncate">
                    {sheetSummary?.title || 'Loading…'}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </header>

            <div className="p-5 overflow-y-auto flex-1">
              {source === 'fallback' && !loading && !error && (
                <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-2.5 text-[13px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    AI is offline — showing rule-based suggestions. Set <code className="font-mono">ANTHROPIC_API_KEY</code> on the server for full AI output.
                  </span>
                </div>
              )}

              {loading && <SuggestionsLoading />}

              {!loading && error && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-lg mt-4">Could not generate suggestions</div>
                  <div className="text-sm text-ink-500 mt-1.5 max-w-md mx-auto">{error}</div>
                  <button onClick={onClose} className="btn-secondary mt-6">Close</button>
                </div>
              )}

              {!loading && !error && suggestions.length === 0 && (
                <div className="text-center py-12 text-sm text-ink-500">
                  No suggestions returned.
                </div>
              )}

              {!loading && !error && suggestions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {suggestions.map((s, i) => (
                    <SuggestionCard
                      key={i}
                      index={i}
                      suggestion={s}
                      busy={building === i}
                      onUse={() => useDashboard(s, i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SuggestionsLoading() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-ink-500 mb-4">
        <Wand2 className="w-4 h-4 text-brand-500 animate-pulse" />
        Analysing your data and proposing dashboards…
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-ink-200 dark:bg-ink-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-ink-200 dark:bg-ink-800 rounded w-3/4" />
                <div className="h-2 bg-ink-200 dark:bg-ink-800 rounded w-full" />
                <div className="h-2 bg-ink-200 dark:bg-ink-800 rounded w-5/6" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-ink-200 dark:bg-ink-800 rounded w-1/4" />
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="h-5 w-20 bg-ink-200 dark:bg-ink-800 rounded-full" />
                ))}
              </div>
            </div>
            <div className="mt-4 h-9 bg-ink-200 dark:bg-ink-800 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
