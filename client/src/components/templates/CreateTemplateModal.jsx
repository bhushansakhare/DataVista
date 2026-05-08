import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, LayoutTemplate, AlertCircle, Link2, Code2, Wand2, Eye, RefreshCw } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import TemplateIframe from './TemplateIframe.jsx';

// Monaco is heavy (~2MB) — lazy-load so the rest of the app stays light.
const MonacoEditor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.default })));

const CATEGORIES = ['Sales', 'Marketing', 'Finance', 'Operations', 'Product', 'Custom'];

const TYPE_OPTIONS = [
  { value: 'description', label: 'Describe',    icon: Wand2,          hint: 'Tell us what you want — AI designs the layout.' },
  { value: 'html',        label: 'Paste HTML',  icon: Code2,          hint: 'Paste a full HTML template — preserved verbatim.' },
  { value: 'url',         label: 'Import URL',  icon: Link2,          hint: 'Point at a live page — rendered via iframe (the target site must allow framing).' },
];

/**
 * Create-Template modal. Three creation modes:
 *
 *   - description: legacy AI-slot-config flow.
 *   - html:        raw HTML pasted into Monaco. Stored byte-for-byte.
 *                  Rendered via sandboxed iframe (allow-scripts).
 *   - url:         external URL. iframe.src on render.
 */
export default function CreateTemplateModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [mode, setMode] = useState('description');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom');
  const [description, setDescription] = useState('');
  const [templateUrl, setTemplateUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Monaco is UNCONTROLLED — we hold the editor instance in a ref. The
  // editor manages its own state; we only LISTEN to changes via onChange
  // (notification, not control). This avoids re-rendering the modal on
  // every keystroke and keeps Monaco's internal focus stable.
  const editorRef = useRef(null);

  // Preview state — separate from the editor. Updated either by the
  // debounced onChange below, or by a manual "Refresh preview" button.
  // The preview iframe uses ONLY this state, never the editor value
  // directly during render (that would couple them and re-introduce the
  // re-render-per-keystroke problem).
  const [previewHtml, setPreviewHtml] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMode('description');
      setName('');
      setCategory('Custom');
      setDescription('');
      setTemplateUrl('');
      setPreviewHtml('');
      setSubmitting(false);
      if (editorRef.current) editorRef.current.setValue('');
    }
    // Cancel any pending debounce when the modal closes.
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open]);

  /**
   * Move focus OFF Monaco before the modal starts its exit animation.
   * Otherwise the iframe-like inner textarea Monaco focuses retains focus
   * while ancestors get aria-hidden during the AnimatePresence transition.
   */
  const safeClose = useCallback(() => {
    try {
      if (typeof document !== 'undefined' && document.activeElement?.blur) {
        document.activeElement.blur();
      }
      if (editorRef.current?.getDomNode) {
        // Belt-and-braces: Monaco's textarea sits inside its dom node.
        const el = editorRef.current.getDomNode()?.querySelector('textarea');
        if (el) el.blur();
      }
    } catch { /* ignore */ }
    onClose?.();
  }, [onClose]);

  function handleEditorMount(editor) {
    editorRef.current = editor;
    editor.focus();
  }

  /**
   * Notification-only change handler. Doesn't make Monaco controlled (no
   * `value` prop is passed). Pushes the editor's content into previewHtml
   * after a short debounce — long pastes don't thrash the iframe re-render.
   */
  function handleEditorChange(value) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const html = editorRef.current?.getValue?.() ?? value ?? '';
      console.log('EDITOR VALUE LENGTH:', html.length);
      setPreviewHtml(html);
    }, 250);
  }

  /** Force-sync the preview to the editor's current value, bypassing debounce. */
  function refreshPreview() {
    const html = editorRef.current?.getValue?.() || '';
    console.log('EDITOR VALUE LENGTH (manual refresh):', html.length);
    setPreviewHtml(html);
  }

  function looksLikeUrl(s) {
    return /^https?:\/\/\S+$/i.test((s || '').trim());
  }

  async function submit(e) {
    e?.preventDefault?.();
    if (!name.trim()) {
      toast.error('Give your template a name');
      return;
    }
    if (mode === 'url' && !looksLikeUrl(templateUrl)) {
      toast.error('URL must start with http:// or https://');
      return;
    }
    // Read Monaco's current value from the ref (uncontrolled).
    const codeFromEditor = editorRef.current?.getValue?.() || '';
    if (mode === 'html' && !codeFromEditor.trim()) {
      toast.error('Paste your HTML template');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        category,
        description: description.trim(),
      };
      if (mode === 'html') {
        if (codeFromEditor.length < 200) {
          toast.error('Template HTML looks too short — paste the full code (under 200 chars rejected).');
          setSubmitting(false);
          return;
        }
        console.log('TEMPLATE LENGTH (paste):', codeFromEditor.length);
        body.templateType = 'html';
        body.templateCode = codeFromEditor;  // raw — server stores verbatim
      } else if (mode === 'url') {
        body.templateType = 'url';
        body.templateUrl  = templateUrl.trim();
      } else {
        body.templateType = 'slots';
        body.sourceType = 'description';
      }
      const { data } = await api.post('/templates', body);
      if (data?.generationSource === 'fallback') {
        toast.info('Used a default layout — refine your description for a tighter fit.');
      }
      // Blur Monaco BEFORE the parent unmounts the modal — same reason as
      // safeClose: keeps focus from sitting inside an exit-animating tree.
      try {
        if (document.activeElement?.blur) document.activeElement.blur();
      } catch { /* ignore */ }
      onCreated?.(data.template);
    } catch (err) {
      const msg = err?.response?.data?.error
        || (err?.response?.status === 413 ? 'Template HTML too large — keep under 10 MB.' : err?.message)
        || 'Could not create template';
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-stretch justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) safeClose(); }}
        >
          <motion.form
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            onSubmit={submit}
            className={`w-full ${mode === 'html' ? 'max-w-7xl' : 'max-w-4xl'} rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden flex flex-col`}
            style={{ maxHeight: 'calc(100vh - 32px)' }}
          >
            <header className="px-6 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
                <LayoutTemplate className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">Create Template</div>
                <div className="text-[11px] text-ink-500 leading-tight mt-0.5">
                  {TYPE_OPTIONS.find((t) => t.value === mode)?.hint}
                </div>
              </div>
              <button type="button" onClick={safeClose} className="btn-ghost p-2" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Mode selector */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition ${
                        active
                          ? 'border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                          : 'border-ink-200/60 dark:border-ink-800/60 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800/40'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Template name *">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SaaS Growth Snapshot"
                    className="input w-full"
                    maxLength={80}
                    autoFocus
                    required
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input w-full"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Description (optional)" hint="Used as the card subtitle. For 'Describe' mode, this is also the design brief.">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={mode === 'description'
                    ? 'A trend over time on top, a Top 10 bar chart, a category donut, a growth area chart.'
                    : 'A short description shown on the template card.'}
                  rows={mode === 'description' ? 4 : 2}
                  maxLength={500}
                  className="input w-full resize-none"
                />
              </Field>

              {mode === 'url' && (
                <Field
                  label="Template URL"
                  hint="The live page is loaded into a sandboxed iframe. Note: many sites set X-Frame-Options that prevent framing — that's enforced by the target, not us."
                >
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
                    <input
                      type="url"
                      value={templateUrl}
                      onChange={(e) => setTemplateUrl(e.target.value)}
                      placeholder="https://demo.nextadmin.co/analytics"
                      className="input w-full pl-9"
                      maxLength={500}
                    />
                  </div>
                </Field>
              )}

              {mode === 'html' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300">
                      Template HTML
                    </div>
                    <button
                      type="button"
                      onClick={refreshPreview}
                      className="btn-ghost text-xs py-1 px-2"
                      title="Sync preview to editor right now"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh preview
                    </button>
                  </div>

                  {/* Editor + live preview, side-by-side on lg+. */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Editor pane */}
                    <div
                      className="rounded-xl overflow-hidden border border-ink-700 bg-[#1e1e1e]"
                      style={{
                        resize: 'vertical',
                        overflow: 'auto',
                        minHeight: 500,
                        maxHeight: '80vh',
                        height: 540,
                      }}
                    >
                      <Suspense fallback={<EditorFallback />}>
                        <MonacoEditor
                          height="100%"
                          language="html"
                          defaultLanguage="html"
                          theme="vs-dark"
                          defaultValue=""
                          onMount={handleEditorMount}
                          onChange={handleEditorChange}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            formatOnPaste: false,
                            formatOnType:  false,
                            accessibilitySupport: 'off',
                          }}
                        />
                      </Suspense>
                    </div>

                    {/* Live preview pane */}
                    <div
                      className="rounded-xl overflow-hidden border border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-950 flex flex-col"
                      style={{ height: 540 }}
                    >
                      <div className="px-3 py-1.5 border-b border-ink-200/60 dark:border-ink-800/60 bg-ink-50/60 dark:bg-ink-900/40 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-ink-500">
                        <Eye className="w-3 h-3" /> Live preview
                        {previewHtml ? (
                          <span className="ml-auto normal-case font-mono text-ink-400">
                            {previewHtml.length.toLocaleString()} chars
                          </span>
                        ) : null}
                      </div>
                      <div className="flex-1 min-h-0">
                        {previewHtml ? (
                          <TemplateIframe
                            html={previewHtml}
                            height="100%"
                            rounded={false}
                            title="Live template preview"
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-ink-500 px-6 text-center">
                            Paste your HTML in the editor — the preview updates as you type.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-ink-500 mt-1.5 leading-relaxed">
                    Paste any length — stored byte-for-byte. Use <code>data-kpi=&quot;name&quot;</code> / <code>data-chart=&quot;name&quot;</code> attributes on elements where you want sheet data injected at apply time. Preview updates after a short pause to keep large pastes smooth.
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 bg-ink-50/60 dark:bg-ink-800/40 px-3 py-2 text-[11px] text-ink-500 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  HTML templates render inside a <span className="font-mono">sandbox=&quot;allow-scripts&quot;</span> iframe — scripts execute, CSS applies, but the iframe cannot reach the app's session. This protects every workspace member from a planted XSS in a shared dashboard.
                </div>
              </div>
            </div>

            <footer className="px-6 py-4 border-t border-ink-200/60 dark:border-ink-800/60 bg-ink-50/40 dark:bg-ink-900/40 flex items-center justify-end gap-2">
              <button type="button" onClick={safeClose} className="btn-secondary" disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting || !name.trim()}>
                {submitting
                  ? <><Sparkles className="w-4 h-4 animate-pulse" /> Creating…</>
                  : <><Sparkles className="w-4 h-4" /> Create Template</>
                }
              </button>
            </footer>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EditorFallback() {
  return (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center text-sm text-slate-400">
      Loading editor…
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1">
        {label}
      </div>
      {children}
      {hint && (
        <div className="text-[11px] text-ink-500 mt-1.5 leading-relaxed">{hint}</div>
      )}
    </label>
  );
}
