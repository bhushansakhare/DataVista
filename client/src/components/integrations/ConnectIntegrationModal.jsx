import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plug, Sparkles, Globe, Sheet as SheetIcon, Database, Table as TableIcon, FileText } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

// Per-connector field definitions — what the user fills in. The labels here
// match the keys the backend connectors expect (see server/modules/integrations/connectors/index.js).
const CONNECTOR_TYPES = [
  {
    type: 'rest_api',
    label: 'REST API',
    icon: Globe,
    description: 'Any JSON endpoint that returns an array of objects.',
    fields: [
      { key: 'url', label: 'Endpoint URL', placeholder: 'https://api.example.com/v1/records', required: true },
      { key: 'arrayPath', label: 'Array path (optional)', placeholder: 'data.items', required: false, hint: 'Dot-path to the array if it isn\'t at the top level.' },
    ],
  },
  {
    type: 'google_sheets',
    label: 'Google Sheets',
    icon: SheetIcon,
    description: 'Public-shareable Google Sheet. Set sharing to "Anyone with the link → Viewer".',
    fields: [
      { key: 'sheetUrl', label: 'Sheet URL', placeholder: 'https://docs.google.com/spreadsheets/d/…', required: true },
    ],
  },
  {
    type: 'airtable',
    label: 'Airtable',
    icon: TableIcon,
    description: 'Use a Personal Access Token with data.records:read on the target base.',
    fields: [
      { key: 'token',     label: 'Personal Access Token', placeholder: 'pat…', required: true, secret: true },
      { key: 'baseId',    label: 'Base ID',               placeholder: 'app…', required: true },
      { key: 'tableName', label: 'Table name',            placeholder: 'Sheet1', required: true },
    ],
  },
  {
    type: 'notion',
    label: 'Notion',
    icon: FileText,
    description: 'Internal integration token. Share the database with the integration first.',
    fields: [
      { key: 'token',      label: 'Internal Integration Token', placeholder: 'secret_…', required: true, secret: true },
      { key: 'databaseId', label: 'Database ID',                placeholder: '32-char hex string', required: true },
    ],
  },
  {
    type: 'postgres',
    label: 'Postgres (preview)',
    icon: Database,
    description: 'Stored but not yet enabled. Install `pg` in server/ and uncomment the connector to activate.',
    fields: [
      { key: 'connectionString', label: 'Connection string', placeholder: 'postgresql://user:pass@host:5432/db', required: true, secret: true },
      { key: 'query',            label: 'SELECT query',      placeholder: 'SELECT * FROM orders WHERE created_at > now() - interval \'30 days\'', required: true },
    ],
  },
];

export default function ConnectIntegrationModal({ open, onClose, onConnected }) {
  const toast = useToast();
  const [type, setType] = useState('rest_api');
  const [name, setName] = useState('');
  const [creds, setCreds] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setType('rest_api');
      setName('');
      setCreds({});
      setSubmitting(false);
    }
  }, [open]);

  const definition = CONNECTOR_TYPES.find((c) => c.type === type) || CONNECTOR_TYPES[0];

  function setField(key, value) {
    setCreds((c) => ({ ...c, [key]: value }));
  }

  async function submit(e) {
    e?.preventDefault?.();
    if (!name.trim()) { toast.error('Give this integration a name.'); return; }
    const missing = definition.fields.filter((f) => f.required && !creds[f.key]?.toString().trim());
    if (missing.length) {
      toast.error(`Missing: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/integrations/connect', {
        type,
        name: name.trim(),
        credentials: creds,
      });
      onConnected?.(data.integration);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not connect');
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-stretch justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.form
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            onSubmit={submit}
            className="w-full max-w-3xl rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100vh - 32px)' }}
          >
            <header className="px-6 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
                <Plug className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">Connect a data source</div>
                <div className="text-[11px] text-ink-500 leading-tight mt-0.5">
                  Credentials are encrypted at rest. Only you can use them.
                </div>
              </div>
              <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="px-6 py-4 overflow-y-auto space-y-4 flex-1">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1.5">Source type</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {CONNECTOR_TYPES.map((c) => {
                    const Icon = c.icon;
                    const active = type === c.type;
                    return (
                      <button
                        key={c.type}
                        type="button"
                        onClick={() => { setType(c.type); setCreds({}); }}
                        className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-medium border transition ${
                          active
                            ? 'border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                            : 'border-ink-200/60 dark:border-ink-800/60 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800/40'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-ink-500 mt-2 leading-relaxed">{definition.description}</div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1">Name *</div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`My ${definition.label} data`}
                  className="input w-full"
                  maxLength={80}
                  autoFocus
                />
              </div>

              {definition.fields.map((field) => (
                <div key={field.key}>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1">
                    {field.label}{field.required ? ' *' : ''}
                  </div>
                  <input
                    type={field.secret ? 'password' : 'text'}
                    autoComplete="off"
                    spellCheck={false}
                    value={creds[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="input w-full"
                  />
                  {field.hint && (
                    <div className="text-[11px] text-ink-500 mt-1">{field.hint}</div>
                  )}
                </div>
              ))}
            </div>

            <footer className="px-6 py-4 border-t border-ink-200/60 dark:border-ink-800/60 bg-ink-50/40 dark:bg-ink-900/40 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting || !name.trim()}>
                {submitting ? <><Sparkles className="w-4 h-4 animate-pulse" /> Connecting…</> : <><Plug className="w-4 h-4" /> Connect</>}
              </button>
            </footer>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
