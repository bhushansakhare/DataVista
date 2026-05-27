import mongoose from 'mongoose';

// Singleton document — one row in the collection holds all system-wide
// admin-managed configuration (SMTP, OAuth client secrets). Values are
// AES-256-GCM encrypted blobs via utils/crypto.js. Booleans on the wire
// (hasSmtp, etc.) — plaintext never leaves the server.

const systemSettingSchema = new mongoose.Schema(
  {
    // SMTP / email — mailer reads these fresh on each send (no restart).
    smtp: {
      host:      { type: String, default: '' },       // encrypted
      port:      { type: Number, default: 587 },
      secure:    { type: Boolean, default: false },   // true for 465, false for 587
      user:      { type: String, default: '' },       // encrypted
      pass:      { type: String, default: '' },       // encrypted
      fromEmail: { type: String, default: '' },       // cleartext (display)
      fromName:  { type: String, default: 'SheetFlow' },
    },
    // OAuth client credentials. Read at server startup (merged with env);
    // admin must restart the server after changing these.
    oauth: {
      googleClientId:     { type: String, default: '' }, // encrypted
      googleClientSecret: { type: String, default: '' }, // encrypted
      facebookAppId:      { type: String, default: '' }, // encrypted
      facebookAppSecret:  { type: String, default: '' }, // encrypted
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

systemSettingSchema.methods.toJSON = function () {
  // Don't leak encrypted blobs. Surface booleans + cleartext display values.
  const o = this.toObject();
  return {
    _id: o._id,
    smtp: {
      hasHost:    Boolean(o.smtp?.host),
      hasUser:    Boolean(o.smtp?.user),
      hasPass:    Boolean(o.smtp?.pass),
      port:       o.smtp?.port,
      secure:     o.smtp?.secure,
      fromEmail:  o.smtp?.fromEmail || '',
      fromName:   o.smtp?.fromName  || '',
    },
    oauth: {
      hasGoogle:   Boolean(o.oauth?.googleClientId && o.oauth?.googleClientSecret),
      hasFacebook: Boolean(o.oauth?.facebookAppId  && o.oauth?.facebookAppSecret),
    },
    updatedAt: o.updatedAt,
    updatedBy: o.updatedBy,
  };
};

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

/** Always return the singleton — creates it on first call. */
export async function getSystemSetting() {
  let doc = await SystemSetting.findOne();
  if (!doc) doc = await SystemSetting.create({});
  return doc;
}

export default SystemSetting;
