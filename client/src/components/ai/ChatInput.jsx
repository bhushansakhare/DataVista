import { useRef, useState } from 'react';
import { Paperclip, Send, FileSpreadsheet, X, Link2 } from 'lucide-react';
import { isGoogleSheetUrl } from '../../utils/parseUpload.js';

/**
 * Composer for the AI Assistant. Single textarea that auto-detects:
 *   - Google Sheet URL (sends to sheet-import flow)
 *   - Otherwise → free-text prompt against the active dataset
 *
 * Plus a paperclip button for CSV/XLSX uploads (also accepts drag-and-drop
 * from the parent page via `onFile`).
 */
export default function ChatInput({ onSubmit, onFile, busy, hasData }) {
  const [text, setText] = useState('');
  const fileRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachedFile(f);
    onFile?.(f);
    e.target.value = ''; // allow re-picking the same file
  }

  function clearFile() {
    setAttachedFile(null);
  }

  function send(e) {
    e?.preventDefault?.();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setText('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const detectedUrl = isGoogleSheetUrl(text.trim());
  const placeholder = hasData
    ? 'Ask anything about your data — or paste another sheet URL'
    : 'Paste a Google Sheet URL, attach a file, or describe the dashboard you want…';

  return (
    <form
      onSubmit={send}
      className="rounded-2xl border border-ink-200/60 dark:border-ink-800/60 bg-white dark:bg-ink-900 shadow-soft p-2.5"
    >
      {attachedFile && (
        <div className="mb-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300 text-xs">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span className="font-medium truncate max-w-[260px]">{attachedFile.name}</span>
          <button
            type="button"
            onClick={clearFile}
            className="ml-1 -mr-1 hover:bg-brand-500/20 rounded-full p-0.5"
            title="Remove"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {detectedUrl && (
        <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
          <Link2 className="w-3 h-3" /> Google Sheet detected — will import
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={pickFile}
          className="btn-ghost p-2 flex-shrink-0"
          title="Upload CSV or XLSX"
          disabled={busy}
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFile}
          className="hidden"
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={busy}
          className="flex-1 resize-none bg-transparent border-0 outline-none focus:ring-0 px-2 py-2 text-sm leading-relaxed max-h-40 disabled:opacity-50"
          style={{ minHeight: 36 }}
        />

        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="btn-primary p-2.5 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
