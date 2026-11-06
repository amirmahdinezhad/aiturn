import { useEffect, useRef, useState } from "react";
import { PROVIDER_NAMES } from "../providerSetup";
import { prettyError, type QuotaSet } from "../api";
import { AccountQuotaPreview } from "./AccountUsagePreview";
import { AccountUsageSkeleton } from "./LoadingSkeleton";

/** Account-scoped reads discard results after a workspace/account/refresh change. */
export function LiveAccountUsage({ identity, accountName, refreshKey, load, showRemaining = true }: {
  identity: string; accountName: string; refreshKey?: number; load: () => Promise<QuotaSet | QuotaSet[]>; showRemaining?: boolean;
}) {
  const loader = useRef(load);
  loader.current = load;
  const key = JSON.stringify([identity, refreshKey]);
  const [snapshot, setSnapshot] = useState<{ key: string; sets: QuotaSet[] } | null>(null);
  useEffect(() => {
    let active = true;
    const read = loader.current;
    void Promise.resolve().then(read).then(result => {
      const sets = Array.isArray(result) ? result : [result];
      if (active) setSnapshot({ key, sets });
    }).catch(error => { if (active) setSnapshot({ key, sets: [{ provider: identity, error: prettyError(error) }] }); });
    return () => { active = false; };
  }, [key, identity]);
  return snapshot?.key === key ? snapshot.sets.length ? <>{snapshot.sets.map((quota, index) => <div key={`${quota.provider}:${index}`}>
    {snapshot.sets.length > 1 ? <p className="account-data-note">{PROVIDER_NAMES[quota.provider] ?? quota.provider}</p> : null}
    <AccountQuotaPreview quota={quota} accountName={snapshot.sets.length > 1 ? `${accountName} · ${PROVIDER_NAMES[quota.provider] ?? quota.provider}` : accountName} showRemaining={showRemaining} />
  </div>)}</> : <p className="account-data-note">Usage unavailable</p>
    : <div role="status" aria-label={`Loading usage for ${accountName}`}><AccountUsageSkeleton /></div>;
}
