// Dashboard template registry.
//
// Templates are CODE-DEFINED on purpose for v1 — adding one is a deliberate
// commit, no admin UI needed yet. Each template defines a layout and a list
// of chart slots; the AI fills the slots using the user's actual columns.
//
// Adding a template later: append an entry to TEMPLATES, optionally drop a
// preview image into client/public/templates/<id>.svg.

export const TEMPLATES = [
  {
    id: 'sales-performance',
    name: 'Sales Performance',
    category: 'Sales',
    description: 'Trend over time, top products, category mix, plus headline KPIs.',
    // Public-relative URL; if the asset is missing the templates page falls
    // back to a gradient placeholder so the page never renders broken images.
    previewImage: '/templates/sales-performance.svg',
    layoutType: 'hero-grid',
    layoutConfig: {
      layout: 'hero-grid',
      sections: ['kpis', 'hero', 'grid', 'insights'],
    },
    styleConfig: { density: 'airy', cardStyle: 'soft', accent: 'brand', mode: 'light' },
    chartSlots: [
      {
        id: 'trend',
        position: 'hero',
        type: 'line',
        purpose: 'trend',
        title: 'Sales Trend',
        hint: 'Pick a date / month / time-like xField and a sales/revenue/amount yField.',
      },
      {
        id: 'top-items',
        position: 'grid',
        type: 'bar',
        purpose: 'comparison',
        title: 'Top Products',
        hint: 'Pick a product / item / category xField and a sales/revenue yField.',
      },
      {
        id: 'category-mix',
        position: 'grid',
        type: 'donut',
        purpose: 'distribution',
        title: 'Category Mix',
        hint: 'Pick a category / segment xField with a few dominant values, and a numeric yField.',
      },
      {
        id: 'volume',
        position: 'grid',
        type: 'area',
        purpose: 'trend',
        title: 'Monthly Volume',
        hint: 'Same time-like xField as the trend slot, but a units / orders / count yField.',
      },
    ],
  },
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function listTemplates() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    previewImage: t.previewImage,
    chartCount: t.chartSlots.length,
    layoutType: t.layoutType,
    styleConfig: t.styleConfig,
  }));
}

export function getTemplate(id) {
  return BY_ID.get(id) || null;
}
