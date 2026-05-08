import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, MessageSquare, FileSpreadsheet, Link2, LayoutTemplate, X } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ChatMessage from '../components/ai/ChatMessage.jsx';
import ChatInput from '../components/ai/ChatInput.jsx';
import PreviewPanel from '../components/ai/PreviewPanel.jsx';
import ShareModal from '../components/dashboard/ShareModal.jsx';
import { parseFile, isGoogleSheetUrl, buildEphemeralSheet } from '../utils/parseUpload.js';
import { aiSuggestionToDashboard } from '../utils/aiToChart.js';

/**
 * Chat-based dashboard builder.
 *
 *  ┌─ left: chat workspace ─┐  ┌─ right: live preview ─┐
 *  │  history of messages   │  │  KPIs + charts +      │
 *  │  composer (text /      │  │  insights, with       │
 *  │  file / sheet URL)     │  │  Use / Edit / Share   │
 *  └────────────────────────┘  └───────────────────────┘
 *
 * Drives the existing /api/ai/* and /api/dashboard endpoints. No backend
 * changes — only consumes endpoints already shipped.
 */
export default function AiAssistantPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [messages, setMessages] = useState(() => [welcomeMessage()]);
  const [sheet, setSheet] = useState(null);          // Sheet (persisted) or ephemeral (file upload)
  const [generated, setGenerated] = useState(null);  // Last AI dashboard
  const [savedDashboardId, setSavedDashboardId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [provider, setProvider] = useState('openai'); // 'openai' | 'claude' — sent with each /generate-dashboard call
  const [template, setTemplate] = useState(null);     // { id, name, ... } when arrived via /templates
  const scrollRef = useRef(null);

  // When the user arrives from the Templates page (?template=<id>), fetch
  // the template details so we can show its name in the header and tell the
  // AI to fill its slots instead of designing freely.
  const templateIdParam = searchParams.get('template') || '';
  useEffect(() => {
    if (!templateIdParam) {
      setTemplate(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/templates/${encodeURIComponent(templateIdParam)}`);
        if (alive) setTemplate(data?.template || null);
      } catch {
        if (alive) {
          toast.error('Template not found — falling back to free design.');
          setTemplate(null);
        }
      }
    })();
    return () => { alive = false; };
  }, [templateIdParam, toast]);

  function clearTemplate() {
    setTemplate(null);
    const next = new URLSearchParams(searchParams);
    next.delete('template');
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function pushMessage(m) {
    setMessages((arr) => [...arr, m]);
  }

  function replaceLastThinking(replacement) {
    setMessages((arr) => {
      const idx = [...arr].reverse().findIndex((m) => m.role === 'thinking');
      if (idx === -1) return [...arr, replacement];
      const realIdx = arr.length - 1 - idx;
      return [...arr.slice(0, realIdx), replacement, ...arr.slice(realIdx + 1)];
    });
  }

  /* ─── input handlers ─── */

  async function handleText(text) {
    if (isGoogleSheetUrl(text)) {
      await importSheetUrl(text);
      return;
    }
    // Free-text → generate dashboard with this query against the active sheet
    if (!sheet) {
      pushMessage({ role: 'user', content: text });
      pushMessage({
        role: 'error',
        title: 'No data loaded yet',
        content: 'Paste a Google Sheet URL or drop a CSV / XLSX file first, then describe the dashboard you want.',
      });
      return;
    }
    pushMessage({ role: 'user', content: text });
    await generateFromQuery(text);
  }

  async function handleFile(file) {
    pushMessage({
      role: 'user',
      content: `Uploaded ${file.name}`,
      attachment: 'sheet',
      attachmentLabel: 'FILE UPLOAD',
    });
    pushMessage({ role: 'thinking', content: 'Parsing file…' });
    try {
      const { rows, columns } = await parseFile(file);
      if (rows.length === 0) throw new Error('File contains no rows');

      // Persist the upload as a real Sheet so the user can save / share /
      // open the dashboard later — no more "session-only" restriction.
      // Falls back to an ephemeral preview if the API is unreachable.
      let s;
      try {
        const { data } = await api.post('/sheet/upload', {
          title: file.name,
          columns,
          rows,
        });
        s = data.sheet;
      } catch (uploadErr) {
        const status = uploadErr?.response?.status;
        const msg = uploadErr?.response?.data?.error || uploadErr?.message;
        toast.error(
          status === 413
            ? 'File too large to upload — preview-only this session.'
            : `Upload failed (${msg || 'unknown'}) — preview-only this session.`,
        );
        s = buildEphemeralSheet({ title: file.name, rows, columns });
      }
      setSheet(s);

      const persisted = !String(s._id).startsWith('eph-');
      replaceLastThinking({
        role: 'assistant',
        content:
          `Loaded **${file.name}** — ${rows.length.toLocaleString()} rows across ${columns.length} columns. ` +
          (persisted ? 'Saved to your workspace. Generating dashboard…' : 'Preview only. Generating dashboard…'),
      });
      await generateFromQuery('Build the most useful analytical dashboard for this dataset.');
    } catch (err) {
      replaceLastThinking({
        role: 'error',
        title: 'Could not read file',
        content: err?.message || 'Try a .csv, .xls, or .xlsx export.',
      });
    }
  }

  async function importSheetUrl(url) {
    pushMessage({
      role: 'user',
      content: url,
      attachment: 'sheet',
      attachmentLabel: 'GOOGLE SHEET',
    });
    pushMessage({ role: 'thinking', content: 'Importing sheet…' });
    try {
      const { data } = await api.post('/sheet/import', { sheetUrl: url });
      const sheetId = data?.sheet?._id;
      if (!sheetId) throw new Error('Import returned no sheet id');
      const { data: full } = await api.get(`/sheet/${sheetId}`);
      const s = full.sheet;
      setSheet(s);
      replaceLastThinking({
        role: 'assistant',
        content: `Imported **${s.title}** — ${s.rowCount.toLocaleString()} rows across ${(s.columns || []).length} columns. Generating an analytical dashboard…`,
      });
      await generateFromQuery('Build the most useful analytical dashboard for this sheet.');
    } catch (err) {
      replaceLastThinking({
        role: 'error',
        title: 'Could not import sheet',
        content: err?.response?.data?.error || err?.message || 'Make sure the sheet is public.',
      });
    }
  }

  /* ─── AI generation ─── */

  async function generateFromQuery(userQuery) {
    if (!sheet) return;

    // ── HTML / URL templates: skip the slot-based AI generator entirely.
    // Apply data into the raw template via /api/templates/:id/apply, then
    // hand the rendered HTML to the preview as `templateRendered`.
    if (template && (template.templateType === 'html' || template.templateType === 'url')) {
      pushMessage({ role: 'thinking', content: 'Filling your template with sheet data…' });
      try {
        console.log('TEMPLATE LENGTH (apply):',
          template.templateType === 'html' ? (template.templateCode || '').length : `[url] ${template.templateUrl || ''}`,
          '| rows:', sheet.rawData?.length || 0);
        const { data } = await api.post(`/templates/${encodeURIComponent(template.id)}/apply`, {
          sheetId: sheet._id,
        });
        const applied = data?.applied || {};
        // Generated payload mirrors the AI flow's shape so PreviewPanel +
        // save flow understand it. The chart pipeline isn't used here —
        // the iframe is the renderer.
        setGenerated({
          title: template.name,
          summary: template.description || '',
          theme: 'light',
          kpis: [],
          charts: [],
          insights: [],
          source: applied.source || 'template',
          templateId: template.id,
          templateType: applied.templateType,
          templateCode: applied.templateCode || '',
          templateUrl:  applied.templateUrl  || '',
        });
        setSavedDashboardId(null);
        replaceLastThinking({
          role: 'assistant',
          content: applied.source === 'fallback'
            ? `Loaded **${template.name}** but couldn't reach the AI to fill placeholders — showing the template body untouched.`
            : `Filled **${template.name}** with values from your sheet. Review on the right and click "Use this dashboard" to save it.`,
        });
      } catch (err) {
        replaceLastThinking({
          role: 'error',
          title: 'Could not apply template',
          content: err?.response?.data?.error || err?.message || 'Try again.',
        });
      }
      return;
    }

    // ── Default path: slot-based AI dashboard generation ────────────────
    pushMessage({ role: 'thinking', content: 'Analysing your data…' });
    try {
      const sheetData = Array.isArray(sheet.rawData) ? sheet.rawData : [];
      console.log('SELECTED PROVIDER:', provider, 'TEMPLATE:', template?.id || '—');
      const { data } = await api.post('/ai/generate-dashboard', {
        sheetData,
        userQuery,
        provider,
        templateId: template?.id || undefined,
      });
      setGenerated(data);
      setSavedDashboardId(null);
      const chartCount = Array.isArray(data?.charts) ? data.charts.length : 0;
      const kpiCount = Array.isArray(data?.kpis) ? data.kpis.length : 0;
      replaceLastThinking({
        role: 'assistant',
        content:
          `Done. Built **${data?.title || 'dashboard'}** with ${kpiCount} KPI${kpiCount === 1 ? '' : 's'} and ${chartCount} chart${chartCount === 1 ? '' : 's'}. ` +
          (data?.source === 'fallback'
            ? '(AI offline — heuristic output; set an API key for full AI generation.)'
            : 'Review on the right and click "Use this dashboard" to save it.'),
      });
    } catch (err) {
      replaceLastThinking({
        role: 'error',
        title: 'Could not generate dashboard',
        content: err?.response?.data?.error || err?.message || 'Try again or refine your prompt.',
      });
    }
  }

  /* ─── post-generation actions ─── */

  function isEphemeral(s) {
    return typeof s?._id === 'string' && s._id.startsWith('eph-');
  }

  async function handleUse() {
    if (!sheet || !generated) return;
    if (isEphemeral(sheet)) {
      // Only happens when the upload API was unreachable and we fell back
      // to a session-only preview. Re-upload the file to save.
      toast.error('Upload didn\'t reach the server — re-upload to save the dashboard.');
      return;
    }
    setActionBusy((b) => ({ ...b, use: true }));
    try {
      const payload = aiSuggestionToDashboard(generated, sheet);
      if (!payload.charts.length) throw new Error('No chartable columns to save.');
      const { data } = await api.post('/dashboard', payload);
      setSavedDashboardId(data.dashboard._id);
      toast.success('Dashboard saved');
      navigate(`/app/dashboards/${data.dashboard._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'Could not save');
    } finally {
      setActionBusy((b) => ({ ...b, use: false }));
    }
  }

  async function handleEdit() {
    if (!sheet || !generated) return;
    if (isEphemeral(sheet)) {
      toast.error('Upload didn\'t reach the server — re-upload to edit.');
      return;
    }
    setActionBusy((b) => ({ ...b, edit: true }));
    try {
      let id = savedDashboardId;
      if (!id) {
        const payload = aiSuggestionToDashboard(generated, sheet);
        const { data } = await api.post('/dashboard', payload);
        id = data.dashboard._id;
        setSavedDashboardId(id);
      }
      navigate(`/app/dashboards/${id}/edit`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'Could not open editor');
    } finally {
      setActionBusy((b) => ({ ...b, edit: false }));
    }
  }

  async function handleRegenerate() {
    if (!sheet) return;
    setActionBusy((b) => ({ ...b, regenerate: true }));
    try {
      pushMessage({ role: 'user', content: 'Regenerate the dashboard with a different angle.' });
      await generateFromQuery('Propose a different dashboard with a different analytical angle than before. Mix chart types and use different columns where possible.');
    } finally {
      setActionBusy((b) => ({ ...b, regenerate: false }));
    }
  }

  async function handleShare() {
    if (!generated) return;
    if (isEphemeral(sheet)) {
      toast.error('Upload didn\'t reach the server — re-upload to share.');
      return;
    }
    setActionBusy((b) => ({ ...b, share: true }));
    try {
      let id = savedDashboardId;
      if (!id) {
        const payload = aiSuggestionToDashboard(generated, sheet);
        const { data } = await api.post('/dashboard', payload);
        id = data.dashboard._id;
        setSavedDashboardId(id);
      }
      setShareOpen(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'Could not prepare share link');
    } finally {
      setActionBusy((b) => ({ ...b, share: false }));
    }
  }

  /* ─── drag-and-drop ─── */

  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave(e) {
    if (e.currentTarget === e.target) setDragOver(false);
  }
  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <div
      className="h-[calc(100vh-0px)] lg:h-screen flex flex-col lg:flex-row"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Chat workspace */}
      <section className="flex flex-col w-full lg:w-[440px] xl:w-[480px] flex-shrink-0 border-r border-ink-200/60 dark:border-ink-800/60 bg-white/60 dark:bg-ink-900/40">
        <header className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-tight flex items-center gap-2 flex-wrap">
              AI Assistant
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 border border-brand-500/20"
                title="Active AI provider"
              >
                Using {provider === 'openai' ? 'ChatGPT' : 'Claude'}
              </span>
              {template && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20"
                  title="Filling template slots"
                >
                  <LayoutTemplate className="w-3 h-3" />
                  {template.name}
                  <button
                    onClick={clearTemplate}
                    className="ml-0.5 -mr-0.5 opacity-60 hover:opacity-100"
                    title="Clear template"
                    aria-label="Clear template"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
            </div>
            <div className="text-[11px] text-ink-500">
              {sheet
                ? `${sheet.title} · ${sheet.rowCount?.toLocaleString?.() ?? sheet.rawData?.length ?? 0} rows`
                : (template ? `Add data to apply the ${template.name} template` : 'Chat-based dashboard builder')}
            </div>
          </div>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="text-xs rounded-lg border border-ink-200/60 dark:border-ink-700/60 bg-white dark:bg-ink-900 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            aria-label="AI provider"
            title="Choose which AI builds the dashboard"
          >
            <option value="openai">ChatGPT (OpenAI)</option>
            <option value="claude">Claude AI</option>
          </select>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m, i) => (
            <ChatMessage key={i} message={m} />
          ))}
        </div>

        <div className="px-5 py-4 border-t border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900">
          <ChatInput
            onSubmit={handleText}
            onFile={handleFile}
            busy={messages[messages.length - 1]?.role === 'thinking'}
            hasData={Boolean(sheet)}
          />
          <div className="mt-2 flex items-center gap-3 text-[10px] text-ink-500 flex-wrap">
            <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> Sheet URL</span>
            <span className="inline-flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> CSV / XLSX</span>
            <span className="inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Free-text prompt</span>
          </div>
        </div>
      </section>

      {/* Live preview */}
      <section className="flex-1 min-w-0 relative">
        <PreviewPanel
          sheet={sheet}
          generated={generated}
          onUse={handleUse}
          onEdit={handleEdit}
          onRegenerate={handleRegenerate}
          onShare={handleShare}
          onQr={handleShare}
          busy={actionBusy}
        />

        {dragOver && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-brand-500/10 backdrop-blur-sm border-2 border-dashed border-brand-500/60 rounded-none">
            <div className="card p-6 text-center max-w-sm">
              <FileSpreadsheet className="w-10 h-10 text-brand-500 mx-auto" />
              <div className="font-semibold mt-3">Drop your file to upload</div>
              <div className="text-xs text-ink-500 mt-1">Supports .csv, .xls, .xlsx</div>
            </div>
          </div>
        )}
      </section>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        dashboardId={savedDashboardId}
      />
    </div>
  );
}

/* ─── helpers ─── */

function welcomeMessage() {
  return {
    role: 'assistant',
    content:
      "Hi! I'm your AI dashboard assistant. Give me data and I'll build a dashboard.\n\n• Paste a Google Sheet URL\n• Drag a CSV / XLSX file in here\n• Or describe the dashboard you want once data is loaded",
  };
}
