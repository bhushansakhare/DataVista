// Notion connector. Requires an internal integration token from
// https://www.notion.so/my-integrations + the database shared with that integration.
//
// Credentials shape: { token, databaseId }

import axios from 'axios';

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

function flattenProperty(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case 'title':       return (prop.title || []).map((t) => t.plain_text).join('');
    case 'rich_text':   return (prop.rich_text || []).map((t) => t.plain_text).join('');
    case 'number':      return prop.number;
    case 'select':      return prop.select?.name || '';
    case 'multi_select':return (prop.multi_select || []).map((s) => s.name).join(', ');
    case 'date':        return prop.date?.start || '';
    case 'checkbox':    return Boolean(prop.checkbox);
    case 'url':         return prop.url || '';
    case 'email':       return prop.email || '';
    case 'phone_number':return prop.phone_number || '';
    case 'people':      return (prop.people || []).map((p) => p.name).filter(Boolean).join(', ');
    case 'files':       return (prop.files || []).map((f) => f.name).join(', ');
    case 'created_time':return prop.created_time || '';
    case 'last_edited_time': return prop.last_edited_time || '';
    default:            return '';
  }
}

/**
 * @param {object} args
 * @param {string} args.token
 * @param {string} args.databaseId
 * @returns {Promise<Array<object>>}
 */
export async function fetchNotion({ token, databaseId }) {
  if (!token || !databaseId) throw new Error('Notion requires token and databaseId.');
  const rows = [];
  let nextCursor;
  for (let i = 0; i < 10; i++) {  // up to 10× 100 = 1000 rows
    const body = { page_size: 100 };
    if (nextCursor) body.start_cursor = nextCursor;
    const res = await axios.post(`${API}/databases/${encodeURIComponent(databaseId)}/query`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': VERSION,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
    for (const page of (res.data?.results || [])) {
      const out = {};
      const props = page.properties || {};
      for (const [name, prop] of Object.entries(props)) {
        out[name] = flattenProperty(prop);
      }
      rows.push(out);
    }
    if (!res.data?.has_more) break;
    nextCursor = res.data?.next_cursor;
    if (!nextCursor) break;
  }
  return rows;
}
