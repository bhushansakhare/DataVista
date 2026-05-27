import mongoose from 'mongoose';

// One row per referred signup. Both sides receive a credit bonus, recorded
// here for audit / fraud review. `expiresAt` is the deadline by which the
// referrer's code could be redeemed (30 days after their signup) — captured
// at redemption so the audit row stands on its own.
const referralSchema = new mongoose.Schema(
  {
    referrerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    referralCode:   { type: String, required: true, index: true },
    creditsGiven:   { type: Number, default: 10 },
    usedAt:         { type: Date,   default: () => new Date() },
    expiresAt:      { type: Date,   default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Referral', referralSchema);
