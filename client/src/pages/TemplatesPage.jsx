import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutTemplate, ArrowRight, BarChart3, Sparkles, Plus, Trash2, Eye, Pencil } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import CreateTemplateModal from '../components/templates/CreateTemplateModal.jsx';
import TemplatePreviewModal from '../components/templates/TemplatePreviewModal.jsx';
import EditTemplateModal from '../components/templates/EditTemplateModal.jsx';
import ViewToggle from '../components/ui/ViewToggle.jsx';
import Pagination, { PAGE_SIZE } from '../components/ui/Pagination.jsx';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewing, setPreviewing] = useState(null); // template summary or null
  const [editing, setEditing] = useState(null);       // template summary or null
  const [view, setView] = useState(() => localStorage.getItem('sf_templates_view') || 'grid');
  const [page, setPage] = useState(1);
  useEffect(() => { localStorage.setItem('sf_templates_view', view); }, [view]);
  useEffect(() => { setPage(1); }, [templates.length, view]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/templates');
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not load templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => { if (alive) await load(); })();
    return () => { alive = false; };
  }, [load]);

  function useTemplate(id) {
    navigate(`/app/ai?template=${encodeURIComponent(id)}`);
  }

  async function deleteTemplate(t) {
    if (t.builtIn) return;
    if (!window.confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/templates/${encodeURIComponent(t.id)}`);
      setTemplates((arr) => arr.filter((x) => x.id !== t.id));
      toast.success('Template deleted');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not delete');
    }
  }

  function handleCreated(newTemplate) {
    setTemplates((arr) => [{ ...newTemplate, builtIn: false }, ...arr]);
    setCreateOpen(false);
    toast.success(`Template "${newTemplate.name}" created`);
  }

  function handleSaved(updated) {
    setTemplates((arr) => arr.map((t) => (t.id === updated.id ? { ...t, ...updated, builtIn: false } : t)));
    setEditing(null);
    toast.success('Template updated');
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <LayoutTemplate className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-tight">Templates</h1>
            <p className="text-sm text-ink-500 leading-tight mt-0.5">
              Pick a pre-designed dashboard or create your own. Add data. Get a premium analytics view in seconds.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle value={view} onChange={setView} />
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-10 text-center">
          <Sparkles className="w-8 h-8 text-brand-500 mx-auto" />
          <div className="font-semibold mt-3">No templates yet</div>
          <p className="text-sm text-ink-500 mt-1.5 max-w-sm mx-auto">
            Templates are added by your admin. The AI Assistant remains available — head there to design from scratch.
          </p>
          <Link to="/app/ai" className="btn-primary mt-5 inline-flex">
            <Sparkles className="w-4 h-4" /> Open AI Assistant
          </Link>
        </div>
      ) : (
        <>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(templates.length / PAGE_SIZE));
            const visible = templates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            return (
              <>
                {view === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {visible.map((t, i) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        index={i}
                        onUse={() => useTemplate(t.id)}
                        onPreview={() => setPreviewing(t)}
                        onEdit={() => setEditing(t)}
                        onDelete={() => deleteTemplate(t)}
                      />
                    ))}
                  </div>
                )}
                {view === 'list' && (
                  <div className="space-y-2">
                    {visible.map((t) => (
                      <TemplateRow
                        key={t.id}
                        template={t}
                        onUse={() => useTemplate(t.id)}
                        onPreview={() => setPreviewing(t)}
                        onEdit={() => setEditing(t)}
                        onDelete={() => deleteTemplate(t)}
                      />
                    ))}
                  </div>
                )}
                {view === 'table' && (
                  <TemplateTable
                    rows={visible}
                    onUse={(id) => useTemplate(id)}
                    onPreview={(t) => setPreviewing(t)}
                    onEdit={(t) => setEditing(t)}
                    onDelete={(t) => deleteTemplate(t)}
                  />
                )}
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </>
            );
          })()}
        </>
      )}

      <CreateTemplateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      <TemplatePreviewModal
        open={Boolean(previewing)}
        templateSummary={previewing}
        onClose={() => setPreviewing(null)}
        onApply={(t) => { setPreviewing(null); useTemplate(t?.id || previewing?.id); }}
        onEdit={(t) => { setPreviewing(null); setEditing(t || previewing); }}
      />
      <EditTemplateModal
        open={Boolean(editing)}
        templateSummary={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function TemplateCard({ template, index, onUse, onPreview, onEdit, onDelete }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="group relative rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white/85 dark:bg-ink-900/40 backdrop-blur overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
    >
      {!template.builtIn && (
        <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/85 dark:bg-ink-900/70 border border-ink-200/60 dark:border-ink-800/60 text-ink-500 hover:text-brand-600 hover:border-brand-300 backdrop-blur transition-colors"
            title="Edit template"
            aria-label="Edit template"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/85 dark:bg-ink-900/70 border border-ink-200/60 dark:border-ink-800/60 text-ink-500 hover:text-rose-500 hover:border-rose-300 backdrop-blur transition-colors"
            title="Delete template"
            aria-label="Delete template"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Preview surface — uses image if available, otherwise a tasteful gradient placeholder. */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-500/15 via-purple-500/10 to-cyan-500/10">
        {!imgFailed && template.previewImage ? (
          <img
            src={template.previewImage}
            alt={`${template.name} preview`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-10 h-10 text-brand-500/70 mx-auto" />
              <div className="text-[10px] uppercase tracking-wider font-bold mt-2 text-ink-500">
                {template.category || 'Analytics'}
              </div>
            </div>
          </div>
        )}
        <span className="absolute top-3 left-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/85 dark:bg-ink-900/70 text-ink-700 dark:text-ink-200 backdrop-blur border border-ink-200/60 dark:border-ink-800/60">
          {template.category || 'Template'}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="font-semibold text-base leading-tight">{template.name}</div>
        {template.description && (
          <p className="text-[13px] text-ink-500 mt-1.5 leading-relaxed line-clamp-2">
            {template.description}
          </p>
        )}
        <div className="text-[11px] text-ink-500 mt-2.5">
          {template.chartCount} chart{template.chartCount === 1 ? '' : 's'}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onPreview}
            className="btn-secondary flex-1 justify-center"
            title="Preview layout with sample data"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={onUse}
            className="btn-primary flex-1 justify-center"
          >
            Use <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white/60 dark:bg-ink-900/30 overflow-hidden">
      <div className="aspect-[16/9] bg-ink-100/60 dark:bg-ink-800/40 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-2/3 rounded bg-ink-100 dark:bg-ink-800 animate-pulse" />
        <div className="h-3 w-full rounded bg-ink-100/70 dark:bg-ink-800/70 animate-pulse" />
        <div className="h-9 w-full rounded-xl bg-ink-100/60 dark:bg-ink-800/60 animate-pulse" />
      </div>
    </div>
  );
}

/* ─── Compact list-view row ─── */
function TemplateRow({ template, onUse, onPreview, onEdit, onDelete }) {
  return (
    <div className="card p-3 px-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
        <LayoutTemplate className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{template.name}</div>
        <div className="text-[11px] text-ink-500 truncate">
          {template.category || 'Template'} · {template.chartCount} chart{template.chartCount === 1 ? '' : 's'}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onPreview} className="btn-secondary text-xs py-1.5 px-2" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
        {!template.builtIn && (
          <button onClick={onEdit} className="btn-secondary text-xs py-1.5 px-2" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
        )}
        {!template.builtIn && (
          <button onClick={onDelete} className="btn-danger text-xs py-1.5 px-2" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
        <button onClick={onUse} className="btn-primary text-xs py-1.5 px-3">
          Use <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Table view ─── */
function TemplateTable({ rows, onUse, onPreview, onEdit, onDelete }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-ink-200/60 dark:border-ink-800/60">
          <tr className="text-left text-[11px] uppercase tracking-wider font-bold text-ink-500">
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5 text-right">Charts</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-ink-200/40 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
              <td className="px-4 py-2.5 font-medium">{t.name}</td>
              <td className="px-4 py-2.5 text-ink-500">{t.category || '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{t.chartCount ?? 0}</td>
              <td className="px-4 py-2.5 text-ink-500">{t.builtIn ? 'Built-in' : (t.templateType || 'slots')}</td>
              <td className="px-4 py-2.5 text-right">
                <div className="inline-flex gap-1.5">
                  <button onClick={() => onPreview(t)} className="btn-secondary text-xs py-1 px-2"><Eye className="w-3 h-3" /></button>
                  {!t.builtIn && <button onClick={() => onEdit(t)} className="btn-secondary text-xs py-1 px-2"><Pencil className="w-3 h-3" /></button>}
                  {!t.builtIn && <button onClick={() => onDelete(t)} className="btn-danger text-xs py-1 px-2"><Trash2 className="w-3 h-3" /></button>}
                  <button onClick={() => onUse(t.id)} className="btn-primary text-xs py-1 px-2">Use</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
