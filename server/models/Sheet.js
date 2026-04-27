import mongoose from 'mongoose';

const sheetSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sheetUrl: { type: String, required: true },
    sheetKey: { type: String, required: true, index: true },
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
