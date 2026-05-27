// OAuth routes — Google + Facebook via passport.
//
// CONFIGURATION:
//   1. Create OAuth apps in Google Cloud Console and Meta for Developers.
//   2. Set redirect URIs to `<your-server>/api/auth/google/callback` and
//      `<your-server>/api/auth/facebook/callback`.
//   3. Add to server/.env:
//        GOOGLE_CLIENT_ID=…
//        GOOGLE_CLIENT_SECRET=…
//        FACEBOOK_APP_ID=…
//        FACEBOOK_APP_SECRET=…
//   4. CLIENT_URL=<your-frontend-origin> (already used by CORS).
//
// When credentials are missing, the routes return a clear 503 with a
// developer-facing message — the buttons in the UI still appear and clicks
// surface the configuration step rather than a server crash.

import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { getSystemSetting } from '../models/SystemSetting.js';
import { decryptSecret } from '../utils/crypto.js';
import { sendWelcomeEmail } from '../utils/mailer.js';
import { generateReferralCode, provisionDefaultPlan } from '../controllers/planController.js';

const r = Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Find a user by email or create one. OAuth users get a random unguessable
 * password (they'll never use it — they log in via the provider) so the
 * existing email/password endpoints remain consistent.
 */
async function findOrCreateUserFromProfile({ email, name, avatar }) {
  if (!email) {
    const e = new Error('OAuth provider did not return an email.');
    e.status = 400;
    throw e;
  }
  const lowered = email.toLowerCase();
  let user = await User.findOne({ email: lowered });
  if (user) {
    // Returning user — patch missing display fields from the OAuth profile.
    if (!user.avatar && avatar) user.avatar = avatar;
    if (user.name === 'User' && name) user.name = name;
    await user.save();
    return { user, isNew: false };
  }
  // New user — generate a 32-byte random password (never used; OAuth users
  // sign in via the provider). User model's pre-save hook hashes it.
  const password = crypto.randomBytes(32).toString('hex');
  const userCount = await User.countDocuments();
  const role = userCount === 0 ? 'superadmin' : 'admin';
  user = await User.create({
    name: name || lowered.split('@')[0] || 'User',
    email: lowered,
    password,
    avatar: avatar || '',
    role,
    referralCode: await generateReferralCode(name, lowered),
  });
  const ws = await Workspace.create({
    name: `${user.name}'s workspace`,
    ownerId: user._id,
  });
  user.workspaceId = ws._id;
  await user.save();
  // Free plan + signup credits.
  await provisionDefaultPlan(user);
  return { user, isNew: true };
}

function signJwt(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

function redirectWithToken(res, user) {
  const token = signJwt(user);
  res.redirect(`${CLIENT_URL}/oauth-success?token=${encodeURIComponent(token)}`);
}

function redirectWithError(res, code) {
  res.redirect(`${CLIENT_URL}/login?oauth_error=${encodeURIComponent(code)}`);
}

// ── Resolve OAuth credentials (DB → env fallback) at module load ───────
//
// DB-managed values come from SystemSetting (admin-edited via Settings UI).
// They take precedence over env vars. Strategies are registered ONCE at
// startup with the merged values, so changing creds in the UI requires a
// server restart — the UI flags this clearly.

let GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
let GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
let FACEBOOK_ID = process.env.FACEBOOK_APP_ID || '';
let FACEBOOK_SECRET = process.env.FACEBOOK_APP_SECRET || '';

try {
  const doc = await getSystemSetting();
  const ce = (v) => (v ? decryptSecret(v) : '');
  GOOGLE_ID       = ce(doc.oauth?.googleClientId)     || GOOGLE_ID;
  GOOGLE_SECRET   = ce(doc.oauth?.googleClientSecret) || GOOGLE_SECRET;
  FACEBOOK_ID     = ce(doc.oauth?.facebookAppId)      || FACEBOOK_ID;
  FACEBOOK_SECRET = ce(doc.oauth?.facebookAppSecret)  || FACEBOOK_SECRET;
} catch (err) {
  console.warn('[oauth] could not load DB system settings — using env vars only:', err?.message);
}

// ── Google ──────────────────────────────────────────────────────────────

const GOOGLE_CONFIGURED = Boolean(GOOGLE_ID && GOOGLE_SECRET);

if (GOOGLE_CONFIGURED) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_ID,
      clientSecret: GOOGLE_SECRET,

      // IMPORTANT:
      // Localhost + Production dono support karega
      callbackURL:
        process.env.CLIENT_URL === 'https://sheet.localbhai.com'
          ? 'https://sheet.localbhai.com/api/auth/google/callback'
          : 'http://localhost:5000/api/auth/google/callback',
    },

    async (_accessToken, _refreshToken, profile, done) => {
      try {

        const { user, isNew } = await findOrCreateUserFromProfile({
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
        });

        // Welcome email only for new users
        if (isNew) {
          sendWelcomeEmail(user).catch(() => {});
        }

        done(null, user);

      } catch (err) {
        done(err);
      }
    }
  ));

  // Start Google Login
  r.get(
    '/google',
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
    })
  );

  // Google Callback
  r.get(
    '/google/callback',
    (req, res, next) =>
      passport.authenticate(
        'google',
        { session: false },
        (err, user) => {

          if (err || !user) {
            return redirectWithError(
              res,
              err?.message || 'google_failed'
            );
          }

          try {
            redirectWithToken(res, user);
          } catch (e) {
            redirectWithError(res, e.message);
          }
        }
      )(req, res, next)
  );

} else {

  r.get('/google', (_req, res) =>
    res.status(503).json({
      error:
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      code: 'oauth_not_configured',
    })
  );

}

// ── Facebook ────────────────────────────────────────────────────────────

const FACEBOOK_CONFIGURED = Boolean(FACEBOOK_ID && FACEBOOK_SECRET);

if (FACEBOOK_CONFIGURED) {
  passport.use(new FacebookStrategy(
    {
      clientID: FACEBOOK_ID,
      clientSecret: FACEBOOK_SECRET,
      callbackURL: '/api/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'emails', 'photos'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const { user, isNew } = await findOrCreateUserFromProfile({
          email: profile.emails?.[0]?.value,
          name:  profile.displayName,
          avatar: profile.photos?.[0]?.value,
        });
        if (isNew) sendWelcomeEmail(user).catch(() => {});
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  ));

  r.get('/facebook',
    passport.authenticate('facebook', { scope: ['email'], session: false }));

  r.get('/facebook/callback',
    (req, res, next) => passport.authenticate('facebook', { session: false }, (err, user) => {
      if (err || !user) return redirectWithError(res, err?.message || 'facebook_failed');
      try { redirectWithToken(res, user); }
      catch (e) { redirectWithError(res, e.message); }
    })(req, res, next));
} else {
  r.get('/facebook', (_req, res) => res.status(503).json({
    error: 'Facebook OAuth is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in server/.env.',
    code: 'oauth_not_configured',
  }));
}

// ── Health probe — lets the client decide which buttons to show ────────

r.get('/providers', (_req, res) => {
  res.json({
    google: GOOGLE_CONFIGURED,
    facebook: FACEBOOK_CONFIGURED,
  });
});

export default r;
