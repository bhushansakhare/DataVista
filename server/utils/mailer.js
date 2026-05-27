import nodemailer from 'nodemailer';
import { getSystemSetting } from '../models/SystemSetting.js';
import { decryptSecret } from './crypto.js';

// Resolves SMTP config from the DB first (admin-managed via Settings UI),
// falling back to env vars. Returns null if neither source is configured —
// callers should treat that as "email disabled" and log a warning rather
// than throwing.
async function resolveSmtp() {
  const doc = await getSystemSetting();
  const s = doc.smtp || {};
  const fromDb = {
    host:      decryptSecret(s.host) || '',
    port:      Number(s.port) || 587,
    secure:    Boolean(s.secure),
    user:      decryptSecret(s.user) || '',
    pass:      decryptSecret(s.pass) || '',
    fromEmail: s.fromEmail || '',
    fromName:  s.fromName || 'SheetFlow',
  };
  if (fromDb.host && fromDb.user && fromDb.pass) return fromDb;

  const envHost = process.env.SMTP_HOST;
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASS;
  if (envHost && envUser && envPass) {
    return {
      host: envHost,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: envUser,
      pass: envPass,
      fromEmail: process.env.SMTP_FROM_EMAIL || envUser,
      fromName:  process.env.SMTP_FROM_NAME  || 'SheetFlow',
    };
  }
  return null;
}

async function getTransport(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,            // true for 465, false for 587 / STARTTLS
    auth: { user: smtp.user, pass: smtp.pass },
    // Accept self-signed / hostname-mismatch certificates — helps Gmail
    // App Passwords from environments with corporate proxies and any SMTP
    // host using a self-signed cert. Connection is still TLS-encrypted;
    // we just don't verify the chain.
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Send an email. Returns { sent: boolean, reason?: string } — never throws,
 * so callers (signup, password reset) can degrade gracefully when SMTP is
 * not yet configured.
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    const smtp = await resolveSmtp();
    if (!smtp) {
      console.warn('[mailer] SMTP not configured — email skipped:', subject, '→', to);
      return { sent: false, reason: 'smtp_not_configured' };
    }
    const transport = await getTransport(smtp);
    const info = await transport.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail || smtp.user}>`,
      to, subject, html, text,
    });
    console.log('[mailer] sent', subject, '→', to, '| messageId:', info.messageId);
    return { sent: true };
  } catch (err) {
    const msg = err?.message || String(err);
    // Surface Gmail's 535 with the actionable fix rather than the cryptic
    // raw response. App Passwords require 2-Step Verification on the
    // Google account (https://myaccount.google.com/apppasswords).
    if (/535/.test(msg) && /smtp\.gmail\.com/i.test(err?.address || '') === false) {
      console.warn('[mailer] SMTP 535 — Gmail: enable 2-Step Verification and use an App Password (https://myaccount.google.com/apppasswords). Other providers: confirm the auth credentials.');
    }
    console.warn('[mailer] send failed:', msg);
    return { sent: false, reason: msg };
  }
}

// ── Templates ───────────────────────────────────────────────────────────

const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';

function shell(title, bodyHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:24px 28px;color:#fff">
      <div style="font-size:13px;font-weight:600;letter-spacing:.02em;opacity:.9">SheetFlow Analytics</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">${title}</div>
    </div>
    <div style="padding:28px;font-size:15px;line-height:1.6">
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;background:#f8fafc;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">
      SheetFlow Analytics · <a href="${CLIENT_URL()}" style="color:#6366f1;text-decoration:none">${CLIENT_URL()}</a>
    </div>
  </div>
</body></html>`;
}

export function sendWelcomeEmail(user) {
  const loginUrl = `${CLIENT_URL()}/login`;
  const html = shell('Welcome to SheetFlow', `
    <p>Hi ${escapeHtml(user.name || 'there')},</p>
    <p>Your SheetFlow account is ready. Sign in to import data, build dashboards, and share them with your team.</p>
    <p style="margin-top:24px"><a href="${loginUrl}" style="display:inline-block;padding:12px 22px;background:#6366f1;color:#fff;font-weight:600;border-radius:10px;text-decoration:none">Open SheetFlow</a></p>
    <p style="margin-top:24px;font-size:13px;color:#64748b">If this wasn't you, please ignore this email.</p>
  `);
  const text = `Welcome to SheetFlow. Sign in at ${loginUrl}`;
  return sendEmail({ to: user.email, subject: 'Welcome to SheetFlow', html, text });
}

/**
 * Notify both sides of a successful referral. Call once with isReferrer=false
 * (the new signup) and once with isReferrer=true (the existing user who
 * shared the code).
 */
export function sendReferralSuccessEmail(recipient, otherParty, credits, isReferrer = false) {
  const settingsUrl = `${CLIENT_URL()}/app/settings?tab=plan`;
  const subject = isReferrer
    ? `${otherParty.name || 'A friend'} joined with your referral code`
    : 'Your referral bonus is here';
  const heading = isReferrer ? 'New referral — bonus credits added' : 'Welcome bonus credits added';
  const body = isReferrer
    ? `<p>Hi ${escapeHtml(recipient.name || 'there')},</p>
       <p><strong>${escapeHtml(otherParty.name || 'A new user')}</strong> just signed up using your referral code.</p>
       <p>We've added <strong>${credits} credits</strong> to your account as a thank-you.</p>`
    : `<p>Hi ${escapeHtml(recipient.name || 'there')},</p>
       <p>You signed up with <strong>${escapeHtml(otherParty.name || 'a friend')}</strong>'s referral code.</p>
       <p>We've added <strong>${credits} credits</strong> to your account to get you started.</p>`;
  const html = shell(heading, `${body}
    <p style="margin-top:24px"><a href="${settingsUrl}" style="display:inline-block;padding:12px 22px;background:#6366f1;color:#fff;font-weight:600;border-radius:10px;text-decoration:none">View your credits</a></p>
  `);
  const text = `${heading}: ${credits} credits added. ${settingsUrl}`;
  return sendEmail({ to: recipient.email, subject, html, text });
}

/**
 * Send a "your plan is expiring soon" notice. Triggered manually by an admin
 * from the Settings → Plan tab, and reusable from a daily cron once that
 * lands.
 */
export function sendPlanExpiryReminderEmail(user, plan, expiresAt, daysRemaining) {
  const pricingUrl = `${CLIENT_URL()}/pricing`;
  const subject = 'Your Plan is Expiring Soon';
  const expires = expiresAt ? new Date(expiresAt).toLocaleDateString() : 'soon';
  const days = Number.isFinite(daysRemaining) ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}` : 'a few days';
  const html = shell('Your plan is expiring soon', `
    <p>Hi ${escapeHtml(user.name || 'there')},</p>
    <p>Your <strong>${escapeHtml(plan?.name || 'plan')}</strong> on SheetFlow is set to expire on
    <strong>${escapeHtml(expires)}</strong> — that's about <strong>${escapeHtml(days)}</strong> from now.</p>
    <p>Renew now to keep your dashboards live and your credits topped up.</p>
    <p style="margin-top:24px"><a href="${pricingUrl}" style="display:inline-block;padding:12px 22px;background:#6366f1;color:#fff;font-weight:600;border-radius:10px;text-decoration:none">Renew plan</a></p>
    <p style="margin-top:24px;font-size:13px;color:#64748b">If you have questions, just reply to this email.</p>
  `);
  const text = `Your ${plan?.name || 'plan'} on SheetFlow expires on ${expires} (${days} from now). Renew: ${pricingUrl}`;
  return sendEmail({ to: user.email, subject, html, text });
}

/**
 * Sent after a successful checkout — surfaces what was bought and when it
 * expires. Same template covers first purchase, upgrade, and renewal.
 */
export function sendPaymentSuccessEmail(user, plan, expiresAt) {
  const settingsUrl = `${CLIENT_URL()}/app/settings?tab=plan`;
  const expires = expiresAt
    ? new Date(expiresAt).toLocaleDateString()
    : plan?.period === 'one_time' ? 'no expiry — perpetual' : '—';
  const price = plan?.price === 0
    ? 'Free'
    : `${plan?.currency === 'USD' ? '$' : ''}${plan?.price || 0}`;
  const html = shell('Payment received — your plan is active', `
    <p>Hi ${escapeHtml(user.name || 'there')},</p>
    <p>Thanks for the payment — your <strong>${escapeHtml(plan?.name || 'plan')}</strong> is active.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b">Plan</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(plan?.name || '')}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Amount</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(price)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Credits added</td><td style="padding:6px 0;text-align:right;font-weight:600">${plan?.credits === -1 ? '∞ Unlimited' : (plan?.credits || 0)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Expires</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(expires)}</td></tr>
    </table>
    <p style="margin-top:24px"><a href="${settingsUrl}" style="display:inline-block;padding:12px 22px;background:#6366f1;color:#fff;font-weight:600;border-radius:10px;text-decoration:none">View your plan</a></p>
  `);
  const text = `Payment received. Plan: ${plan?.name}. Expires: ${expires}. ${settingsUrl}`;
  return sendEmail({ to: user.email, subject: 'Payment received — plan active', html, text });
}

export function sendPasswordResetEmail(user, token) {
  const resetUrl = `${CLIENT_URL()}/reset-password?token=${encodeURIComponent(token)}`;
  const html = shell('Reset your password', `
    <p>Hi ${escapeHtml(user.name || 'there')},</p>
    <p>We received a request to reset your SheetFlow password. The link below is valid for <strong>15 minutes</strong>.</p>
    <p style="margin-top:24px"><a href="${resetUrl}" style="display:inline-block;padding:12px 22px;background:#6366f1;color:#fff;font-weight:600;border-radius:10px;text-decoration:none">Reset password</a></p>
    <p style="margin-top:24px;font-size:13px;color:#64748b">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  `);
  const text = `Reset your SheetFlow password: ${resetUrl} (link valid for 15 minutes)`;
  return sendEmail({ to: user.email, subject: 'Reset your SheetFlow password', html, text });
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
