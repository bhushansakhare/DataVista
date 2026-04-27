export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card p-10 text-center flex flex-col items-center gap-3">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-600">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div className="font-semibold text-lg">{title}</div>
      {description && <div className="text-sm text-ink-500 max-w-sm">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
