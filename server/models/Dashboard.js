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
    // AI-generated insights ("WHAT + WHY" bullets). Persisted so the saved
    // dashboard view can render the same Key Insights block as the preview.
    insights: { type: [String], default: [] },
    // When the dashboard was generated from a template, the template id is
    // stored here so the saved view can show a "Built from <template>" badge.
    templateId: { type: String, default: '', index: true },
    // For HTML / URL templates, the resolved/rendered version is snapshot
    // here so the saved dashboard renders even if the source template is
    // later edited or deleted.
    templateType: { type: String, enum: ['', 'slots', 'html', 'url'], default: '' },
    templateCode: { type: String, default: '' },
    templateUrl:  { type: String, default: '' },
    // Snapshot of the template's layout + style at save time. The saved
    // dashboard renders the same way even if the template is later edited
    // or deleted.
    layoutType:  { type: String, enum: ['hero-grid', 'dense-grid', 'sidebar', ''], default: '' },
    styleConfig: {
      density:   { type: String, default: '' },
      cardStyle: { type: String, default: '' },
      accent:    { type: String, default: '' },
      mode:      { type: String, default: '' },
    },
    layout: { type: String, default: 'grid' },
    theme: { type: String, default: 'light' },
  },
  { timestamps: true }
);

export default mongoose.model('Dashboard', dashboardSchema);
