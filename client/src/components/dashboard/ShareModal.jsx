import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Share2, RefreshCw } from 'lucide-react';
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

  const url = share ? `${window.location.origin}/s/${share.publicToken}` : '';

  useEffect(() => {
    if (open) { setShare(null); setCopied(false); }
  }, [open]);

  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, { width: 168, margin: 1 }, () => {});
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
              <button onClick={copy} className="btn-secondary p-2.5">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-start gap-4">
              <canvas ref={canvasRef} className="rounded-lg bg-white p-2" />
              <div className="text-xs text-ink-500 space-y-1.5">
                <div>Anyone with this link can view the dashboard.</div>
                <div>Token: <span className="font-mono">{share.publicToken.slice(0, 12)}…</span></div>
                <button onClick={generate} className="btn-ghost mt-2"><RefreshCw className="w-3.5 h-3.5" /> New link</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
