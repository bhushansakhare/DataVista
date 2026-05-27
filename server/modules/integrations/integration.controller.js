import Integration from '../../models/Integration.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import { runConnector, CONNECTOR_TYPES, CONNECTOR_REQUIREMENTS } from './connectors/index.js';

function validateRequirements(type, credentials) {
  const required = CONNECTOR_REQUIREMENTS[type] || [];
  const missing = required.filter((k) => {
    const v = credentials?.[k];
    return typeof v !== 'string' || !v.trim();
  });
  return missing;
}

/** POST /api/integrations/connect — { type, name, credentials, config? } */
export async function connect(req, res, next) {
  try {
    const { type, name, credentials, config } = req.body || {};
    if (!CONNECTOR_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${CONNECTOR_TYPES.join(', ')}.` });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }
    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({ error: 'credentials object is required.' });
    }
    const missing = validateRequirements(type, credentials);
    if (missing.length) {
      return res.status(400).json({ error: `Missing credentials field(s): ${missing.join(', ')}.` });
    }

    const integration = await Integration.create({
      workspaceId: req.user.workspaceId,
      ownerId: req.user._id,
      type,
      name: name.trim(),
      credentials: encryptSecret(JSON.stringify(credentials)),
      config: config && typeof config === 'object' ? config : {},
    });
    res.status(201).json({ integration });
  } catch (err) {
    next(err);
  }
}

/** GET /api/integrations — list all integrations for the user's workspace */
export async function list(req, res, next) {
  try {
    const items = await Integration.find({ workspaceId: req.user.workspaceId })
      .sort({ createdAt: -1 });
    res.json({ integrations: items });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/integrations/:id — remove an integration */
export async function remove(req, res, next) {
  try {
    const integration = await Integration.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.user.workspaceId,
    });
    if (!integration) return res.status(404).json({ error: 'Integration not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/integrations/:id/fetch-data — run the connector and return rows.
 * Strict ownership check enforced via the workspaceId filter on the lookup.
 */
export async function fetchData(req, res, next) {
  try {
    const integration = await Integration.findOne({
      _id: req.params.id,
      workspaceId: req.user.workspaceId,
    });
    if (!integration) return res.status(404).json({ error: 'Integration not found.' });

    let creds;
    try {
      const decrypted = decryptSecret(integration.credentials);
      creds = JSON.parse(decrypted || '{}');
    } catch {
      return res.status(500).json({ error: 'Could not decrypt credentials. Re-create the integration.' });
    }

    try {
      const rows = await runConnector(integration.type, creds);
      integration.lastSyncAt = new Date();
      integration.lastSyncRows = Array.isArray(rows) ? rows.length : 0;
      integration.lastError = '';
      await integration.save();

      // Surface column names for the client to render a preview header.
      const columns = rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]) : [];
      res.json({
        integration,
        rows,
        columns,
        rowCount: rows.length,
      });
    } catch (err) {
      integration.lastError = err?.message?.slice(0, 500) || 'Unknown connector error';
      await integration.save();
      const status = err?.code === 'connector_disabled' ? 501 : 502;
      return res.status(status).json({
        error: integration.lastError,
        code: err?.code,
      });
    }
  } catch (err) {
    next(err);
  }
}
