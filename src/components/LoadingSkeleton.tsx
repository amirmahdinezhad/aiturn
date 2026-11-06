import { Skeleton } from "./ui/skeleton";

export function AccountUsageSkeleton() {
  return <div className="account-usage-preview account-usage-skeleton" aria-hidden="true">
    <div className="account-usage-metrics">
      {[0, 1].map(column => <div className="account-usage-metric" key={column}>
        <div className="account-usage-skeleton-label"><Skeleton /></div>
        <div className="account-usage-skeleton-value"><Skeleton /></div>
        <div className="usage-preview-plot"><Skeleton className="usage-preview-track" /></div>
      </div>)}
    </div>
  </div>;
}

/** Shown until the first backend state arrives. */
export function LoadingSkeleton({ variant = "list", count = 3 }: { variant?: "list" | "cards"; count?: number }) {
  if (variant === "cards") return <div className="account-card-skeletons" role="status" aria-label="Loading accounts">
    <span className="sr-only">Loading accounts…</span>
    {Array.from({ length: count }, (_, row) => <div className="account-card-skeleton" aria-hidden="true" key={row}>
      <div className="account-card-skeleton-row">
        <Skeleton className="account-skeleton-avatar" />
        <div className="account-identity-copy">
          <div className="account-card-skeleton-title"><Skeleton className="account-skeleton-name" /><Skeleton className="account-card-skeleton-meta" /></div>
          <div className="account-card-skeleton-email"><Skeleton className="account-skeleton-email" /></div>
        </div>
        <Skeleton className="account-card-skeleton-actions" />
      </div>
      <AccountUsageSkeleton />
    </div>)}
  </div>;
  return (
    <div className="account-skeletons" role="status" aria-label="Loading">
      <span className="sr-only">Loading accounts…</span>
      {[0, 1, 2].map((row) => (
        <div className="account-skeleton" key={row} aria-hidden="true">
          <Skeleton className="account-skeleton-mark" />
          <div><Skeleton className="account-skeleton-name" /><Skeleton className="account-skeleton-email" /></div>
        </div>
      ))}
    </div>
  );
}
