import mongoose from 'mongoose';

// One invoice per successful payment. We snapshot the plan name/price at
// purchase time so future plan edits don't rewrite history.
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName:      { type: String, default: '' },
    userEmail:     { type: String, default: '' },
    planId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
    planName:      { type: String, default: '' },
    period:        { type: String, default: '' },
    amount:        { type: Number, required: true },
    currency:      { type: String, default: 'USD' },
    creditsAdded: { type: Number, default: 0 },
    expiresAt:     { type: Date,   default: null },
    status:        { type: String, enum: ['paid', 'refunded', 'failed'], default: 'paid' },
    provider:      { type: String, default: 'simulated' },
    orderId:       { type: String, default: '' },
  },
  { timestamps: true }
);

invoiceSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Invoice', invoiceSchema);
