import mongoose from 'mongoose';

const chartSlotSchema = new mongoose.Schema(
  {
    id:       { type: String, required: true },
    position: { type: String, enum: ['hero', 'grid', 'sidebar'], default: 'grid' },
    type:     { type: String, enum: ['line', 'bar', 'donut', 'area'], required: true },
    purpose:  { type: String, default: '' },  // 'trend' | 'comparison' | 'distribution' | ...
    title:    { type: String, default: '' },
    hint:     { type: String, default: '' },  // guidance for the AI when filling the slot
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    name:        { type: String, required: true },
    category:    { type: String, default: 'Custom' },
    description: { type: String, default: '' },
    previewImage:{ type: String, default: '' },

    // ── New (v5) raw-HTML / URL flow ──────────────────────────────────────
    // Templates can now be:
    //   'slots' — legacy / built-in. AI generates a slot config, renders via
    //             our React TemplateLayout. Old contract preserved.
    //   'html'  — user pasted raw HTML. We store it verbatim, render via
    //             sandboxed iframe srcDoc. AI does data injection at apply.
    //   'url'   — user pasted a URL. We store the URL, render via iframe
    //             src. Whether it frames is up to the target site.
    templateType: { type: String, enum: ['slots', 'html', 'url'], default: 'slots', index: true },
    templateCode: { type: String, default: '' },   // raw HTML; up to ~10MB per request
    templateUrl:  { type: String, default: '' },

    // How the user created this template — informational, used to label cards.
    //   'description' — natural-language description of the layout.
    //   'html'        — pasted an HTML snippet as design reference.
    //   'manual'      — user filled the slots manually (future).
    sourceType:  { type: String, enum: ['description', 'html', 'manual'], default: 'description' },

    // Truncated, sanitised original input. Kept for traceability, never rendered.
    sourceReference: { type: String, default: '' },

    // Concrete layout the renderer will use. Each value picks a different
    // visual structure (see client/src/components/templates/templateChrome.jsx).
    layoutType:  { type: String, enum: ['hero-grid', 'dense-grid', 'sidebar'], default: 'hero-grid' },

    layoutConfig: {
      layout:   { type: String, default: 'hero-grid' },
      sections: { type: [String], default: ['kpis', 'hero', 'grid', 'insights'] },
    },

    // Discrete visual options applied via Tailwind class composition.
    // No free-form CSS — keeps the design system enforceable.
    styleConfig: {
      density:   { type: String, enum: ['compact', 'airy'], default: 'airy' },
      cardStyle: { type: String, enum: ['soft', 'sharp'], default: 'soft' },
      accent:    { type: String, enum: ['brand', 'emerald', 'purple', 'amber'], default: 'brand' },
      mode:      { type: String, enum: ['light', 'dark'], default: 'light' },
    },

    chartSlots: { type: [chartSlotSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Template', templateSchema);
