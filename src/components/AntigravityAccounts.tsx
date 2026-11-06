import { AccountIdentity } from "./AccountIdentity";
import { activeAccountFirst, activeProviderAccountId } from "../accountActivity";
import { useEffect, useState } from "react";
import { antigravityAccounts, antigravityAccountQuota, prettyError, renameAntigravityAccount, type SetupAccount } from "../api";
import type { AppState, Workspace } from "../types";
import { ProviderLogo } from "../logos";
import { Button } from "./ui/button";
import { PlanBadge } from "./PlanBadge";
import { EditIcon } from "../icons";
import { ModalTarget } from "./AppModal";
import { AccountSettings } from "./AccountSettings";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { LiveAccountUsage } from "./LiveAccountUsage";

/** Account-scoped Google usage never falls back to another ambient Google login. */
export function AntigravityAccounts({ workspace, refreshKey, onChanged }: { workspace: Workspace; refreshKey: number; onChanged: (state: AppState) => void }) {
  const [accounts, setAccounts] = useState<SetupAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const settingsAccount = accounts.find((a) => a.id === settingsId && workspace.antigravityAccountIds?.includes(a.id));
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void antigravityAccounts().then(accounts => { if (active) setAccounts(accounts); })
      .catch(e => { if (active) setError(prettyError(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspace.id, refreshKey, retry]);
  const activeId = activeProviderAccountId("antigravity", workspace, accounts);
  const visible = accounts.filter(a => workspace.antigravityAccountIds?.includes(a.id));
  return <section className="provider-account-group" aria-label="Antigravity accounts">
    <h2 className="provider-group-title"><ProviderLogo provider="antigravity" />Antigravity <span className="provider-count">{loading ? "…" : error ? "—" : visible.length}</span><span className="provider-experimental">Experimental</span></h2>
    {!loading && !error && visible.length > 0 && !activeId
      ? <p className="provider-activation-note">Sign in with one of these accounts in Antigravity, then refresh.</p> : null}
    {loading ? <LoadingSkeleton variant="cards" count={workspace.antigravityAccountIds?.length || 1} /> : error ? <div className="home-inline-error" role="alert"><p>{error}</p><Button size="sm" onClick={() => setRetry(value => value + 1)}>Retry</Button></div> : <div className="workspace-account-list">{activeAccountFirst(visible, activeId).map(a => <article key={a.id} className={`workspace-account account-card${a.id === activeId ? " is-active" : ""}`} aria-label={`${a.name} Antigravity account`}>
      <div className="workspace-account-row"><AccountIdentity active={a.id === activeId} name={a.name} email={a.email}>
        <PlanBadge subscription={a.subscription} />
      </AccountIdentity><div className="workspace-account-actions"><Button size="icon-sm" variant="ghost" className="account-edit-action home-icon-button" aria-label={`Edit ${a.name}`} title="Edit account" onClick={() => setSettingsId(a.id)}><EditIcon size={17} /></Button></div></div>
      <LiveAccountUsage identity={`antigravity:${workspace.id}:${a.id}`} accountName={a.name} refreshKey={refreshKey} load={() => antigravityAccountQuota(a.id)} />
    </article>)}</div>}
    <ModalTarget target={settingsAccount}>{(account, presence) => <AccountSettings {...presence} key={`${workspace.id}:${account.id}`} workspace={workspace} provider="antigravity" profile={account} onClose={() => setSettingsId(null)} onChanged={onChanged} onRename={async (name) => {
      await renameAntigravityAccount(account.id, name);
      setAccounts((old) => old.map((a) => a.id === account.id ? { ...a, name } : a));
    }} />}</ModalTarget>
  </section>;
}
