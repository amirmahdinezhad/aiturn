import { activeAccountFirst, activeProviderAccountId } from "../accountActivity";
import { useEffect, useMemo, useState } from "react";
import { codexProfileQuota, prettyError, type QuotaSet } from "../api";
import { accountLimitText, nextUsableAccount } from "../accountLimits";
import { codexAccountPreferences } from "../accountPrefs";
import { AccountSwitchIcon, EditIcon, ResetIcon, SpinnerIcon } from "../icons";
import { ProviderLogo } from "../logos";
import { isSubscriptionExpired } from "../subscriptions";
import type { AppSettings, CodexProfile, CodexProfilesState, Workspace } from "../types";
import { Button } from "./ui/button";
import { PlanBadge } from "./PlanBadge";
import { CodexResetNotice } from "./CodexResetNotice";
import { EmptyState } from "./EmptyState";
import { useAccountClock } from "../useAccountClock";
import { AccountQuotaPreview } from "./AccountUsagePreview";
import { AccountIdentity } from "./AccountIdentity";
import { LoadingSkeleton } from "./LoadingSkeleton";

const EMPTY_QUOTAS: Record<string, QuotaSet | null> = {};

/** Read saved logins without activation; discard responses from a previous workspace/identity. */
export function useWorkspaceQuotas(profiles: CodexProfile[], workspaceId: string | undefined, refreshKey: number) {
  const key = profiles.map((p) => `${p.id}:${p.connected}:${p.active}:${p.needsActivation}`).join(",");
  const requestKey = JSON.stringify([workspaceId, refreshKey, key]);
  const [snapshot, setSnapshot] = useState<{ key: string; quotas: Record<string, QuotaSet | null> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(profiles.filter((p) => p.connected).map(async (profile): Promise<[string, QuotaSet]> => {
      try { return [profile.id, await codexProfileQuota(profile.id)]; }
      catch (error) { return [profile.id, { provider: "codex", error: prettyError(error) }]; }
    })).then((entries) => {
      if (!cancelled) setSnapshot({ key: requestKey, quotas: Object.fromEntries(entries) });
    });
    return () => { cancelled = true; };
  }, [requestKey]); // Publish the complete batch; metadata-only changes do not refetch.
  return snapshot?.key === requestKey ? snapshot.quotas : EMPTY_QUOTAS;

}

interface Props {
  workspace: Workspace;
  profiles: CodexProfilesState | null;
  app: AppSettings;
  quotas: Record<string, QuotaSet | null>;
  busy: boolean;
  checkingId?: string | null;
  switchingId?: string;
  onManage: (id: string) => void;
  onActivate: (id: string) => void;
  onQuickSwitch: (activeId: string) => void;
  onBankedReset: (id: string) => void;
  onReconnect?: (id: string) => void;
}

/** Each workspace card represents a saved account, including inactive logins. */
export function WorkspaceAccounts({ workspace, profiles, app, quotas, busy, checkingId, switchingId, onManage, onActivate, onQuickSwitch, onBankedReset, onReconnect }: Props) {
  const accounts = useMemo(() => workspace.accountIds.map((id) => profiles?.profiles.find((p) => p.id === id)).filter((p): p is CodexProfile => !!p), [workspace.accountIds, profiles]);
  const now = useAccountClock(accounts.map(account => account.subscription?.expiresAt));
  const visible = accounts.filter((p) => !isSubscriptionExpired(p.subscription, now));
  const loading = !profiles || visible.some((p) => p.connected && quotas[p.id] === undefined);
  const expired = accounts.filter((p) => isSubscriptionExpired(p.subscription, now));
  const missingCodex = profiles?.desktopInstalled === false && profiles.cliInstalled === false;
  const activeId = missingCodex ? null : activeProviderAccountId("codex", workspace, visible);
  const knownWindows = Object.fromEntries(accounts.map((p) => [p.id, codexAccountPreferences(app, p.id).knownWindows]));
  if (profiles && !accounts.length) return null;
  return <section className="workspace-accounts" aria-label="Workspace accounts">
    {profiles ? <h2 className="provider-group-title"><ProviderLogo provider="codex" />Codex <span className="provider-count" aria-label={`${visible.length} Codex ${visible.length === 1 ? "account" : "accounts"}`}>{visible.length}</span></h2> : null}
    {profiles && (workspace.usage.showCodexResets ?? true) ? <CodexResetNotice refreshKey={quotas} settings={{ ...app.codexReset, showProbableResets: workspace.usage.showProbableResets }} /> : null}
    {!loading && visible.length > 0 && !activeId ? <p className="provider-activation-note">{missingCodex ? "Install Codex CLI or Codex app and sign in, then refresh." : profiles?.switchError ?? (visible.some((profile) => profile.connected)
      ? "Choose Switch to activate an account in Codex."
      : "Reconnect a Codex account before switching.")}</p> : null}
    {loading ? <LoadingSkeleton variant="cards" count={visible.length || 3} /> : !visible.length ? <EmptyState title="No current Codex accounts" message="Manage expired subscriptions below or add another account." /> : <div className="workspace-account-list">{activeAccountFirst(visible, activeId).map((profile) => {
      const isActive = profile.id === activeId;
      const switchPending = profile.id === checkingId || profile.id === switchingId;
      const quota = quotas[profile.id];
      const limit = profile.active ? accountLimitText(quota, now) : null;
      const target = profile.active ? nextUsableAccount(accounts, profile.id, quotas, now, knownWindows) : null;
      const resetCount = quota?.resetCredits?.availableCount ?? 0;
      const bankedReset = profile.connected && resetCount > 0
        ? <Button size="sm" variant="ghost" className="account-banked-reset" disabled={busy}
            aria-label={`Banked Reset for ${profile.name}, ${resetCount} available`} title={`Banked Reset · ${resetCount} available`}
            onClick={() => onBankedReset(profile.id)}><ResetIcon size={16} /><span aria-hidden="true">{resetCount}</span></Button>
        : null;
      return <article key={profile.id} className={`workspace-account account-card${isActive ? " is-active" : ""}`} aria-label={`${profile.name} account`}>
        <div className="workspace-account-row"><AccountIdentity active={isActive} name={profile.name} email={profile.email} detail={profile.displayName !== profile.name ? profile.displayName : null}>
          <PlanBadge subscription={profile.subscription ?? { id: "chatgpt", service: "ChatGPT", plan: profile.plan }} />
        </AccountIdentity><div className="workspace-account-actions">
          {!isActive ? <Button size="icon-sm" className="account-switch-action" variant="ghost" aria-label={`Switch to ${profile.name}`} aria-busy={switchPending} title={switchPending ? "Switch in progress" : `Switch to ${profile.name}`} disabled={busy || missingCodex || !profile.connected || !!profiles.switchError} onClick={() => onActivate(profile.id)}>{switchPending ? <SpinnerIcon size={16} /> : <AccountSwitchIcon size={16} />}<span className="account-switch-label">Switch</span></Button> : null}
          <Button size="icon-sm" variant="ghost" className="account-edit-action home-icon-button" aria-label={`Edit ${profile.name}`} title="Edit account" onClick={() => onManage(profile.id)}><EditIcon size={17} /></Button>
        </div>
        </div>
        {profile.connected ? <AccountQuotaPreview quota={quota} accountName={profile.name} showRemaining={workspace.usage.showRemaining} /> : null}
        {profile.connected && quota?.error && onReconnect && /session|auth|reconnect|sign.in|token/i.test(quota.error) ? <Button variant="ghost" size="sm" className="account-reconnect" onClick={() => onReconnect(profile.id)}>Reconnect account</Button> : null}
        {!profile.connected ? <p className="workspace-error">{profile.connectionError ?? "Reconnect this account"}</p> : null}
        {limit ? <div className="account-limit-notice" aria-label="Account usage limit"><span className="account-limit-label">Limit reached</span>
          <div className="account-limit-actions">
            {bankedReset}
            <Button size="icon-sm" variant="ghost" className="account-limit-switch" aria-label="Switch to next available account" title={target ? `Switch to ${target.name}` : "No other account has available capacity"} disabled={busy || !target || !!profiles.switchError} onClick={() => onQuickSwitch(profile.id)}><AccountSwitchIcon size={17} /></Button>
          </div>
        </div> : bankedReset}
      </article>;
    })}</div>}
    {expired.length ? <details className="workspace-expired"><summary>Expired accounts ({expired.length})</summary>{expired.map((p) => <div className="workspace-expired-row" key={p.id}><span>{p.name}</span><Button size="sm" onClick={() => onManage(p.id)}>Edit</Button></div>)}</details> : null}
  </section>;
}
