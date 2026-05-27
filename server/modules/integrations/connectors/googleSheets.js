// Google Sheets connector — uses the public CSV export endpoint, no OAuth.
// Sheet must be shared as "Anyone with the link → Viewer".
//
// For private sheets we'd need OAuth2 (separate Google Cloud project app +
// /auth/google route + token refresh). That's its own focused implementation;
// for now, public-sharing covers the common case.

import { fetchCsv, parseSheetUrl, parseCsv } from '../../../utils/sheetParser.js';

/**
 * @param {object} args
 * @param {string} args.sheetUrl
 * @returns {Promise<Array<object>>}
 */
export async function fetchGoogleSheets({ sheetUrl }) {
  if (typeof sheetUrl !== 'string' || !sheetUrl) {
    throw new Error('sheetUrl is required.');
  }
  const { sheetKey, gid } = parseSheetUrl(sheetUrl);
  const csv = await fetchCsv(sheetKey, gid);
  const { rows } = parseCsv(csv);
  return rows;
}
