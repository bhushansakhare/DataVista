import User from '../models/User.js';
import { generateReferralCode } from '../controllers/planController.js';

/**
 * Idempotent backfill: every user must have a referralCode. Runs once at
 * server boot, scans for users where the code is missing or empty, and
 * assigns a fresh unique NAME-1234 code. Logs the count so the operator
 * can verify on the first deploy and ignore the no-op on subsequent boots.
 *
 * Safe to call repeatedly — only touches rows that need it. Failure of
 * a single row is logged and skipped, never aborting the whole job (so
 * one weird record can't block server start).
 */
export async function backfillReferralCodes() {
  try {
    const cursor = User.find(
      { $or: [{ referralCode: { $exists: false } }, { referralCode: '' }, { referralCode: null }] },
      { _id: 1, name: 1, email: 1 },
    ).cursor();

    let scanned = 0;
    let assigned = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      scanned += 1;
      try {
        const code = await generateReferralCode(doc.name, doc.email);
        await User.updateOne({ _id: doc._id }, { $set: { referralCode: code } });
        assigned += 1;
      } catch (err) {
        console.warn(`[migrate] referralCode for ${doc.email} failed:`, err?.message);
      }
    }
    if (scanned > 0) {
      console.log(`[migrate] referralCode backfill: scanned=${scanned} assigned=${assigned}`);
    }
  } catch (err) {
    console.warn('[migrate] referralCode backfill failed at the cursor level:', err?.message);
  }
}
