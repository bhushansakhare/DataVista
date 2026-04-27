import mongoose from 'mongoose';

const chartSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'bar', 'line', 'donut', 'area',
        'stackedBar', 'horizontalBar', 'scatter', 'treemap', 'funnel',
        'radial', 'heatmap', 'waterfall',
      ],
      required: true,
    },
    title: { type: String, default: 'Chart' },
    xField: { type: String, default: '' },
    yField: { type: String, default: '' },
    yFields: { type: [String], default: [] },
    groupBy: { type: String, default: '' },
    aggregation: { type: String, enum: ['sum', 'avg', 'count', 'min', 'max', 'none'], default: 'sum' },
    filters: { type: Array, default: [] },
    config: { type: Object, default: {} },
    layout: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      w: { type: Number, default: 6 },
      h: { type: Number, default: 4 },
    },
  },
  { _id: false }
);

const dashboardSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sheet', required: true },
    title: { type: String, default: 'Untitled dashboard' },
    description: { type: String, default: '' },
    charts: { type: [chartSchema], default: [] },
    layout: { type: String, default: 'grid' },
    theme: { type: String, default: 'light' },
  },
  { timestamps: true }
);

export default mongoose.model('Dashboard', dashboardSchema);
