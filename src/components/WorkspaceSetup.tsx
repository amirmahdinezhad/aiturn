import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { importWorkspaceAccount, prettyError, type WorkspaceImport } from "../api";
import { DESIGN_ACCENT } from "../displayPrefs";
import type { AppState, Workspace } from "../types";
import { Button } from "./ui/button";
import { PrevIcon } from "../icons";
import { AuthFileInput, type AuthFileSelection } from "./AuthFileInput";
import { SetupSteps } from "./SetupSteps";
import { AccountEnrollment, EnrollmentAccounts, useAccountEnrollment } from "./AccountEnrollment";

export interface DraftStatus { dirty: boolean; busy: boolean }
interface AccountDraft { accountName: string; file?: AuthFileSelection | null }

/** Choose or drop a login; drafts stay in memory until one native save. */
export function WorkspaceAccountForm({ onSave, submitLabel, onStatusChange, initialDraft, onDraftChange, formId, showActions = true }: {
  onSave: (account: WorkspaceImport) => Promise<void>; submitLabel: string;
  onStatusChange?: (status: DraftStatus) => void;
  formId?: string; showActions?: boolean;
  initialDraft?: AccountDraft;
  onDraftChange?: (draft: AccountDraft) => void;
}) {
  const accountName = initialDraft?.accountName ?? "";
  const [file, setFile] = useState<AuthFileSelection | null>(initialDraft?.file ?? null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = busy || reading;
  const dirty = !!file;
  useEffect(() => { onStatusChange?.({ dirty, busy: locked }); }, [dirty, locked, onStatusChange]);
  useEffect(() => () => onStatusChange?.({ dirty: false, busy: false }), [onStatusChange]);
  useEffect(() => { onDraftChange?.({ accountName, file }); }, [accountName, file, onDraftChange]);
  const source = file && "credentials" in file ? { credentials: file.credentials } : { path: file?.path ?? "" };
  return <form id={formId} className="workspace-form" aria-busy={locked} onSubmit={(e) => {
    e.preventDefault();
    if (locked) return;
    setBusy(true); setError(null);
    void onSave({ accountName: accountName.trim(), ...source })
      .then(() => { setFile(null); })
      .catch((e) => setError(prettyError(e))).finally(() => setBusy(false));
  }}>
    <AuthFileInput value={file} disabled={busy} onReadingChange={setReading} onChange={(next) => { setFile(next); setError(null); }} />
    {error ? <p className="workspace-error" role="alert">{error}</p> : null}
    {showActions ? <div className="workspace-form-actions">
      <Button type="submit" variant="default" disabled={locked || !file}>{busy ? "Saving…" : submitLabel}</Button>
    </div> : null}
  </form>;
}

/** Identity first; discovery and explicit account selection belong to the second step. */
export function WorkspaceSetup({ onCreated, onStatusChange, step, onStepChange, onAccountAdded }: {
  onCreated: (state: AppState) => void; onStatusChange?: (status: DraftStatus) => void;
  step: number; onStepChange: (step: number) => void; onAccountAdded?: () => void;
}) {
  const identityFormId = useId();
  const previousStep = useRef(step);
  const direction = step < previousStep.current ? -1 : 1;
  useEffect(() => { previousStep.current = step; }, [step]);
  const [name, setName] = useState("");
  const draft = useAccountEnrollment();
  const discoveryStarted = useRef(false);
  useEffect(() => {
    if (step !== 1 || discoveryStarted.current) return;
    discoveryStarted.current = true;
    void draft.load();
  }, [step, draft.load]);
  const dirty = !!name || draft.selected.length > 0 || draft.editing || draft.pending;
  useEffect(() => { onStatusChange?.({ dirty: !!dirty, busy: draft.busy }); }, [dirty, draft.busy, onStatusChange]);
  useEffect(() => () => onStatusChange?.({ dirty: false, busy: false }), [onStatusChange]);
  const save = async () => { const state = await draft.commit(name.trim(), DESIGN_ACCENT); if (state) onCreated(state); };
  return <section className="workspace-setup workspace-setup-wizard" aria-label="Create workspace" data-motion="pointer"
    onPointerDownCapture={(event) => { event.currentTarget.dataset.motion = "pointer"; }}
    onKeyDownCapture={(event) => { event.currentTarget.dataset.motion = "keyboard"; }}>
    <div className="workspace-setup-header"><SetupSteps labels={["Workspace", "Load accounts", "Add accounts"]} current={step} label={`Step ${step + 1} of 3`} /></div>
    <div className={`workspace-setup-scroll${step === 2 ? " is-add-account" : ""}`}>
      <div key={step} className={`setup-page${step === 2 ? " setup-page-add-account" : ""}`} style={{ "--page-offset": `${direction * 8}px` } as CSSProperties}>
      <h2>{step === 0 ? "Make it your workspace" : step === 1 ? "Load your accounts" : "Add a new account"}</h2>
      <p className="workspace-intro">{step === 0 ? "Give this workspace a name to organize its accounts." : step === 1 ? "We’ll check this Mac for eligible accounts. Choose which ones to add." : "Optional: add another account, or create your workspace with your selected accounts."}</p>
      {draft.error ? <p className="workspace-error" role="alert">{draft.error}</p> : null}
      {step === 0 ? <form id={identityFormId} className="workspace-form" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onStepChange(1); }}>
        <label>Workspace name<input aria-label="Workspace name" value={name} autoFocus required maxLength={64} placeholder="My workspace" onChange={(e) => setName(e.target.value)} /></label>
      </form> : step === 1 ? <>
        <EnrollmentAccounts draft={draft} />
      </> : null}
      </div>
      <div hidden={step !== 2}><AccountEnrollment draft={draft} onAdded={onAccountAdded} /></div>
    </div>
    <footer className="workspace-setup-footer"><div className="workspace-form-actions">
      {step > 0 ? <Button size="sm" variant="ghost" className="workspace-back-button" disabled={draft.busy || draft.pending} onClick={() => onStepChange(step - 1)}><PrevIcon size={14} />Back</Button> : null}
      {step === 0 ? <Button size="sm" form={identityFormId} type="submit" variant="default" disabled={!name.trim()}>Next</Button>
        : step === 1 ? <Button size="sm" variant="default" disabled={draft.busy || draft.loading} onClick={() => onStepChange(2)}>Next</Button>
        : <Button size="sm" variant="default" disabled={draft.busy || draft.loading || draft.pending || draft.editing || !draft.selected.length} onClick={() => void save()}>{draft.busy ? "Saving…" : "Create workspace"}</Button>}
    </div></footer>
  </section>;
}

/** Add another account to the selected workspace, preserving the active Codex login. */
export function WorkspaceImportAccount({ workspace, onImported, onStatusChange }: { workspace: Workspace; onImported: (state: AppState) => void; onStatusChange?: (status: DraftStatus) => void }) {
  return <><p className="workspace-intro">Import the auth.json from a Codex login. Choose or drop the file from ~/.codex.</p><WorkspaceAccountForm submitLabel="Add account" onStatusChange={onStatusChange} onSave={async (account) => onImported(await importWorkspaceAccount(workspace.id, account))} /></>;
}
