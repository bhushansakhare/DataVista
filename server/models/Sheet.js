import mongoose from 'mongoose';

const sheetSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Where the data came from. 'google' has sheetUrl + sheetKey + gid set
    // and supports `/refresh`. 'upload' is a one-shot CSV/XLSX import — those
    // fields are absent and refresh is a no-op.
    source: { type: String, enum: ['google', 'upload'], default: 'google', index: true },
    sheetUrl: { type: String, default: '' },
    sheetKey: { type: String, default: '', index: true },
    gid: { type: String, default: '0' },
    title: { type: String, default: 'Untitled sheet' },
    rawData: { type: Array, default: [] },
    columns: { type: [String], default: [] },
    selectedColumns: { type: [String], default: [] },
    detectedTypes: { type: Object, default: {} },
    rowCount: { type: Number, default: 0 },
    contentHash: { type: String, default: '' },
    autoSync: { type: Boolean, default: true },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Sheet', sheetSchema);
