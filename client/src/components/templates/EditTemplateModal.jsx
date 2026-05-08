import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Plus, LayoutTemplate, AlertCircle } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

const CATEGORIES   = ['Sales', 'Marketing', 'Finance', 'Operations', 'Product', 'Custom'];
const CHART_TYPES  = ['line', 'bar', 'donut', 'area'];
const POSITIONS    = ['hero', 'grid'];
const PURPOSES     = ['trend', 'comparison', 'distribution', 'growth'];
const LAYOUTS      = ['hero-grid', 'dense-grid', 'sidebar'];
const DENSITIES    = ['airy', 'compact'];
const CARD_STYLES  = ['soft', 'sharp'];
const ACCENTS      = ['brand', 'emerald', 'purple', 'amber'];
const MODES        = ['light', 'dark'];

let _seq = 0;
const newSlotId = () => `s${Date.now().toString(36)}-${++_seq}`;

/**
 * Edit-template modal. Loads the full template, lets the user rename it
 * and adjust the slots (chart type, position, purpose, title), then saves
 * via PUT /api/templates/:id. Built-in templates can't be edited and aren't
 * shown here.
 */
export default function EditTemplateModal({ open, templateSummary, onClose, onSaved }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState([]);
  const [layoutType, setLayoutType] = useState('hero-grid');
  const [style, setStyle] = useState({ density: 'airy', cardStyle: 'soft', accent: 'brand', mode: 'light' });

  useEffect(() => {
    if (!open || !templateSummary?.id) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/templates/${encodeURIComponent(templateSummary.id)}`);
        const tpl = data?.template;
        if (alive && tpl) {
          setName(tpl.name || '');
          setCategory(tpl.category || 'Custom');
          setDescription(tpl.description || '');
          setSlots(Array.isArray(tpl.chartSlots) ? tpl.chartSlots.map((s) => ({ ...s })) : []);
          setLayoutType(LAYOUTS.includes(tpl.layoutType) ? tpl.layoutType : 'hero-grid');
          setStyle({
            density:   DENSITIES.includes(tpl.styleConfig?.density)   ? tpl.styleConfig.density   : 'airy',
            cardStyle: CARD_STYLES.includes(tpl.styleConfig?.cardStyle) ? tpl.styleConfig.cardStyle : 'soft',
            accent:    ACCENTS.includes(tpl.styleConfig?.accent)      ? tpl.styleConfig.accent    : 'brand',
            mode:      MODES.includes(tpl.styleConfig?.mode)          ? tpl.styleConfig.mode      : 'light',
          });
        }
      } catch (err) {
        if (alive) toast.error(err?.response?.data?.error || 'Could not load template');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, templateSummary?.id, toast]);

  function updateSlot(idx, patch) {
    setSlots((arr) => arr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeSlot(idx) {
    setSlots((arr) => arr.filter((_, i) => i !== idx));
  }
  function addSlot() {
    setSlots((arr) => [
      ...arr,
      {
        id: newSlotId(),
        position: 'grid',
        type: 'bar',
        purpose: 'comparison',
        title: '',
        hint: '',
      },
    ]);
  }

  async function save() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (slots.length === 0) { toast.error('Add at least one slot'); return; }
    setSaving(true);
    try {
      // Force exactly one hero slot client-side too — server enforces, but
      // catching it here gives a faster, clearer error.
      const cleaned = slots.map((s, i) => ({ ...s, id: s.id || `s${i + 1}` }));
      if (!cleaned.some((s) => s.position === 'hero')) cleaned[0].position = 'hero';

      const { data } = await api.put(`/templates/${encodeURIComponent(templateSummary.id)}`, {
        name: name.trim(),
        category,
        description: description.trim(),
        layoutType,
        styleConfig: style,
        chartSlots: cleaned,
      });
      onSaved?.(data.template);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
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
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-3xl rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100vh - 32px)' }}
          >
            <header className="px-6 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
                <LayoutTemplate className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">Edit Template</div>
                <div className="text-[11px] text-ink-500 leading-tight mt-0.5">
                  Rename, adjust slots, and save.
                </div>
              </div>
              <button onClick={onClose} className="btn-ghost p-2" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {loading ? (
                <div className="py-16 text-center text-sm text-ink-500">Loading…</div>
              ) : (
                <>
                  <Field label="Template name *">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      className="input w-full"
                      autoFocus
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Category">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="input w-full"
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Slots">
                      <div className="text-sm text-ink-700 dark:text-ink-200 px-3 py-2 rounded-xl border border-ink-200/60 dark:border-ink-700/60 bg-ink-50/40 dark:bg-ink-800/40">
                        {slots.length} slot{slots.length === 1 ? '' : 's'} configured
                      </div>
                    </Field>
                  </div>

                  <Field label="Description">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="input w-full resize-none"
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Layout">
                      <select
                        value={layoutType}
                        onChange={(e) => setLayoutType(e.target.value)}
                        className="input w-full"
                      >
                        <option value="hero-grid">hero-grid (headline + 2-col grid)</option>
                        <option value="dense-grid">dense-grid (3-col, no hero)</option>
                        <option value="sidebar">sidebar (tall primary + stack)</option>
                      </select>
                    </Field>
                    <Field label="Mode">
                      <select
                        value={style.mode}
                        onChange={(e) => setStyle({ ...style, mode: e.target.value })}
                        className="input w-full"
                      >
                        {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Density">
                      <select
                        value={style.density}
                        onChange={(e) => setStyle({ ...style, density: e.target.value })}
                        className="input w-full"
                      >
                        {DENSITIES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="Card style">
                      <select
                        value={style.cardStyle}
                        onChange={(e) => setStyle({ ...style, cardStyle: e.target.value })}
                        className="input w-full"
                      >
                        {CARD_STYLES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Accent">
                      <select
                        value={style.accent}
                        onChange={(e) => setStyle({ ...style, accent: e.target.value })}
                        className="input w-full"
                      >
                        {ACCENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300">
                        Chart slots
                      </div>
                      <button onClick={addSlot} className="btn-ghost text-xs py-1.5 px-2">
                        <Plus className="w-3 h-3" /> Add slot
                      </button>
                    </div>
                    <div className="space-y-2">
                      {slots.map((s, i) => (
                        <SlotRow
                          key={s.id || i}
                          slot={s}
                          index={i}
                          onChange={(patch) => updateSlot(i, patch)}
                          onRemove={() => removeSlot(i)}
                        />
                      ))}
                      {slots.length === 0 && (
                        <div className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 px-4 py-6 text-center text-xs text-ink-500">
                          No slots yet. Add at least one.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-ink-200/60 dark:border-ink-800/60 bg-ink-50/60 dark:bg-ink-800/40 px-3 py-2 text-[11px] text-ink-500 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                      The first hero slot is the headline chart on the dashboard. If you remove all hero slots, the first one will be promoted automatically.
                    </div>
                  </div>
                </>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-ink-200/60 dark:border-ink-800/60 bg-ink-50/40 dark:bg-ink-900/40 flex items-center justify-end gap-2">
              <button onClick={onClose} className="btn-secondary" disabled={saving}>
                Cancel
              </button>
              <button onClick={save} className="btn-primary" disabled={saving || loading || !name.trim() || slots.length === 0}>
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SlotRow({ slot, index, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center rounded-xl border border-ink-200/60 dark:border-ink-800/60 bg-ink-50/30 dark:bg-ink-800/30 px-2.5 py-2">
      <div className="col-span-1 text-xs font-bold text-ink-400 text-center">#{index + 1}</div>
      <div className="col-span-3">
        <select
          value={slot.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className="input w-full text-xs py-1.5"
        >
          {CHART_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <select
          value={slot.position}
          onChange={(e) => onChange({ position: e.target.value })}
          className="input w-full text-xs py-1.5"
        >
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <select
          value={slot.purpose || 'comparison'}
          onChange={(e) => onChange({ purpose: e.target.value })}
          className="input w-full text-xs py-1.5"
        >
          {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="col-span-3">
        <input
          type="text"
          value={slot.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Optional title"
          maxLength={60}
          className="input w-full text-xs py-1.5"
        />
      </div>
      <div className="col-span-1 text-right">
        <button
          onClick={onRemove}
          className="btn-ghost p-1.5 text-ink-500 hover:text-rose-500"
          title="Remove slot"
          aria-label="Remove slot"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
