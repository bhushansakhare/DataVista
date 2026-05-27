import mongoose from 'mongoose';

// Append-only ledger of credit changes. Every grant (signup bonus, referral
// bonus, plan purchase) and every consumption (AI dashboard generation,
// premium feature) writes a row here. We never edit or delete rows — the
// running balance is reconstructed by replaying events in createdAt order
// and matches `User.credits`.
//
// `balanceAfter` is denormalised so the Settings UI can render history
// without a per-row recomputation, and so an out-of-band reconciliation
// can verify the ledger against `User.credits`.
const creditEventSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action:       { type: String, required: true, trim: true },
    // Signed delta. Positive = grant, negative = consumption.
    amount:       { type: Number, required: true },
    balanceAfter: { type: Number, default: null },
    // Loose link to the source row. `refType` is one of:
    //   'plan' | 'referral' | 'ai' | 'signup' | 'admin' | 'other'
    // `refId` is the related document id (Plan, Referral, etc.) — kept as a
    // string so we don't fight Mongoose ref resolution.
    refType:      { type: String, default: 'other' },
    refId:        { type: String, default: '' },
    note:         { type: String, default: '' },
  },
  { timestamps: true }
);

creditEventSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('CreditEvent', creditEventSchema);
