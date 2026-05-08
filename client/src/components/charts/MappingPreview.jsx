import { useMemo } from 'react';
import {
  ArrowRight, EyeOff, BarChart2, LineChart as LineIcon, PieChart as PieIcon,
  AreaChart as AreaIcon, Layers, Grid3x3, Filter as FunnelIcon, CircleDot,
  Boxes, AlignLeft, ScatterChart as ScatterIcon, TrendingUp, Hash,
} from 'lucide-react';
import ColumnTip from '../ui/ColumnTip.jsx';
import { useColumnReasoning } from '../../hooks/useColumnReasoning.js';
import { columnsUsed, describeChart } from '../../utils/chartLabels.js';

/**
 * "How will this chart look?" — pre-render mapping. Lives between the chart
 * builder form and the live chart preview so users can see what each column
 * will become BEFORE the chart renders.
 */
const TYPE_ICON = {
  bar: BarChart2, line: LineIcon, donut: PieIcon, area: AreaIcon,
  stackedBar: Layers, horizontalBar: AlignLeft, scatter: ScatterIcon,
  treemap: Boxes, funnel: FunnelIcon, radial: CircleDot, heatmap: Grid3x3,
  waterfall: TrendingUp,
};

const ROLE_HINT = {
  bar:           { x: 'X-axis (categories)',   y: 'Bar height (numeric value)' },
  line:          { x: 'X-axis (timeline)',     y: 'Line value (numeric)' },
  area:          { x: 'X-axis (timeline)',     y: 'Filled area (numeric)' },
  stackedBar:    { x: 'X-axis (categories)',   y: 'Stack height',  group: 'Each stack split' },
  horizontalBar: { x: 'Y labels (categories)', y: 'Bar length (numeric)' },
  donut:         { x: 'Slices (categories)',   y: 'Slice size' },
  treemap:       { x: 'Rectangles',             y: 'Rectangle size' },
  funnel:        { x: 'Funnel stages',          y: 'Stage width' },
  radial:        { x: 'Radial bars',            y: 'Bar length' },
  scatter:       { x: 'X position (numeric)',   y: 'Y position (numeric)' },
  heatmap:       { x: 'Columns (categories)',   y: 'Cell intensity', group: 'Rows (categories)' },
  waterfall:     { x: 'X-axis',                 y: 'Step height' },
};

export default function MappingPreview({ chart, sheet }) {
  const reasoning = useColumnReasoning(sheet);
  const labels = describeChart(chart || {});
  const TypeIcon = TYPE_ICON[chart?.type] || BarChart2;
  const hint = ROLE_HINT[chart?.type] || ROLE_HINT.bar;

  const used = columnsUsed(chart || {});
  const allCols = Array.isArray(sheet?.columns) ? sheet.columns : [];
  const ignored = useMemo(() => allCols.filter((c) => !used.includes(c)), [allCols, used]);

  const yValues = Array.isArray(chart?.yFields) && chart.yFields.length
    ? chart.yFields
    : (chart?.yField ? [chart.yField] : []);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center">
            <TypeIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-sm">Mapping preview</div>
            <div className="text-[11px] text-ink-500">{labels.typeLabel} chart layout</div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Row
          column={chart?.xField}
          target={hint.x}
          reasoning={reasoning}
          fallback="Pick an X-axis column"
        />
        {yValues.length > 0
          ? yValues.map((y) => (
              <Row key={y} column={y} target={hint.y} reasoning={reasoning} />
            ))
          : (
            <Row
              column={null}
              target={hint.y}
              fallbackLabel="Row count"
              fallback="No Y column — chart counts the rows in each X bucket."
            />
          )}
        {chart?.groupBy && (
          <Row
            column={chart.groupBy}
            target={hint.group || 'Group split'}
            reasoning={reasoning}
          />
        )}
      </div>

      {ignored.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ink-200/60 dark:border-ink-800/60">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 flex items-center gap-1 mb-2">
            <EyeOff className="w-3 h-3" /> Ignored in this chart
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ignored.map((c) => (
              <ColumnTip key={c} column={c} reasoning={reasoning}>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800/60 text-ink-500 dark:text-ink-400 cursor-help">
                  {c}
                </span>
              </ColumnTip>
            ))}
          </div>
          <p className="text-[10px] text-ink-400 mt-2 leading-relaxed">
            Hover any column to see why it's not used in this chart.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ column, target, reasoning, fallback, fallbackLabel }) {
  return (
    <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 px-2 py-1.5 rounded-lg bg-ink-50/60 dark:bg-ink-800/30">
      {column ? (
        <ColumnTip column={column} reasoning={reasoning}>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 cursor-help truncate">
            <Hash className="w-3 h-3 inline mr-1 -mt-0.5" />
            {column}
          </span>
        </ColumnTip>
      ) : (
        <span className="text-xs text-ink-400 italic px-2 py-0.5">
          {fallbackLabel || fallback || '—'}
        </span>
      )}
      <ArrowRight className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" />
      <span className="text-xs text-ink-600 dark:text-ink-300 truncate">{target}</span>
    </div>
  );
}
