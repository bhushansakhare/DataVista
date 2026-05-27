import Invoice from '../models/Invoice.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Build a printable HTML invoice. We don't ship a PDF library — the user
 * downloads HTML they can print to PDF from the browser, which keeps the
 * dep tree small. Swap in pdfkit/puppeteer here if you need a true PDF.
 */
function invoiceHtml(inv) {
  const date = new Date(inv.createdAt || Date.now()).toLocaleDateString();
  const amount = inv.amount === 0
    ? 'Free'
    : `${inv.currency === 'USD' ? '$' : ''}${inv.amount.toFixed(2)}`;
  const expires = inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : '—';
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Invoice ${escapeHtml(inv.invoiceNumber)}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:40px;background:#f8fafc;color:#0f172a}
  .invoice{max-width:720px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  h1{margin:0 0 4px;font-size:28px}
  .muted{color:#64748b;font-size:13px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:32px 0}
  .label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{text-align:left;padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  .total{font-weight:700;font-size:18px}
  .badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
  .badge.paid{background:#10b9811a;color:#059669}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b}
  @media print { body{background:#fff;padding:0} .invoice{box-shadow:none;border:none;border-radius:0} .print-btn{display:none} }
  .print-btn{margin:20px auto 0;display:block;padding:10px 20px;background:#6366f1;color:#fff;border:0;border-radius:8px;font-weight:600;cursor:pointer}
</style></head>
<body>
<div class="invoice">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>Invoice</h1>
      <div class="muted">#${escapeHtml(inv.invoiceNumber)}</div>
    </div>
    <span class="badge paid">${escapeHtml(inv.status)}</span>
  </div>
  <div class="grid">
    <div>
      <div class="label">Billed to</div>
      <div><strong>${escapeHtml(inv.userName || '—')}</strong></div>
      <div class="muted">${escapeHtml(inv.userEmail || '')}</div>
    </div>
    <div>
      <div class="label">Issued</div>
      <div>${escapeHtml(date)}</div>
      <div class="label" style="margin-top:8px">Plan expires</div>
      <div>${escapeHtml(expires)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>
          <strong>${escapeHtml(inv.planName || '')}</strong>
          <div class="muted">${escapeHtml(inv.period === 'one_time' ? 'One-time' : inv.period === 'year' ? 'Yearly billing' : 'Monthly billing')} — ${inv.creditsAdded === -1 ? 'Unlimited' : inv.creditsAdded} credits</div>
        </td>
        <td style="text-align:right">${escapeHtml(amount)}</td>
      </tr>
      <tr><td>Tax</td><td style="text-align:right">—</td></tr>
      <tr><td class="total">Total</td><td style="text-align:right" class="total">${escapeHtml(amount)}</td></tr>
    </tbody>
  </table>
  <div class="footer">
    DataVista Analytics · payment provider: ${escapeHtml(inv.provider || 'simulated')}${inv.orderId ? ` · order ${escapeHtml(inv.orderId)}` : ''}
  </div>
</div>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body></html>`;
}

/** GET /api/payments/invoices — list of mine, newest first. */
export async function listMyInvoices(req, res, next) {
  try {
    const invoices = await Invoice.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ invoices });
  } catch (err) { next(err); }
}

/** GET /api/payments/invoices/:id — JSON of one invoice (owner-scoped). */
export async function getMyInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice });
  } catch (err) { next(err); }
}

/**
 * GET /api/payments/invoices/:id/download — printable HTML, served with a
 * download disposition so browsers save instead of navigate. Users can
 * "Print → Save as PDF" from the rendered page.
 */
export async function downloadMyInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!invoice) return res.status(404).send('Invoice not found');
    const html = invoiceHtml(invoice);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${invoice.invoiceNumber}.html"`,
    );
    res.send(html);
  } catch (err) { next(err); }
}
