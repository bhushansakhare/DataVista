// REST API connector — fully implemented.
// Accepts a URL + optional headers, fetches JSON, normalises to array of objects.

import axios from 'axios';

/**
 * @param {object} args
 * @param {string} args.url
 * @param {object} [args.headers]      — extra request headers (Authorization, etc.)
 * @param {string} [args.arrayPath]    — dot-path to the array inside the response, e.g. "data.items"
 * @returns {Promise<Array<object>>}
 */
export async function fetchRestApi({ url, headers, arrayPath }) {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('A valid http(s) URL is required.');
  }
  const res = await axios.get(url, {
    headers: headers || {},
    timeout: 15_000,
    maxRedirects: 3,
    validateStatus: (s) => s >= 200 && s < 400,
  });
  let body = res.data;

  // If the user told us where the array lives, follow that path.
  if (arrayPath && typeof body === 'object' && body) {
    body = arrayPath.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), body);
  }

  // Auto-detect the array if not pointed at one. Common shapes:
  //   - top-level array      → use as-is
  //   - { data: [...] }      → take data
  //   - { results: [...] }   → take results
  //   - { items: [...] }     → take items
  if (!Array.isArray(body) && body && typeof body === 'object') {
    for (const k of ['data', 'results', 'items', 'records', 'rows']) {
      if (Array.isArray(body[k])) { body = body[k]; break; }
    }
    if (!Array.isArray(body)) {
      // Final fallback: if any top-level value is an array, take the first.
      const firstArrayKey = Object.keys(body).find((k) => Array.isArray(body[k]));
      if (firstArrayKey) body = body[firstArrayKey];
    }
  }

  if (!Array.isArray(body)) {
    throw new Error('Response is not an array — set arrayPath to point at the array inside the JSON.');
  }

  // Normalise primitive items into single-column objects so the rest of
  // the pipeline (which expects rows of {col: value}) doesn't choke.
  return body.map((row) => {
    if (row === null || row === undefined) return {};
    if (typeof row === 'object' && !Array.isArray(row)) return row;
    return { value: row };
  });
}
