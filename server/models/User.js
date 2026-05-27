import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'admin', 'user'], default: 'admin' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    avatar: { type: String, default: '' },
    // Per-user AI provider keys. Stored encrypted via utils/crypto.js
    // (AES-256-GCM, key derived from JWT_SECRET). Empty string = not set.
    aiKeys: {
      openai: { type: String, default: '' },
      claude: { type: String, default: '' },
    },
    // Password reset — token is a hex string; expires after 15 minutes.
    resetToken:          { type: String, default: '', index: true },
    resetTokenExpiresAt: { type: Date,   default: null },

    // ── Billing / Plans / Credits ────────────────────────────────────────
    planId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
    planExpiresAt:  { type: Date, default: null },         // null = perpetual / free plan
    credits:        { type: Number, default: 0 },          // consumed by AI calls etc.

    // ── Referrals ────────────────────────────────────────────────────────
    referralCode:   { type: String, default: '', index: true, unique: true, sparse: true },
    referredBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.compare = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function () {
  const o = this.toObject();
  delete o.password;
  // Never leak password-reset tokens.
  delete o.resetToken;
  delete o.resetTokenExpiresAt;
  // Never leak the encrypted API key blobs over the wire.
  if (o.aiKeys) {
    o.aiKeys = {
      hasOpenai: Boolean(o.aiKeys.openai),
      hasClaude: Boolean(o.aiKeys.claude),
    };
  }
  return o;
};

export default mongoose.model('User', userSchema);
