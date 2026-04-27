import Sheet from '../models/Sheet.js';
import { fetchCsv, parseCsv, hashContent } from '../utils/sheetParser.js';

const POLL_SECONDS = Number(process.env.SHEET_POLL_SECONDS || 30);

async function tick(io) {
  try {
    const sheets = await Sheet.find({ autoSync: true });
    for (const sheet of sheets) {
      try {
        const csv = await fetchCsv(sheet.sheetKey, sheet.gid);
        const newHash = hashContent(csv);
        if (newHash === sheet.contentHash) continue;
        const { rows, columns, types } = parseCsv(csv);
        sheet.rawData = rows;
        sheet.columns = columns;
        sheet.detectedTypes = types;
        sheet.rowCount = rows.length;
        sheet.contentHash = newHash;
        sheet.lastSyncedAt = new Date();
        await sheet.save();
        io.to(`sheet:${sheet._id}`).emit('sheet:updated', { sheetId: sheet._id });
        console.log(`[poller] sheet ${sheet._id} updated`);
      } catch (err) {
        console.warn(`[poller] failed sheet ${sheet._id}:`, err.message);
      }
    }
  } catch (err) {
    console.warn('[poller] tick error:', err.message);
  }
}

export function startSheetPoller(io) {
  console.log(`[poller] starting (every ${POLL_SECONDS}s)`);
  setInterval(() => tick(io), POLL_SECONDS * 1000);
}
