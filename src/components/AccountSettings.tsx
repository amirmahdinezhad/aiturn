import { useLayoutEffect, useRef, useState } from "react";
import { prettyError, removeWorkspaceAccount, type AccountProvider } from "../api";
import type { AppState, Workspace } from "../types";
import { AppModal } from "./AppModal";
import { Button } from "./ui/button";

interface Props {
  open?: boolean;
  onExited?: () => void;
  workspace: Workspace;
  provider: AccountProvider;
  profile: { id: string; name: string; email?: string | null };
  onClose: () => void;
  onChanged: (state: AppState) => void;
  onRename: (name: string) => Promise<void>;
}

/** Keep account identity and removal separate from workspace preferences. */
export function AccountSettings({ open = true, onExited, workspace, provider, profile, onClose, onChanged, onRename }: Props) {
  const [name, setName] = useState(profile.name);
  const [savedName, setSavedName] = useState(profile.name);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const keepAccount = useRef<HTMLButtonElement>(null);
  const removeAccount = useRef<HTMLButtonElement>(null);
  const previousConfirmation = useRef(false);
  useLayoutEffect(() => {
    if (confirmRemove) keepAccount.current?.focus();
    else if (previousConfirmation.current) removeAccount.current?.focus();
    previousConfirmation.current = confirmRemove;
  }, [confirmRemove]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (e) { setError(prettyError(e)); }
    finally { setBusy(false); }
  };
  const remove = (forget: boolean) => run(async () => {
    onChanged(await removeWorkspaceAccount(workspace.id, provider, profile.id, forget));
    onClose();
  });
  return <AppModal open={open} onExited={onExited} onClose={onClose} title="Edit account" cardClass="account-settings" busy={busy} hasUnsavedChanges={name.trim() !== savedName} detail={<div className="usage-identity"><strong>{profile.name}</strong>{profile.email ? <span>{profile.email}</span> : null}</div>}>
    {error ? <p className="workspace-error" role="alert">{error}</p> : null}
    <form className="workspace-form account-edit-form" onSubmit={(e) => {
      e.preventDefault();
      if (!name.trim() || name.trim() === savedName) return;
      void run(async () => {
        await onRename(name.trim());
        setSavedName(name.trim());
      });
    }}>
      <label>Account name<input aria-label="Account name" required maxLength={64} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /></label>
      <Button type="submit" variant="default" size="sm" disabled={busy || !name.trim() || name.trim() === savedName}>Save name</Button>
    </form>
    <div className={`workspace-remove${confirmRemove ? " is-confirming" : ""}`}>{confirmRemove ? <>
      <p>Remove {profile.name} from this workspace or forget it everywhere? The active CLI login stays signed in.</p>
      <Button ref={keepAccount} disabled={busy} onClick={() => setConfirmRemove(false)}>Keep account</Button>
      <Button variant="destructive" disabled={busy} onClick={() => void remove(false)}>Remove from this workspace</Button>
      <Button variant="destructive" disabled={busy} onClick={() => void remove(true)}>Forget in all workspaces</Button>
    </> : <Button ref={removeAccount} variant="destructive" size="sm" disabled={busy} onClick={() => setConfirmRemove(true)}>Remove account</Button>}</div>
  </AppModal>;
}
