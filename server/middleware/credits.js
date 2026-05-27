import User from '../models/User.js';
import CreditEvent from '../models/CreditEvent.js';

/**
 * Middleware factory: deducts N credits from req.user, blocking the request
 * with 402 if the user has insufficient credits. Records an append-only
 * CreditEvent on every successful deduction so the user can audit their
 * own usage in Settings → Plan → Credit history.
 *
 * Free / unlimited plans skip deduction (plans with `credits: -1`).
 */
export function consumeCredits(cost = 1, action = 'AI usage') {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).populate('planId');
      if (!user) return res.status(401).json({ error: 'Unauthenticated' });

      const unlimited = user.planId?.credits === -1;
      if (unlimited) return next();

      const current = Number(user.credits) || 0;
      if (current < cost) {
        return res.status(402).json({
          error: `Not enough credits. You have ${current}, this action needs ${cost}.`,
          code: 'insufficient_credits',
          credits: current,
        });
      }
      user.credits = current - cost;
      await user.save();

      // Append-only audit. Logging failure doesn't roll back the deduction —
      // the user's balance is the source of truth; the ledger is reconciled.
      CreditEvent.create({
        userId: user._id,
        action,
        amount: -cost,
        balanceAfter: user.credits,
        refType: 'ai',
      }).catch((err) => console.warn('[creditEvent] AI usage log failed:', err?.message));

      res.set('X-Credits-Remaining', String(user.credits));
      next();
    } catch (err) {
      next(err);
    }
  };
}
