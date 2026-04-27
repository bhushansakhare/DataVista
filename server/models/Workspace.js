import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  },
  { timestamps: true }
);

export default mongoose.model('Workspace', workspaceSchema);
