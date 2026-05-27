// AES-256-GCM helpers for at-rest encryption of user-supplied secrets
// (OpenAI / Anthropic API keys). Encryption key is derived from JWT_SECRET
// — same lifecycle as the auth signing key, so no new env var is required.
//
// Output format: `<ivBase64>:<authTagBase64>:<ciphertextBase64>`. Easy to
// store in a string field, easy to detect (presence of two `:` separators
// before any non-base64 char) and decrypt.

import crypto from 'crypto';

function deriveKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be set to encrypt user secrets.');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain) {
  if (typeof plain !== 'string' || !plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(payload) {
  if (typeof payload !== 'string' || !payload.includes(':')) return '';
  const parts = payload.split(':');
  if (parts.length !== 3) return '';
  try {
    const iv  = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ct  = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ct), decipher.final()]);
    return out.toString('utf8');
  } catch {
    return '';
  }
}

/** Mask a secret for display: shows last 4 chars only. */
export function maskSecret(plain) {
  if (typeof plain !== 'string' || !plain) return '';
  if (plain.length <= 8) return '••••';
  return `••••${plain.slice(-4)}`;
}
