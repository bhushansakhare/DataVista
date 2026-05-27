import { getSystemSetting } from '../models/SystemSetting.js';
import { encryptSecret } from '../utils/crypto.js';

/** GET /api/admin/system-settings — superadmin only. */
export async function getSettings(_req, res, next) {
  try {
    const doc = await getSystemSetting();
    res.json({ settings: doc });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/system-settings — superadmin only.
 *
 * Body shape (every field optional; absent = unchanged):
 *   {
 *     smtp: {
 *       host?, port?, secure?, user?, pass?, fromEmail?, fromName?
 *     },
 *     oauth: {
 *       googleClientId?, googleClientSecret?,
 *       facebookAppId?, facebookAppSecret?
 *     }
 *   }
 *
 * Sending '' (empty string) clears that secret. Anything else is encrypted.
 */
export async function updateSettings(req, res, next) {
  try {
    const { smtp, oauth } = req.body || {};
    const doc = await getSystemSetting();

    if (smtp && typeof smtp === 'object') {
      if (typeof smtp.host === 'string')      doc.smtp.host = smtp.host.trim() ? encryptSecret(smtp.host.trim()) : '';
      if (typeof smtp.user === 'string')      doc.smtp.user = smtp.user.trim() ? encryptSecret(smtp.user.trim()) : '';
      if (typeof smtp.pass === 'string')      doc.smtp.pass = smtp.pass.trim() ? encryptSecret(smtp.pass.trim()) : '';
      if (Number.isFinite(Number(smtp.port))) doc.smtp.port = Number(smtp.port);
      if (typeof smtp.secure === 'boolean')   doc.smtp.secure = smtp.secure;
      if (typeof smtp.fromEmail === 'string') doc.smtp.fromEmail = smtp.fromEmail.trim();
      if (typeof smtp.fromName  === 'string') doc.smtp.fromName  = smtp.fromName.trim() || 'SheetFlow';
    }

    if (oauth && typeof oauth === 'object') {
      const setEnc = (key, val) => {
        if (typeof val === 'string') doc.oauth[key] = val.trim() ? encryptSecret(val.trim()) : '';
      };
      setEnc('googleClientId',     oauth.googleClientId);
      setEnc('googleClientSecret', oauth.googleClientSecret);
      setEnc('facebookAppId',      oauth.facebookAppId);
      setEnc('facebookAppSecret',  oauth.facebookAppSecret);
    }

    doc.updatedBy = req.user._id;
    await doc.save();
    res.json({ settings: doc });
  } catch (err) {
    next(err);
  }
}
