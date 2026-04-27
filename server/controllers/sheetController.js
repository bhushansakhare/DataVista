import Sheet from '../models/Sheet.js';
import { parseSheetUrl, fetchCsv, parseCsv, hashContent } from '../utils/sheetParser.js';

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

export async function refreshSheet(req, res, next) {
  try {
    const sheet = await Sheet.findOne({ _id: req.params.id, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
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
