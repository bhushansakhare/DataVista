// Connector dispatcher. Given an integration type + decrypted credentials,
// returns the rows array. All connectors share the same return shape:
// `Array<object>` ready to drop into the existing dashboard pipeline.

import { fetchRestApi }       from './restApi.js';
import { fetchGoogleSheets }  from './googleSheets.js';
import { fetchAirtable }      from './airtable.js';
import { fetchNotion }        from './notion.js';
import { fetchPostgres }      from './postgres.js';

export const CONNECTOR_TYPES = ['rest_api', 'google_sheets', 'airtable', 'notion', 'postgres'];

/**
 * @param {string} type
 * @param {object} creds — decrypted credentials object
 * @returns {Promise<Array<object>>}
 */
export async function runConnector(type, creds) {
  switch (type) {
    case 'rest_api':      return fetchRestApi(creds);
    case 'google_sheets': return fetchGoogleSheets(creds);
    case 'airtable':      return fetchAirtable(creds);
    case 'notion':        return fetchNotion(creds);
    case 'postgres':      return fetchPostgres(creds);
    default: {
      const e = new Error(`Unknown integration type: ${type}`);
      e.code = 'unknown_connector';
      throw e;
    }
  }
}

/**
 * Minimum required fields per connector — used by the controller to validate
 * the `credentials` body before persisting. Lets us surface a clear 400 rather
 * than failing later at fetch time.
 */
export const CONNECTOR_REQUIREMENTS = {
  rest_api:      ['url'],
  google_sheets: ['sheetUrl'],
  airtable:      ['token', 'baseId', 'tableName'],
  notion:        ['token', 'databaseId'],
  postgres:      ['connectionString', 'query'],
};
