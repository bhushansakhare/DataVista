export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-5 space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
