import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { encryptSecret } from '../utils/crypto.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendReferralSuccessEmail } from '../utils/mailer.js';
import { generateReferralCode, applyReferralBonus, provisionDefaultPlan, REFERRAL_BONUS } from './planController.js';

/**
 * Strong-password rule: ≥ 8 chars, at least one letter, at least one digit.
 * Returns the rejection reason or null if the password is acceptable.
 * Kept in one place so register + reset-password apply the same rule.
 */
function validatePassword(pw) {
  const s = String(pw || '');
  if (s.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(s)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(s)) return 'Password must contain at least one number.';
  return null;
}

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('Server misconfigured: JWT_SECRET missing');
    err.status = 500;
    throw err;
  }
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, password, workspaceName, referralCode, planId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Enter a valid email address.', code: 'invalid_email' });
    }
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr, code: 'weak_password' });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'superadmin' : 'admin';

    const user = await User.create({
      name, email, password, role,
      referralCode: await generateReferralCode(name, email),
    });
    const ws = await Workspace.create({
      name: workspaceName || `${name}'s workspace`,
      ownerId: user._id,
    });
    user.workspaceId = ws._id;
    await user.save();

    // Apply default plan + free credits.
    await provisionDefaultPlan(user);
    // Apply referral bonus on both sides. Throws on invalid/expired/already-used
    // — we let those bubble up as a 400 so the client can show the exact reason.
    // Absent code is a no-op (returns null).
    let referralResult = null;
    if (referralCode) {
      try {
        referralResult = await applyReferralBonus(user, referralCode);
      } catch (refErr) {
        // Roll back the partially-provisioned user so the referrer can retry
        // signup with a different (or no) code.
        await Workspace.deleteOne({ _id: ws._id }).catch(() => {});
        await User.deleteOne({ _id: user._id }).catch(() => {});
        return res.status(refErr.status || 400).json({
          error: refErr.message || 'Referral validation failed',
          code: refErr.code || 'referral_invalid',
        });
      }
    }
    // Fire-and-forget referral-success email to both sides on a successful match.
    if (referralResult?.referrer) {
      sendReferralSuccessEmail(user, referralResult.referrer, REFERRAL_BONUS).catch(() => {});
      sendReferralSuccessEmail(referralResult.referrer, user, REFERRAL_BONUS, true).catch(() => {});
    }
    // If the registration captured a plan choice, assign it (paid plans
    // should ideally go through payment first — this is the foundation;
    // the payment-confirmation gate is the deferred piece).
    if (planId) {
      try {
        const Plan = (await import('../models/Plan.js')).default;
        const chosen = await Plan.findById(planId);
        if (chosen && chosen.isPublic) {
          user.planId = chosen._id;
          user.credits = (user.credits || 0) + (chosen.credits || 0);
          user.planExpiresAt = chosen.period === 'one_time' ? null
            : new Date(Date.now() + (chosen.period === 'year' ? 365 : 30) * 86400000);
          await user.save();
        }
      } catch { /* ignore — falls back to default plan */ }
    }

    const token = signToken(user);
    sendWelcomeEmail(user).catch(() => {});

    res.status(201).json({ token, user, workspace: ws });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let ok = false;
    try {
      ok = await bcrypt.compare(password, user.password);
    } catch {
      ok = false;
    }
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    let workspace = null;
    if (user.workspaceId) {
      workspace = await Workspace.findById(user.workspaceId).catch(() => null);
    }

    return res.json({ token, user, workspace });
  } catch (err) {
    console.error('[login]', err);
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const workspace = req.user.workspaceId ? await Workspace.findById(req.user.workspaceId) : null;
    res.json({ user: req.user, workspace });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/auth/api-keys — set / update / clear a user's AI provider keys.
 * Body: { openai?: string, claude?: string }
 *   - non-empty string  → encrypt and store
 *   - empty string ''   → clear that key
 *   - field absent      → leave that key untouched
 */
export async function updateApiKeys(req, res, next) {
  try {
    const { openai, claude } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.aiKeys) user.aiKeys = { openai: '', claude: '' };

    if (typeof openai === 'string') {
      user.aiKeys.openai = openai.trim() ? encryptSecret(openai.trim()) : '';
    }
    if (typeof claude === 'string') {
      user.aiKeys.claude = claude.trim() ? encryptSecret(claude.trim()) : '';
    }
    await user.save();
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password — { email }
 *
 * Always returns 200 with the same shape, whether or not the email is in
 * the DB. This prevents email enumeration (an attacker can't tell which
 * addresses are registered). The mail is only sent for real users.
 */
export async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    const user = await User.findOne({ email });
    // Per spec: explicitly reveal whether the email exists. (Tradeoff: this
    // permits email-enumeration. Reverting to a privacy-preserving 200
    // response is a one-line change.)
    if (!user) {
      return res.status(404).json({ error: 'Email does not exist.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save();
    sendPasswordResetEmail(user, token).catch(() => {});
    res.json({ ok: true, message: 'A reset link is on its way.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reset-password — { token, password }
 *
 * Verifies the token + expiry, sets the new password, clears the token so
 * it can't be reused. Returns a fresh JWT so the user is logged in
 * automatically.
 */
export async function resetPassword(req, res, next) {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    if (!token) return res.status(400).json({ error: 'token is required' });
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr, code: 'weak_password' });

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: 'Reset link is invalid or expired. Request a new one.' });

    user.password = password;          // pre-save hook re-hashes
    user.resetToken = '';
    user.resetTokenExpiresAt = null;
    await user.save();

    const jwtToken = signToken(user);
    let workspace = null;
    if (user.workspaceId) workspace = await Workspace.findById(user.workspaceId).catch(() => null);
    res.json({ token: jwtToken, user, workspace });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/auth/profile — update the authenticated user's profile.
 * Body: { name?, avatar? }   (avatar is a URL string)
 */
export async function updateProfile(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, avatar } = req.body || {};
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 80) {
        return res.status(400).json({ error: 'name must be 1–80 characters.' });
      }
      user.name = trimmed;
    }
    if (typeof avatar === 'string') {
      const trimmed = avatar.trim();
      if (trimmed && !/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('data:image/')) {
        return res.status(400).json({ error: 'avatar must be an http(s) URL or data:image/... base64.' });
      }
      // Cap data: URLs at 1MB-ish to stop Mongo blowing up.
      if (trimmed.startsWith('data:image/') && trimmed.length > 1_500_000) {
        return res.status(413).json({ error: 'Avatar image is too large (>1MB).' });
      }
      user.avatar = trimmed;
    }
    await user.save();
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
