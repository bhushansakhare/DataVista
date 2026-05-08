import Sheet from '../models/Sheet.js';
import {
  parseSheetUrl, fetchCsv, parseCsv, hashContent,
  cleanColumns, renameRowKeys, detectTypes, coerceRows,
} from '../utils/sheetParser.js';

export async function importSheet(req, res, next) {
  try {
    const { sheetUrl, title, autoSync } = req.body;
    if (!sheetUrl) return res.status(400).json({ error: 'sheetUrl is required' });
    const { sheetKey, gid } = parseSheetUrl(sheetUrl);

    let csv;
    try {
      csv = await fetchCsv(sheetKey, gid);
    } catch (err) {
      return res.status(400).json({
        error: 'Could not fetch the sheet. Make sure it is shared as "Anyone with the link — Viewer".',
      });
    }
    const { rows, columns, types } = parseCsv(csv);
    const contentHash = hashContent(csv);

    const sheet = await Sheet.create({
      workspaceId: req.user.workspaceId,
      ownerId: req.user._id,
      sheetUrl,
      sheetKey,
      gid,
      title: title || `Sheet ${sheetKey.slice(0, 6)}`,
      rawData: rows,
      columns,
      selectedColumns: columns,
      detectedTypes: types,
      rowCount: rows.length,
      contentHash,
      autoSync: autoSync !== false,
      lastSyncedAt: new Date(),
    });

    res.status(201).json({ sheet });
  } catch (err) {
    next(err);
  }
}

export async function listSheets(req, res, next) {
  try {
    const sheets = await Sheet.find({ workspaceId: req.user.workspaceId })
      .select('-rawData')
      .sort({ createdAt: -1 });
    res.json({ sheets });
  } catch (err) {
    next(err);
  }
}

export async function getSheet(req, res, next) {
  try {
    const sheet = await Sheet.findOne({ _id: req.params.id, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    res.json({ sheet });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/sheet/upload — persist a CSV / XLSX upload as a real Sheet.
 *
 * The client parses the file (Papa / SheetJS), then sends `{ title, columns,
 * rows }`. We re-run column cleaning, type detection, and value coercion
 * server-side so the persisted shape matches a Google-imported sheet exactly.
 *
 * Uploaded sheets have no `sheetUrl` / `sheetKey` and `source: 'upload'`;
 * `refreshSheet` is a no-op for them.
 */
export async function uploadSheet(req, res, next) {
  try {
    const { title, columns: rawColumns, rows: rawRows } = req.body || {};
    if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
      return res.status(400).json({ error: 'columns is required and must be non-empty.' });
    }
    if (!Array.isArray(rawRows)) {
      return res.status(400).json({ error: 'rows is required and must be an array.' });
    }

    // Re-clean headers server-side as a defense-in-depth — even if the client
    // already cleaned them, this keeps Sheet docs consistent with the
    // /import path's parseCsv pipeline.
    const { columns, rename } = cleanColumns(rawColumns);
    const renamed = renameRowKeys(rawRows, rename);
    const types = detectTypes(renamed, columns);
    const rows = coerceRows(renamed, types);

    const sheet = await Sheet.create({
      workspaceId: req.user.workspaceId,
      ownerId: req.user._id,
      source: 'upload',
      sheetUrl: '',
      sheetKey: '',
      gid: '0',
      title: (typeof title === 'string' && title.trim()) || 'Uploaded sheet',
      rawData: rows,
      columns,
      selectedColumns: columns,
      detectedTypes: types,
      rowCount: rows.length,
      contentHash: hashContent(JSON.stringify(rawRows)),
      autoSync: false,
      lastSyncedAt: new Date(),
    });

    res.status(201).json({ sheet });
  } catch (err) {
    next(err);
  }
}

export async function refreshSheet(req, res, next) {
  try {
    const sheet = await Sheet.findOne({ _id: req.params.id, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    // Uploaded sheets have no remote source to refresh from. Return the sheet
    // unchanged so the UI's refresh button is a clean no-op rather than an error.
    if (sheet.source === 'upload') return res.json({ sheet });
    const csv = await fetchCsv(sheet.sheetKey, sheet.gid);
    const { rows, columns, types } = parseCsv(csv);
    const contentHash = hashContent(csv);
    sheet.rawData = rows;
    sheet.columns = columns;
    const prevSelected = Array.isArray(sheet.selectedColumns) ? sheet.selectedColumns : [];
    const stillValid = prevSelected.filter((c) => columns.includes(c));
    const newCols = columns.filter((c) => !prevSelected.includes(c));
    sheet.selectedColumns = prevSelected.length === 0 ? columns : [...stillValid, ...newCols];
    sheet.detectedTypes = types;
    sheet.rowCount = rows.length;
    sheet.contentHash = contentHash;
    sheet.lastSyncedAt = new Date();
    await sheet.save();
    const io = req.app.get('io');
    if (io) io.to(`sheet:${sheet._id}`).emit('sheet:updated', { sheetId: sheet._id });
    res.json({ sheet });
  } catch (err) {
    next(err);
  }
}

export async function updateColumns(req, res, next) {
  try {
    const { selectedColumns } = req.body;
    if (!Array.isArray(selectedColumns)) {
      return res.status(400).json({ error: 'selectedColumns must be an array' });
    }
    const sheet = await Sheet.findOne({ _id: req.params.id, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    const filtered = selectedColumns.filter((c) => sheet.columns.includes(c));
    sheet.selectedColumns = filtered;
    await sheet.save();
    res.json({ sheet });
  } catch (err) {
    next(err);
  }
}

export async function deleteSheet(req, res, next) {
  try {
    const sheet = await Sheet.findOneAndDelete({ _id: req.params.id, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
