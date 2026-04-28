import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  ScatterChart, Scatter, Treemap, FunnelChart, Funnel, RadialBarChart, RadialBar,
  ComposedChart, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  PALETTE, aggregate, totalsPerMetric, buildScatter, buildTreemap, buildFunnel, buildHeatmap, buildWaterfall,
} from '../../utils/chartTransform.js';
import { detectUnit, getFormatter } from '../../utils/formatValue.js';

const tickStyle = { fontSize: 11, fill: 'currentColor' };
const gridStroke = 'rgba(148,163,184,0.18)';

export default function ChartRenderer({ chart, rows, height = 300 }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const view = useMemo(() => (chart ? buildView(chart, safeRows) : { data: [] }), [chart, safeRows]);
  // Pick a smart formatter for the value axis based on the Y column name + sample values.
  // For multi-Y charts, use the first yField as the formatter hint (the axis is shared).
  const fmt = useMemo(() => {
    const ys = Array.isArray(chart?.yFields) && chart.yFields.length > 0
      ? chart.yFields
      : (chart?.yField ? [chart.yField] : []);
    if (ys.length === 0) return getFormatter('integer'); // count of rows
    const primary = ys[0];
    const sample = safeRows.slice(0, 80).map((r) => r[primary]);
    const unit = detectUnit(primary, sample);
    return getFormatter(unit);
  }, [chart?.yField, chart?.yFields, safeRows]);

  if (!chart || !chart.type) {
    return (
      <div
        className="w-full flex items-center justify-center text-sm text-ink-500"
        style={{ height }}
      >
        No chart configured
      </div>
    );
  }
  if (chart.type === 'heatmap') {
    return (
      <div className="w-full text-ink-600 dark:text-ink-300" style={{ height }}>
        {renderHeatmap(chart, view, fmt)}
      </div>
    );
  }
  return (
    <div className="w-full text-ink-600 dark:text-ink-300" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {render(chart, view, fmt)}
      </ResponsiveContainer>
    </div>
  );
}

function buildView(chart, rows) {
  // Multi-Y indicator — used to show one slice/bucket per metric instead of by X.
  const ys = Array.isArray(chart.yFields) && chart.yFields.length > 0
    ? chart.yFields
    : (chart.yField ? [chart.yField] : []);
  const isMultiY = ys.length >= 2;

  switch (chart.type) {
    case 'bar':
    case 'line':
    case 'area':
    case 'stackedBar':
    case 'horizontalBar':
      return aggregate(rows, chart);
    case 'donut': {
      if (isMultiY) {
        return { data: totalsPerMetric(rows, { yFields: ys, aggregation: chart.aggregation, filters: chart.filters }) };
      }
      const a = aggregate(rows, chart);
      return { data: a.data?.map((d, i) => ({ name: d.name, value: d.value, fill: PALETTE[i % PALETTE.length] })) || [] };
    }
    case 'radial': {
      if (isMultiY) {
        return { data: totalsPerMetric(rows, { yFields: ys, aggregation: chart.aggregation, filters: chart.filters }) };
      }
      const a = aggregate(rows, chart);
      return { data: a.data?.map((d, i) => ({ name: d.name, value: d.value, fill: PALETTE[i % PALETTE.length] })) || [] };
    }
    case 'scatter': return buildScatter(rows, chart);
    case 'treemap': {
      if (isMultiY) {
        const totals = totalsPerMetric(rows, { yFields: ys, aggregation: chart.aggregation, filters: chart.filters });
        return { data: totals.map((t) => ({ name: t.name, size: t.value })) };
      }
      return { data: buildTreemap(rows, chart) };
    }
    case 'funnel': {
      if (isMultiY) {
        const totals = totalsPerMetric(rows, { yFields: ys, aggregation: chart.aggregation, filters: chart.filters });
        return { data: totals.sort((a, b) => b.value - a.value) };
      }
      return { data: buildFunnel(rows, chart) };
    }
    case 'heatmap': return buildHeatmap(rows, chart);
    case 'waterfall': return { data: buildWaterfall(rows, chart) };
    default: return { data: [] };
  }
}

function render(chart, view, fmt) {
  switch (chart.type) {
    case 'bar': return renderBar(chart, view, fmt);
    case 'line': return renderLine(chart, view, fmt);
    case 'area': return renderArea(chart, view, fmt);
    case 'stackedBar': return renderStackedBar(chart, view, fmt);
    case 'horizontalBar': return renderHorizontalBar(chart, view, fmt);
    case 'donut': return renderDonut(chart, view, fmt);
    case 'radial': return renderRadial(chart, view, fmt);
    case 'scatter': return renderScatter(chart, view, fmt);
    case 'treemap': return renderTreemap(chart, view, fmt);
    case 'funnel': return renderFunnel(chart, view, fmt);
    case 'heatmap': return renderHeatmap(chart, view, fmt);
    case 'waterfall': return renderWaterfall(chart, view, fmt);
    default: return <div />;
  }
}

const tooltipFormatter = (fmt) => (value, name) => [fmt(Number(value)), name];

function renderBar(_chart, view, fmt) {
  const groups = view.groups || [];
  return (
    <BarChart data={view.data || []} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
      <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
      <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={fmt} width={64} />
      <Tooltip contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
      {groups.length > 0 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {groups.length === 0 && <Bar dataKey="value" name="Value" fill={PALETTE[0]} radius={[8, 8, 0, 0]} />}
      {groups.map((g, i) => (
        <Bar key={g} dataKey={g} fill={PALETTE[i % PALETTE.length]} radius={[8, 8, 0, 0]} />
      ))}
    </BarChart>
  );
}

function renderLine(_chart, view, fmt) {
  const groups = view.groups || [];
  return (
    <LineChart data={view.data || []} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
      <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
      <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={fmt} width={64} />
      <Tooltip contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
      {groups.length > 0 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {groups.length === 0 && (
        <Line type="monotone" dataKey="value" name="Value" stroke={PALETTE[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      )}
      {groups.map((g, i) => (
        <Line key={g} type="monotone" dataKey={g} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      ))}
    </LineChart>
  );
}

function renderArea(_chart, view, fmt) {
  const groups = view.groups || [];
  const id = `gradient-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <AreaChart data={view.data || []} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.4} />
          <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
      <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
      <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={fmt} width={64} />
      <Tooltip contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
      {groups.length > 0 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {groups.length === 0 && (
        <Area type="monotone" dataKey="value" name="Value" stroke={PALETTE[0]} fill={`url(#${id})`} strokeWidth={2.5} />
      )}
      {groups.map((g, i) => (
        <Area key={g} type="monotone" dataKey={g} stackId="1" stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.3} />
      ))}
    </AreaChart>
  );
}

function renderStackedBar(_chart, view, fmt) {
  const groups = view.groups || [];
  return (
    <BarChart data={view.data || []} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
      <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
      <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={fmt} width={64} />
      <Tooltip contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {(groups.length ? groups : ['value']).map((g, i) => (
        <Bar key={g} dataKey={g} stackId="s" fill={PALETTE[i % PALETTE.length]} radius={i === (groups.length || 1) - 1 ? [8, 8, 0, 0] : 0} />
      ))}
    </BarChart>
  );
}

function renderHorizontalBar(_chart, view, fmt) {
  const groups = view.groups || [];
  return (
    <BarChart layout="vertical" data={view.data || []} margin={{ top: 10, right: 16, left: 16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
      <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={fmt} />
      <YAxis type="category" dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} width={100} />
      <Tooltip contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
      {groups.length > 0 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {groups.length === 0 && <Bar dataKey="value" name="Value" fill={PALETTE[0]} radius={[0, 8, 8, 0]} />}
      {groups.map((g, i) => (
        <Bar key={g} dataKey={g} fill={PALETTE[i % PALETTE.length]} radius={[0, 8, 8, 0]} />
      ))}
    </BarChart>
  );
}

function renderDonut(_chart, view, fmt) {
  const data = view.data || [];
  const total = data.reduce((a, b) => a + (Number(b.value) || 0), 0) || 1;
  return (
    <PieChart margin={{ top: 8, right: 60, left: 60, bottom: 8 }}>
      <Tooltip
        contentStyle={tooltipStyle()}
        formatter={(value, name) => {
          const pct = ((Number(value) / total) * 100).toFixed(1);
          return [`${fmt(Number(value))} (${pct}%)`, name];
        }}
      />
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        innerRadius="55%"
        outerRadius="78%"
        paddingAngle={2}
        labelLine={{ stroke: 'rgba(148,163,184,0.5)' }}
        label={(props) => <DonutLabel {...props} />}
      >
        {data.map((d, i) => (<Cell key={i} fill={d.fill || PALETTE[i % PALETTE.length]} />))}
      </Pie>
    </PieChart>
  );
}

function DonutLabel({ cx, cy, midAngle, outerRadius, percent, name }) {
  const RADIAN = Math.PI / 180;
  if (!Number.isFinite(percent) || percent < 0.03) return null;
  const radius = outerRadius + 16;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const anchor = x > cx ? 'start' : 'end';
  const display = String(name || '');
  const trimmed = display.length > 14 ? `${display.slice(0, 13)}…` : display;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={11}
      fill="currentColor"
    >
      {trimmed} · {(percent * 100).toFixed(1)}%
    </text>
  );
}

function renderRadial(_chart, view, fmt) {
  return (
    <RadialBarChart innerRadius="20%" outerRadius="95%" data={view.data || []} startAngle={90} endAngle={-270}>
      <RadialBar background dataKey="value" cornerRadius={8} />
      <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 12 }} />
      <Tooltip contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
    </RadialBarChart>
  );
}

function renderScatter(_chart, view, fmt) {
  return (
    <ScatterChart margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
      <XAxis type="number" dataKey="x" tick={tickStyle} tickLine={false} axisLine={false} />
      <YAxis type="number" dataKey="y" tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={fmt} width={64} />
      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {(view.series || []).map((s, i) => (
        <Scatter key={s.name} name={s.name} data={s.data} fill={PALETTE[i % PALETTE.length]} />
      ))}
    </ScatterChart>
  );
}

function renderTreemap(_chart, view, _fmt) {
  return (
    <Treemap
      data={(view.data || []).map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }))}
      dataKey="size"
      stroke="#fff"
      fill={PALETTE[0]}
      content={<TreemapNode />}
    />
  );
}

function TreemapNode(props) {
  const { x, y, width, height, name, fill } = props;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: 'rgba(255,255,255,0.6)', strokeWidth: 2 }} />
      {width > 70 && height > 30 && (
        <text x={x + 8} y={y + 18} fontSize={11} fill="#fff" fontWeight={600}>{name}</text>
      )}
    </g>
  );
}

function renderFunnel(_chart, view, fmt) {
  return (
    <FunnelChart>
      <Tooltip contentStyle={tooltipStyle()} formatter={tooltipFormatter(fmt)} />
      <Funnel data={view.data || []} dataKey="value" nameKey="name" isAnimationActive>
        <LabelList position="right" fill="currentColor" stroke="none" dataKey="name" fontSize={11} />
      </Funnel>
    </FunnelChart>
  );
}

function renderHeatmap(_chart, view, fmt) {
  const { xs = [], ys = [], cells = [], max = 1 } = view;
  if (!xs.length || !ys.length) return <EmptyMsg msg="Pick X (column) and Group-by (row) for the heatmap" />;
  return (
    <div className="w-full h-full overflow-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th></th>
            {xs.map((x) => (
              <th key={x} className="px-2 py-1 font-medium text-ink-500 whitespace-nowrap">{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map((y) => (
            <tr key={y}>
              <td className="px-2 py-1 font-medium text-ink-500 whitespace-nowrap">{y}</td>
              {xs.map((x) => {
                const c = cells.find((cc) => cc.x === x && cc.y === y);
                const v = c ? c.v : 0;
                const t = max ? v / max : 0;
                const bg = `rgba(99,102,241,${0.08 + t * 0.85})`;
                return (
                  <td key={x} className="p-0">
                    <div
                      className="w-14 h-9 flex items-center justify-center rounded-md m-0.5 text-[10px] font-semibold"
                      style={{ background: bg, color: t > 0.55 ? '#fff' : 'inherit' }}
                      title={`${x} / ${y}: ${fmt(v)}`}
                    >
                      {v ? fmt(v) : ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderWaterfall(_chart, view, fmt) {
  const data = view.data || [];
  return (
    <ComposedChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
      <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
      <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={fmt} width={64} />
      <Tooltip
        contentStyle={tooltipStyle()}
        formatter={(v, n, p) => {
          const delta = p?.payload?.delta;
          return [fmt(Number(delta ?? v)), 'Change'];
        }}
      />
      <Bar dataKey="base" stackId="w" fill="transparent" />
      <Bar dataKey="value" stackId="w" radius={[6, 6, 0, 0]}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.delta >= 0 ? '#22c55e' : '#f43f5e'} />
        ))}
      </Bar>
    </ComposedChart>
  );
}

function tooltipStyle() {
  return {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(148,163,184,0.3)',
    borderRadius: 12,
    fontSize: 12,
    color: '#0f172a',
  };
}

function EmptyMsg({ msg }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-sm text-ink-500 px-4 text-center">
      {msg}
    </div>
  );
}
