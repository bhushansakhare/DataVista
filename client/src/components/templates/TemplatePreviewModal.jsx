import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Pencil, LayoutTemplate } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import TemplatePreview from './TemplatePreview.jsx';
import TemplateIframe from './TemplateIframe.jsx';

/**
 * Full-screen preview of a template's layout, populated with mock data.
 * The user sees the same visual hierarchy they'll get after applying.
 *
 * Loads the full template (slots) from the API on open, since the list
 * endpoint only returns a lightweight projection.
 */
export default function TemplatePreviewModal({
  open,
  templateSummary,   // { id, name, category, builtIn, ... } from the list page
  onClose,
  onApply,           // (template) => void
  onEdit,            // (template) => void; only shown for non-built-in
}) {
  const toast = useToast();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !templateSummary?.id) {
      setTemplate(null);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/templates/${encodeURIComponent(templateSummary.id)}`);
        if (alive) setTemplate(data?.template || null);
      } catch (err) {
        if (alive) {
          toast.error(err?.response?.data?.error || 'Could not load template');
          setTemplate(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, templateSummary?.id, toast]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-stretch justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-6xl rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100vh - 32px)' }}
          >
            <header className="px-6 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <LayoutTemplate className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight truncate">
                  {templateSummary?.name || 'Template preview'}
                </div>
                <div className="text-[11px] text-ink-500 leading-tight mt-0.5">
                  {templateSummary?.category || 'Template'} · live preview with sample data
                </div>
              </div>
              {!templateSummary?.builtIn && onEdit && (
                <button
                  onClick={() => onEdit(template || templateSummary)}
                  className="btn-secondary"
                  disabled={!template}
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              )}
              <button
                onClick={() => onApply(template || templateSummary)}
                className="btn-primary"
                disabled={!template}
              >
                <Sparkles className="w-4 h-4" /> Use Template
              </button>
              <button onClick={onClose} className="btn-ghost p-2" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* HTML / URL templates render the raw artifact directly inside a
                sandboxed iframe (no padding, full bleed). Slot-based templates
                keep the existing TemplatePreview chrome. */}
            <div className={`flex-1 overflow-hidden ${
              template?.templateType === 'html' || template?.templateType === 'url'
                ? 'bg-white dark:bg-ink-950'
                : 'overflow-y-auto p-6 bg-mesh-light dark:bg-mesh-dark'
            }`}>
              {loading ? (
                <div className="p-6"><PreviewSkeleton /></div>
              ) : template?.templateType === 'html' ? (
                <TemplateIframe html={template.templateCode} height="100%" rounded={false} />
              ) : template?.templateType === 'url' ? (
                <TemplateIframe url={template.templateUrl} height="100%" rounded={false} />
              ) : template ? (
                <TemplatePreview template={template} />
              ) : (
                <div className="text-center py-20 text-ink-500 text-sm">
                  Could not load template details.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white/60 dark:bg-ink-900/30 p-4 h-28 animate-pulse" />
        ))}
      </div>
      <div className="rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white/60 dark:bg-ink-900/30 h-72 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white/60 dark:bg-ink-900/30 h-56 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
