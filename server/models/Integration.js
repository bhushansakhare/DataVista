import mongoose from 'mongoose';

// External data source connection. Credentials are encrypted at rest via
// utils/crypto.js (AES-256-GCM, key derived from JWT_SECRET).
const integrationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: {
      type: String,
      enum: ['rest_api', 'google_sheets', 'airtable', 'notion', 'postgres'],
      required: true,
    },
    name: { type: String, required: true, trim: true },

    // Encrypted credentials blob (AES-256-GCM ciphertext from utils/crypto).
    // Shape varies by connector — JSON-stringified before encryption.
    credentials: { type: String, default: '' },

    // Non-sensitive config kept in cleartext so the list endpoint can render
    // useful labels without decrypting.
    config: { type: Object, default: {} },

    lastSyncAt:   { type: Date, default: null },
    lastSyncRows: { type: Number, default: 0 },
    lastError:    { type: String, default: '' },
  },
  { timestamps: true }
);

integrationSchema.methods.toJSON = function () {
  const o = this.toObject();
  // Never leak the encrypted credentials blob over the wire.
  delete o.credentials;
  return o;
};

export default mongoose.model('Integration', integrationSchema);
