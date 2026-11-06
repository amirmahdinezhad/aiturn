import { RefreshIcon, UsageIcon } from "../icons";
import { AppModal, ModalTarget } from "./AppModal";
import { Button } from "./ui/button";

/** A warning acknowledges only this destination in this workspace. */
export interface LimitedSwitchTarget {
  id: string;
  workspaceId: string;
  name: string;
  email: string | null;
  reset: string;
}

/** Capacity is advisory; continuing still requires confirmation for running threads. */
export function LimitedSwitchWarning({ target, busy, error, onClose, onContinue }: {
  target: LimitedSwitchTarget | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onContinue: () => void;
}) {
  return <ModalTarget target={target}>{(account, presence) => <AppModal {...presence} onClose={onClose} title="Account limit reached" cardClass="limit-switch-card" busy={busy} busyMessage="Starting account switch…">
    <div className="limit-switch-content">
      <div className="limit-switch-account"><span className="limit-switch-symbol"><UsageIcon size={20} /></span><div><strong>{account.name}</strong>{account.email ? <span>{account.email}</span> : null}</div></div>
      <p className="limit-switch-copy">Codex may be unavailable on this account until the limit resets.</p>
      <div className="limit-switch-reset"><RefreshIcon size={15} /><span>{account.reset}</span></div>
      {error ? <p className="limit-switch-error" role="alert">{error}</p> : null}
      <div className="limit-switch-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="default" disabled={busy} onClick={onContinue}>{busy ? "Starting switch…" : "Switch anyway"}</Button></div>
    </div>
  </AppModal>}</ModalTarget>;
}
