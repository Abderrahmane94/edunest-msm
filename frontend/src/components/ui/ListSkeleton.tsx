/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-6" aria-busy="true">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-hover rounded-md" />
        ))}
      </div>
    </div>
  );
}
