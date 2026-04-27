import { CHART_TYPES } from '../../utils/chartTransform.js';
import {
  BarChart3, LineChart, PieChart, AreaChart, Layers, AlignLeft, ScatterChart,
  Boxes, Filter, CircleDot, Grid3x3, TrendingUp,
} from 'lucide-react';

const ICONS = {
  bar: BarChart3, line: LineChart, donut: PieChart, area: AreaChart,
  stackedBar: Layers, horizontalBar: AlignLeft, scatter: ScatterChart, treemap: Boxes,
  funnel: Filter, radial: CircleDot, heatmap: Grid3x3, waterfall: TrendingUp,
};

export default function ChartTypePicker({ value, onChange }) {
  const groups = [
    { key: 'basic', label: 'Basic' },
    { key: 'advanced', label: 'Advanced' },
    { key: 'pro', label: 'Pro' },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="label mb-2">{g.label}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CHART_TYPES.filter((c) => c.group === g.key).map((c) => {
              const Icon = ICONS[c.id] || BarChart3;
              const active = value === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onChange(c.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    active
                      ? 'border-brand-500 bg-brand-500/10 shadow-ring'
                      : 'border-ink-200 dark:border-ink-800 hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-800/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${active ? 'text-brand-600' : 'text-ink-400'}`} />
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-[10px] text-ink-500 leading-tight mt-0.5">{c.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
