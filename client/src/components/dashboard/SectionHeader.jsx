export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4 mt-2">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
