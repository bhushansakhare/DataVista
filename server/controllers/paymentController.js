import crypto from 'crypto';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Invoice from '../models/Invoice.js';
import { logCreditEvent } from './planController.js';
import { sendPaymentSuccessEmail } from '../utils/mailer.js';

// ──────────────────────────────────────────────────────────────────────
// Payment placeholder.
//
// We do NOT integrate a real provider here. The two endpoints below are
// the contract any real provider (Stripe Checkout, Razorpay Order, Paddle,
// etc.) will fit into:
//
//   1. `initiate` — server-side prepares an intent + returns a "redirect
//      target". Today that's a fake order id; tomorrow it's a Stripe
//      Session URL.
//   2. `confirm` — server-side flips the user's plan to active. Today
//      this is called directly from the client after the simulated
//      gateway "succeeds"; tomorrow it's called from the provider's
//      webhook with a verified signature.
//
// This split keeps the rest of the app (frontend flow, plan assignment,
// credit grant, email) provider-agnostic.
// ──────────────────────────────────────────────────────────────────────

const PROVIDER = process.env.PAYMENT_PROVIDER || 'simulated';

function periodToExpiry(period) {
  if (period === 'one_time') return null;
  const days = period === 'year' ? 365 : 30;
  return new Date(Date.now() + days * 86400000);
}

/**
 * POST /api/payments/initiate — body: { planId }
 * Validates the plan and returns a payment intent. For the simulated
 * provider the `orderId` is just a random id the client echoes back to
 * /confirm; the real flow returns a provider checkout URL instead.
 */
export async function initiatePayment(req, res, next) {
  try {
    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'planId is required' });

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isPublic) return res.status(404).json({ error: 'Plan not found' });

    // Free plans skip the gateway entirely — caller should call /confirm
    // directly. Returning a hint makes that decision explicit on the wire.
    if (plan.price === 0) {
      return res.json({
        orderId: `free-${crypto.randomBytes(8).toString('hex')}`,
        amount: 0,
        currency: plan.currency,
        provider: PROVIDER,
        skipGateway: true,
        plan,
      });
    }

    const orderId = `${PROVIDER}-${crypto.randomBytes(12).toString('hex')}`;
    res.json({
      orderId,
      amount: plan.price,
      currency: plan.currency,
      provider: PROVIDER,
      // In a real integration this would be a Stripe Checkout URL or a
      // Razorpay order_id passed to their JS SDK. For the simulated
      // provider we send the client back to /checkout to confirm.
      skipGateway: PROVIDER === 'simulated',
      plan,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/confirm — body: { planId, orderId? }
 *
 * In production this becomes the provider webhook handler that runs
 * AFTER the gateway has charged the card. The body would be the verified
 * webhook payload instead of trusted client data.
 *
 * Effects on success:
 *   • assigns plan to the user
 *   • grants the plan's credits
 *   • sets planExpiresAt by period
 *   • sends payment-success email
 */
export async function confirmPayment(req, res, next) {
  try {
    const { planId, orderId } = req.body || {};
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isPublic) return res.status(404).json({ error: 'Plan not found' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.planId = plan._id;
    // Plans with `credits: -1` are unlimited — don't accumulate, just keep
    // a marker value so the AI middleware can short-circuit.
    const grant = plan.credits === -1 ? 0 : (plan.credits || 0);
    if (plan.credits === -1) {
      user.credits = 0;
    } else {
      user.credits = (user.credits || 0) + grant;
    }
    user.planExpiresAt = periodToExpiry(plan.period);
    await user.save();

    // Snapshot the purchase as an invoice — plan name/price are stored on
    // the row so future plan edits don't rewrite history.
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const invoice = await Invoice.create({
      invoiceNumber,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      planId: plan._id,
      planName: plan.name,
      period: plan.period,
      amount: plan.price || 0,
      currency: plan.currency || 'USD',
      creditsAdded: plan.credits,
      expiresAt: user.planExpiresAt,
      status: 'paid',
      provider: PROVIDER,
      orderId: orderId || '',
    });

    if (grant > 0) {
      await logCreditEvent({
        userId: user._id,
        action: `Plan purchase — ${plan.name}`,
        amount: grant,
        balanceAfter: user.credits,
        refType: 'plan',
        refId: plan._id,
        note: invoiceNumber,
      });
    }

    sendPaymentSuccessEmail(user, plan, user.planExpiresAt).catch(() => {});

    res.json({
      ok: true,
      user,
      plan,
      credits: user.credits,
      planExpiresAt: user.planExpiresAt,
      invoice,
    });
  } catch (err) {
    next(err);
  }
}
