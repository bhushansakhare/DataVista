import Plan from '../models/Plan.js';
import User from '../models/User.js';
import Referral from '../models/Referral.js';
import CreditEvent from '../models/CreditEvent.js';
import crypto from 'crypto';

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** GET /api/plans — public list (only `isPublic` plans). No auth required. */
export async function listPublicPlans(_req, res, next) {
  try {
    const plans = await Plan.find({ isPublic: true }).sort({ sortOrder: 1, price: 1 });
    res.json({ plans });
  } catch (err) { next(err); }
}

/** GET /api/admin/plans — all plans including private/internal. */
export async function listAllPlans(_req, res, next) {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1, price: 1 });
    res.json({ plans });
  } catch (err) { next(err); }
}

/** POST /api/admin/plans — create a plan. */
export async function createPlan(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'name is required' });
    const slug = body.slug || slugify(body.name);
    const exists = await Plan.findOne({ $or: [{ name: body.name }, { slug }] });
    if (exists) return res.status(409).json({ error: 'A plan with that name/slug already exists.' });

    // If this plan is being set as default, unset any other defaults.
    if (body.isDefault) await Plan.updateMany({ isDefault: true }, { isDefault: false });

    const plan = await Plan.create({
      name: body.name.trim(),
      slug,
      price: Number(body.price) || 0,
      currency: (body.currency || 'USD').toUpperCase(),
      period: ['month', 'year', 'one_time'].includes(body.period) ? body.period : 'month',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      features: Array.isArray(body.features) ? body.features.map(String) : [],
      credits: Number(body.credits) || 0,
      dashboardLimit: Number(body.dashboardLimit) || 0,
      isPublic: body.isPublic !== false,
      isDefault: Boolean(body.isDefault),
      sortOrder: Number(body.sortOrder) || 0,
    });
    res.status(201).json({ plan });
  } catch (err) { next(err); }
}

/** PATCH /api/admin/plans/:id — update a plan. */
export async function updatePlan(req, res, next) {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    const body = req.body || {};

    if (typeof body.name === 'string' && body.name.trim()) plan.name = body.name.trim();
    if (typeof body.slug === 'string' && body.slug.trim()) plan.slug = slugify(body.slug);
    if (typeof body.description === 'string')              plan.description = body.description.trim();
    if (Array.isArray(body.features))                      plan.features = body.features.map(String);
    if (Number.isFinite(Number(body.price)))               plan.price = Number(body.price);
    if (typeof body.currency === 'string')                 plan.currency = body.currency.toUpperCase();
    if (['month', 'year', 'one_time'].includes(body.period)) plan.period = body.period;
    if (Number.isFinite(Number(body.credits)))             plan.credits = Number(body.credits);
    if (Number.isFinite(Number(body.dashboardLimit)))      plan.dashboardLimit = Number(body.dashboardLimit);
    if (typeof body.isPublic === 'boolean')                plan.isPublic = body.isPublic;
    if (Number.isFinite(Number(body.sortOrder)))           plan.sortOrder = Number(body.sortOrder);

    // Only one default plan.
    if (body.isDefault === true) {
      await Plan.updateMany({ _id: { $ne: plan._id }, isDefault: true }, { isDefault: false });
      plan.isDefault = true;
    } else if (body.isDefault === false) {
      plan.isDefault = false;
    }

    await plan.save();
    res.json({ plan });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/plans/:id — remove a plan. Users on it keep planId until reassigned. */
export async function deletePlan(req, res, next) {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── User-facing plan operations ────────────────────────────────────────────

/** GET /api/me/plan — current plan + credits + expiry for the signed-in user. */
export async function getMyPlan(req, res, next) {
  try {
    const user = await User.findById(req.user._id).populate('planId');
    const referrals = await Referral.countDocuments({ referrerId: req.user._id });
    const expiresAt = user?.planExpiresAt || null;
    const daysRemaining = expiresAt
      ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
      : null;
    // Referral code expires 30 days after signup — surface this so the UI
    // can warn before the link silently stops working.
    const codeExpiresAt = user?.createdAt
      ? new Date(user.createdAt.getTime() + REFERRAL_TTL_MS)
      : null;
    res.json({
      plan: user?.planId || null,
      credits: user?.credits || 0,
      planExpiresAt: expiresAt,
      daysRemaining,
      referralCode: user?.referralCode || '',
      referralCount: referrals,
      referralCodeExpiresAt: codeExpiresAt,
      referralCodeExpired: codeExpiresAt ? codeExpiresAt.getTime() < Date.now() : false,
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/me/plan/select — assign a public plan to the current user.
 *
 * NOTE: this is the *plan assignment* half. The *payment* half (charge the
 * user, then call this on webhook success) is deferred — see roadmap. For
 * paid plans this currently just assigns; production must gate this behind
 * a real payment confirmation.
 */
export async function selectMyPlan(req, res, next) {
  try {
    const { planId } = req.body || {};
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isPublic) return res.status(404).json({ error: 'Plan not found' });

    const user = await User.findById(req.user._id);
    user.planId = plan._id;
    const grant = plan.credits === -1 ? 0 : (plan.credits || 0);
    user.credits = (user.credits || 0) + grant;
    user.planExpiresAt = plan.period === 'one_time' ? null
      : new Date(Date.now() + (plan.period === 'year' ? 365 : 30) * 86400000);
    await user.save();

    if (grant > 0) {
      await logCreditEvent({
        userId: user._id,
        action: `Plan selected — ${plan.name}`,
        amount: grant,
        balanceAfter: user.credits,
        refType: 'plan',
        refId: plan._id,
      });
    }

    res.json({
      plan,
      credits: user.credits,
      planExpiresAt: user.planExpiresAt,
    });
  } catch (err) { next(err); }
}

/**
 * GET /api/plans/me/credit-history — paginated ledger for the signed-in
 * user. Also returns rolled-up totals so the UI can show "credits used"
 * without a second query.
 *
 * Query: ?limit=20 (max 100)
 */
export async function getMyCreditHistory(req, res, next) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const events = await CreditEvent.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const totalsAgg = await CreditEvent.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          earned:   { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          consumed: { $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] } },
        },
      },
    ]);
    const earned   = totalsAgg[0]?.earned   || 0;
    const consumed = Math.abs(totalsAgg[0]?.consumed || 0);

    res.json({ events, totals: { earned, used: consumed } });
  } catch (err) { next(err); }
}

// ── Referrals + new-user provisioning helpers (used by authController) ────

// Referral code format: NAME-XXXX — up to 7 uppercase letters from the
// user's name (alphabetic only), a dash, then a 4-char uppercase hex
// suffix (16^4 = 65,536 combinations per prefix). Falls back to the
// email local-part or 'USER' when the name has no letters.
//
// Example: BHUSHAN-9A3F.
function basePrefix(name = '', email = '') {
  const fromName = String(name || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (fromName.length >= 2) return fromName.slice(0, 7);
  const fromEmail = String(email || '').split('@')[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (fromEmail.length >= 2) return fromEmail.slice(0, 7);
  return 'USER';
}

/**
 * Generate a unique referral code in the form NAME-XXXX. Pure compute — the
 * uniqueness check runs in a small retry loop (User.referralCode is a
 * sparse unique index, so collisions throw on save; we pre-check to give
 * the caller a guaranteed-free code).
 *
 * Synchronous variant (no DB) is exported as `generateReferralCodeSync` for
 * tests and callers who'll handle uniqueness themselves.
 */
export function generateReferralCodeSync(name = '', email = '') {
  const prefix = basePrefix(name, email);
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars
  return `${prefix}-${suffix}`;
}

export async function generateReferralCode(name = '', email = '') {
  for (let i = 0; i < 12; i++) {
    const candidate = generateReferralCodeSync(name, email);
    // eslint-disable-next-line no-await-in-loop
    const taken = await User.exists({ referralCode: candidate });
    if (!taken) return candidate;
  }
  // Astronomically unlikely — fall through with a longer random suffix to
  // guarantee termination without locking up the request.
  return `${basePrefix(name, email)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * POST /api/plans/me/regenerate-code — invalidate the user's current
 * referral code and issue a fresh one. Useful when a code has expired or
 * the user wants to revoke a link they've already shared.
 *
 * Pending Referral rows for the OLD code are NOT touched — they were valid
 * at redemption time and remain part of the audit log.
 */
export async function regenerateMyReferralCode(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const fresh = await generateReferralCode(user.name, user.email);
    user.referralCode = fresh;
    await user.save();
    res.json({ referralCode: fresh });
  } catch (err) { next(err); }
}

/** GET /api/plans/me/referrals — people who've redeemed the user's code. */
export async function getMyReferrals(req, res, next) {
  try {
    const list = await Referral.find({ referrerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('referredUserId', 'name email createdAt')
      .lean();
    const earned = list.reduce((s, r) => s + (r.creditsGiven || 0), 0);
    res.json({ referrals: list, totalEarned: earned });
  } catch (err) { next(err); }
}

/**
 * Append a credit-ledger row. Pure side-effect — never throws into the
 * caller, since a logging miss must not break the underlying business
 * operation (credits already moved; we just couldn't write the audit row).
 */
export async function logCreditEvent({ userId, action, amount, balanceAfter, refType, refId, note }) {
  try {
    await CreditEvent.create({
      userId,
      action,
      amount,
      balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : null,
      refType: refType || 'other',
      refId: refId ? String(refId) : '',
      note: note || '',
    });
  } catch (err) {
    console.warn('[creditEvent] log failed:', err?.message);
  }
}

// Referral codes are valid for 30 days after the referrer's signup.
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFERRAL_BONUS = 10;

/**
 * Apply a referral code at signup. Resolves the referrer, creates a Referral
 * record, awards bonus credits to BOTH users.
 *
 * THROWS structured errors so the caller can surface a 400 — never silently
 * swallows. The error has a `code` (referral_invalid | referral_expired |
 * referral_already_used | referral_self) and a friendly `message`.
 *
 * No-op (returns null) only when no code is supplied — that's an optional
 * field at signup, not an error.
 *
 * @param {object} newUser  — already-created User doc (Mongoose)
 * @param {string} code     — referral code typed at signup
 * @returns {object|null}   — created Referral row, or null when no code given
 */
export async function applyReferralBonus(newUser, code) {
  if (!code || typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();

  const referrer = await User.findOne({ referralCode: normalized });
  if (!referrer) {
    const err = new Error('That referral code does not exist.');
    err.code = 'referral_invalid';
    err.status = 400;
    throw err;
  }
  if (String(referrer._id) === String(newUser._id)) {
    const err = new Error('You cannot refer yourself.');
    err.code = 'referral_self';
    err.status = 400;
    throw err;
  }

  // Codes expire 30 days after the referrer's signup.
  const expiresAt = new Date((referrer.createdAt?.getTime() || Date.now()) + REFERRAL_TTL_MS);
  if (expiresAt.getTime() < Date.now()) {
    const err = new Error('This referral code has expired.');
    err.code = 'referral_expired';
    err.status = 400;
    throw err;
  }

  // One referral per new user — the unique index on referredUserId will
  // enforce this at write time too, but we check first to give a clean error.
  const existing = await Referral.findOne({ referredUserId: newUser._id });
  if (existing) {
    const err = new Error('You have already used a referral code.');
    err.code = 'referral_already_used';
    err.status = 400;
    throw err;
  }

  newUser.credits = (newUser.credits || 0) + REFERRAL_BONUS;
  newUser.referredBy = referrer._id;
  await newUser.save();

  referrer.credits = (referrer.credits || 0) + REFERRAL_BONUS;
  await referrer.save();

  const row = await Referral.create({
    referrerId: referrer._id,
    referredUserId: newUser._id,
    referralCode: normalized,
    creditsGiven: REFERRAL_BONUS,
    usedAt: new Date(),
    expiresAt,
  });

  await Promise.all([
    logCreditEvent({
      userId: newUser._id,
      action: 'Referral bonus (signed up with code)',
      amount: REFERRAL_BONUS,
      balanceAfter: newUser.credits,
      refType: 'referral',
      refId: row._id,
    }),
    logCreditEvent({
      userId: referrer._id,
      action: `Referral bonus (${newUser.name || 'a friend'} joined)`,
      amount: REFERRAL_BONUS,
      balanceAfter: referrer.credits,
      refType: 'referral',
      refId: row._id,
    }),
  ]);

  return { referrer, row };
}

/**
 * Assign the default plan + free credits to a brand-new user. Called from
 * register and from OAuth findOrCreate. Idempotent.
 */
export async function provisionDefaultPlan(user) {
  if (user.planId) return user;
  const def = await Plan.findOne({ isDefault: true });
  if (def) {
    user.planId = def._id;
    const grant = def.credits === -1 ? 0 : (def.credits || 0);
    user.credits = (user.credits || 0) + grant;
    user.planExpiresAt = def.period === 'one_time' ? null
      : new Date(Date.now() + (def.period === 'year' ? 365 : 30) * 86400000);
    await user.save();
    if (grant > 0) {
      await logCreditEvent({
        userId: user._id,
        action: `Signup bonus — ${def.name} plan`,
        amount: grant,
        balanceAfter: user.credits,
        refType: 'plan',
        refId: def._id,
      });
    }
  }
  return user;
}
