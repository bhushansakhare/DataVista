import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema(
  {
    dashboardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dashboard', required: true, index: true },
    publicToken: { type: String, required: true, unique: true, index: true },
    permission: { type: String, enum: ['view', 'edit'], default: 'view' },
    expiresAt: { type: Date },
    isPublic: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Share', shareSchema);
