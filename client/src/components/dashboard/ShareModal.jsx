import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Share2, RefreshCw, Download, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import Modal from '../ui/Modal.jsx';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ShareModal({ open, onClose, dashboardId }) {
  const [share, setShare] = useState(null);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState('view');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);
  const toast = useToast();

  // Public URL — must point to the React route, not the API path.
  const url = share ? `${window.location.origin}/s/${share.publicToken}` : '';

  useEffect(() => {
    if (open) { setShare(null); setCopied(false); }
  }, [open]);

  useEffect(() => {
    if (canvasRef.current && url) {
      // Bigger module size + larger output makes scanning reliable on phones.
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      }, () => {});
    }
  }, [url]);

  async function generate() {
    setBusy(true);
    try {
      const { data } = await api.post('/share/generate', {
        dashboardId, permission,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      });
      setShare(data.share);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not generate link');
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Link copied');
  }

  function downloadQr() {
    if (!canvasRef.current || !share) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `dashboard-${share.publicToken.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('QR downloaded');
    } catch {
      toast.error('Could not download QR');
    }
  }

  function openLink() {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <Modal open={open} onClose={onClose} title="Share dashboard" size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Permission</label>
            <select value={permission} onChange={(e) => setPermission(e.target.value)} className="input mt-1.5">
              <option value="view">View only</option>
              <option value="edit">Edit (signed-in)</option>
            </select>
          </div>
          <div>
            <label className="label">Expires in (days)</label>
            <input
              type="number" min="0"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="never"
              className="input mt-1.5"
            />
          </div>
        </div>

        {!share ? (
          <button onClick={generate} disabled={busy} className="btn-primary w-full">
            {busy ? 'Generating…' : <><Share2 className="w-4 h-4" /> Generate link</>}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input readOnly value={url} className="input flex-1 font-mono text-xs" />
              <button onClick={copy} className="btn-secondary p-2.5" title="Copy link">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button onClick={openLink} className="btn-secondary p-2.5" title="Open link">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-start gap-4">
              <canvas ref={canvasRef} className="rounded-lg bg-white p-2 flex-shrink-0" />
              <div className="text-xs text-ink-500 space-y-2 flex-1 min-w-0">
                <div>Anyone with this link can view the dashboard — no sign-in required.</div>
                <div>Works on mobile, desktop, and external users.</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={downloadQr} className="btn-secondary text-xs py-1.5 px-2.5">
                    <Download className="w-3.5 h-3.5" /> Download QR
                  </button>
                  <button onClick={generate} className="btn-ghost text-xs py-1.5 px-2.5">
                    <RefreshCw className="w-3.5 h-3.5" /> New link
                  </button>
                </div>
                <div className="pt-1">Token: <span className="font-mono">{share.publicToken.slice(0, 12)}…</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
