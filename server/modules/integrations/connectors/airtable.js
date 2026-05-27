// Airtable connector. Requires a Personal Access Token (PAT) from
// https://airtable.com/create/tokens with `data.records:read` on the base.
//
// Credentials shape: { token: 'patXXX...', baseId: 'appXXX...', tableName: 'Sheet1' }

import axios from 'axios';

/**
 * @param {object} args
 * @param {string} args.token
 * @param {string} args.baseId
 * @param {string} args.tableName
 * @returns {Promise<Array<object>>}
 */
export async function fetchAirtable({ token, baseId, tableName }) {
  if (!token || !baseId || !tableName) {
    throw new Error('Airtable requires token, baseId, and tableName.');
  }
  const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`;
  const rows = [];
  let offset;
  // Page through up to 10× 100 rows = 1000 max. Plenty for analytics.
  for (let i = 0; i < 10; i++) {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params: offset ? { offset } : {},
      timeout: 15_000,
    });
    for (const r of (res.data?.records || [])) {
      rows.push(r.fields || {});
    }
    offset = res.data?.offset;
    if (!offset) break;
  }
  return rows;
}
