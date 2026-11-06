import { useEffect, useRef, useState } from "react";
import { loadSetupAccounts, prettyError, type AccountProvider, type SetupAccount } from "../api";
import { RefreshIcon, SpinnerIcon } from "../icons";
import type { AppState, Workspace } from "../types";
import { AccountEnrollment, accountSourceLabel, PROVIDER_LABELS, useAccountEnrollment } from "./AccountEnrollment";
import { PlanBadge } from "./PlanBadge";
import { Button } from "./ui/button";
import type { DraftStatus } from "./WorkspaceSetup";

/** Verify local accounts for the chosen provider through the same discovery as setup. */
export function AddAccountsPanel({ workspace, onSaved, onStatusChange, onAccountAdded }: { workspace: Workspace; onSaved: (state: AppState) => void; onStatusChange: (status: DraftStatus) => void; onAccountAdded?: () => void }) {
  const draft = useAccountEnrollment();
  const [provider, setProvider] = useState<AccountProvider | null>(null);
  const [localAccounts, setLocalAccounts] = useState<SetupAccount[]>([]);
  const [checking, setChecking] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const discover = async (id: AccountProvider | null) => {
    const ticket = ++generation.current;
    setProvider(id); setLocalAccounts([]); setDiscoveryError(null); setChecking(!!id);
    if (!id) return;
    try {
      const accounts = await loadSetupAccounts(await draft.getSession(), id);
      if (ticket === generation.current) setLocalAccounts(accounts);
    } catch (error) { if (ticket === generation.current) setDiscoveryError(prettyError(error)); }
    finally { if (ticket === generation.current) setChecking(false); }
  };
  const dirty = draft.selected.length > 0 || draft.editing || !!draft.pending;
  const selectedCount = draft.selected.length;
  useEffect(() => { onStatusChange({ dirty, busy: draft.busy || draft.loading || checking }); }, [dirty, draft.busy, draft.loading, checking, onStatusChange]);
  return <section className="workspace-setup provider-add-panel add-accounts-panel" data-motion="pointer"
    onPointerDownCapture={(event) => { event.currentTarget.dataset.motion = "pointer"; }}
    onKeyDownCapture={(event) => { event.currentTarget.dataset.motion = "keyboard"; }}>
    <div className="workspace-setup-scroll">
      <AccountEnrollment embedded initiallyOpen draft={draft} onAdded={onAccountAdded} reviewWorkspace={workspace.name}
        onProviderChange={(id) => void discover(id)}
        providerContent={provider ? <section className="provider-local" aria-label={`${PROVIDER_LABELS[provider]} accounts on this Mac`} aria-busy={checking}>
          <div className="provider-local-heading"><h3>On this Mac</h3><Button size="icon-sm" variant="ghost" aria-label="Check local accounts again" disabled={checking || draft.busy || draft.pending} onClick={() => void discover(provider)}><RefreshIcon size={15} /></Button></div>
          {discoveryError ? <p className="workspace-error" role="alert">{discoveryError}</p> : null}
          {checking ? <p className="provider-local-status" role="status"><SpinnerIcon size={16} />Verifying local accounts…</p> : null}
          {!checking && !localAccounts.length && !discoveryError ? <p className="provider-local-status">No verified local account found. Sign in with a paid subscription or connect an account below.</p> : null}
          {localAccounts.length ? <div className="provider-local-list">{localAccounts.map((account) => {
            const selected = draft.selected.includes(account.id);
            const unavailable = account.alreadyAdded || draft.busy || draft.pending;
            return <div className="provider-local-source" key={account.id}>
              <div className="provider-local-source-head"><strong>{accountSourceLabel(account)}</strong><span>{account.alreadyAdded ? "Already added" : selected ? "Selected" : "Available"}</span></div>
              <div className="provider-local-account"><div className="setup-account-identity"><div className="provider-local-name"><strong dir="auto">{account.displayName ?? account.name}</strong><PlanBadge subscription={account.subscription} /></div><span title={account.email ?? undefined}>{account.email || PROVIDER_LABELS[account.provider]}</span></div><Button size="sm" disabled={unavailable} aria-pressed={selected} onClick={() => selected ? draft.toggle(account.id) : draft.stage(account)}>{account.alreadyAdded ? "Added" : selected ? "Selected" : "Select"}</Button></div>
            </div>;
          })}</div> : null}
        </section> : null} />
    </div>
    {draft.accounts.length ? <footer className="add-accounts-footer">
      {draft.error ? <p className="workspace-error" role="alert">{draft.error}</p> : null}
      <div className="add-accounts-actions">
        <div className="add-accounts-selection">
          <span role="status">{selectedCount} selected</span>
          <Button size="sm" variant="ghost" aria-disabled={!selectedCount || draft.busy || draft.pending} onClick={() => {
            if (selectedCount && !draft.busy && !draft.pending) draft.selected.forEach(draft.toggle);
          }}>Clear selection</Button>
        </div>
        <Button variant="default" disabled={!selectedCount || draft.busy || checking || draft.pending || draft.editing} onClick={() => void draft.commit(workspace.name, workspace.accent, workspace.id).then((state) => { if (state) onSaved(state); })}>{draft.busy ? "Saving…" : "Add accounts"}</Button>
      </div>
    </footer> : null}
  </section>;
}
