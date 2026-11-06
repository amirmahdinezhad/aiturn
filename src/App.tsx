import { activeProviderAccountId } from "./accountActivity";
import { codexAccountPreferences } from "./accountPrefs";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { type AppState, type ClaudeProfile, type CodexProfilesState } from "./types";
import {
  activateCodexProfile,
  cliStatus,
  editClaudeProfile,
  renameCodexProfile,
  codexProfiles,
  claudeProfiles,
  codexProfileQuota,
  getState,
  prettyError,
  quitApp,
  selectWorkspace,
  includeWorkspaceProvider,
  type ProviderCliStatus,
} from "./api";
import { loadDisplayPrefs, applyDisplayPrefs, type DisplayPrefs } from "./displayPrefs";
import { CliProviders } from "./components/CliProviders";
import { listen } from "@tauri-apps/api/event";
import type { DraftStatus } from "./components/WorkspaceSetup";
import { WorkspaceAccounts, useWorkspaceQuotas } from "./components/WorkspaceAccounts";
import { CodexRestartBanner, useCodexRestart } from "./components/CodexRestartBanner";
import { AppModal, ModalTarget } from "./components/AppModal";
import { accountLimitText, nextUsableAccount } from "./accountLimits";
import { EmptyState } from "./components/EmptyState";
import { Toast, showToast, type ToastKind } from "./components/Toast";
import { LimitedSwitchWarning, type LimitedSwitchTarget } from "./components/LimitedSwitchWarning";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { HomeActions, HomeHeader } from "./components/HomeChrome";

const SettingsModal = lazy(() => import("./components/SettingsModal").then(({ SettingsModal }) => ({ default: SettingsModal })));
const AddAccountsPanel = lazy(() => import("./components/AddAccountsPanel").then(({ AddAccountsPanel }) => ({ default: AddAccountsPanel })));
const ClaudeProfilesModal = lazy(() => import("./components/ClaudeProfilesModal").then(({ ClaudeProfilesModal }) => ({ default: ClaudeProfilesModal })));
const WorkspaceSetup = lazy(() => import("./components/WorkspaceSetup").then(({ WorkspaceSetup }) => ({ default: WorkspaceSetup })));
const WorkspaceImportAccount = lazy(() => import("./components/WorkspaceSetup").then(({ WorkspaceImportAccount }) => ({ default: WorkspaceImportAccount })));
const AccountSettings = lazy(() => import("./components/AccountSettings").then(({ AccountSettings }) => ({ default: AccountSettings })));
const AntigravityAccounts = lazy(() => import("./components/AntigravityAccounts").then(({ AntigravityAccounts }) => ({ default: AntigravityAccounts })));
const ReconnectAccount = lazy(() => import("./components/ReconnectAccount").then(({ ReconnectAccount }) => ({ default: ReconnectAccount })));
const WorkspaceSettings = lazy(() => import("./components/WorkspaceSettings").then(({ WorkspaceSettings }) => ({ default: WorkspaceSettings })));
const CodexUsageModal = lazy(() => import("./components/CodexUsageModal").then(({ CodexUsageModal }) => ({ default: CodexUsageModal })));

/** Keep the tray panel mounted and coordinate status refresh, setup and popups. */
export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [limitedTarget, setLimitedTarget] = useState<LimitedSwitchTarget | null>(null);
  const checkingSwitch = useRef(false);
  const [limitSwitchError, setLimitSwitchError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cli, setCli] = useState<ProviderCliStatus[] | null>(null);
  const [cliError, setCliError] = useState<string | null>(null);
  // A null value defers loading until the first open. Closed settings retain their state.
  const [settingsOpen, setSettingsOpen] = useState<boolean | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [claudeProfilesOpen, setClaudeProfilesOpen] = useState<boolean | null>(null);
  const [claudeCreate, setClaudeCreate] = useState(false);
  const [claudeManagedId, setClaudeManagedId] = useState<string | undefined>();
  const [claudeAccounts, setClaudeAccounts] = useState<ClaudeProfile[]>([]);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState<boolean | null>(null);
  const [claudeSettingsId, setClaudeSettingsId] = useState<string | null>(null);
  const [accountSettingsId, setAccountSettingsId] = useState<string | null>(null);
  const [bankedResetId, setBankedResetId] = useState<string | null>(null);
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  const [workspaceSection, setWorkspaceSection] = useState("general");
  const [createOpen, setCreateOpen] = useState(false);
  const createOrigin = useRef<HTMLElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [createStep, setCreateStep] = useState(0);
  const [, setSetupDraft] = useState<DraftStatus>({ dirty: false, busy: false });
  const [createDraft, setCreateDraft] = useState<DraftStatus>({ dirty: false, busy: false });
  const [importDraft, setImportDraft] = useState<DraftStatus>({ dirty: false, busy: false });
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [checkingAccountId, setCheckingAccountId] = useState<string | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<CodexProfilesState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [display, setDisplay] = useState<DisplayPrefs>(() => loadDisplayPrefs());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const refreshGeneration = useRef(0);
  const profilesGeneration = useRef(0);
  const loadGeneration = useRef(0);
  const workspace = state?.app.workspaces?.find((w) => w.id === state.app.activeWorkspaceId);
  const latestWorkspace = useRef(workspace);
  latestWorkspace.current = workspace;
  const workspaceProfiles = useMemo(() => (workspace?.accountIds ?? []).flatMap((id) => profiles?.profiles.find((p) => p.id === id) ?? []), [workspace, profiles]);
  const quotas = useWorkspaceQuotas(workspaceProfiles, workspace?.id, usageRefreshKey);
  const claudeSettingsAccount = claudeAccounts.find((p) => p.id === claudeSettingsId && (workspace?.claudeAccountIds == null || workspace.claudeAccountIds.includes(p.id)));
  const reconnectAccount = workspaceProfiles.find((p) => p.id === reconnectId);
  const settingsAccount = workspaceProfiles.find((p) => p.id === accountSettingsId);
  const bankedResetAccount = workspaceProfiles.find((profile) => profile.id === bankedResetId);

  const notify = useCallback((message: string, kind: ToastKind = "") => {
    if (kind === "err") setLastError(message);
    else if (kind === "ok") setLastError(null);
    showToast(message, kind);
  }, []);

  const applyState = useCallback((s: AppState) => {
    setLoadError(null);
    setState(s);
  }, []);

  const applyProfiles = useCallback((fresh: CodexProfilesState) => {
    const ticket = ++profilesGeneration.current;
    setProfiles(fresh);
    setUsageRefreshKey((key) => key + 1);
    setProfilesError(null);
    void getState().then((fresh) => { if (ticket === profilesGeneration.current) applyState(fresh); }).catch((e) => notify(prettyError(e), "err"));
  }, [applyState, notify]);

  const refreshProviders = useCallback(async () => {
    const ticket = ++refreshGeneration.current;
    const fresh = await cliStatus();
    if (ticket !== refreshGeneration.current) return fresh;
    setCli(fresh);
    setCliError(null);
    return fresh;
  }, []);

  const load = useCallback(async () => {
    const loadTicket = ++loadGeneration.current;
    setRefreshing(true);
    setUsageRefreshKey((previous) => previous + 1);
    let hasWorkspace = false;
    try {
      const fresh = await getState();
      hasWorkspace = fresh.app.workspaces.length > 0;
      if (loadTicket === loadGeneration.current) applyState(fresh);
    } catch (e) {
      if (loadTicket === loadGeneration.current) {
        setState(null);
        setLoadError(`Couldn't load settings: ${prettyError(e)}`);
      }
    }
    if (loadTicket !== loadGeneration.current) return;
    if (!hasWorkspace) { setRefreshing(false); return; }
    const providers = refreshProviders().catch((e) => {
      if (loadTicket === loadGeneration.current) {
        setCli(null);
        setCliError(`Couldn't read CLI status: ${prettyError(e)}`);
      }
    });
    // Saved Claude configurations can exist independently of the default CLI login.
    void claudeProfiles().then((fresh) => { if (loadTicket === loadGeneration.current) setClaudeAccounts(fresh); })
      .catch(() => { if (loadTicket === loadGeneration.current) setClaudeAccounts([]); });
    const ticket = ++profilesGeneration.current;
    try {
      const fresh = await codexProfiles();
      if (ticket === profilesGeneration.current) { setProfiles(fresh); setProfilesError(null); }
      if (loadTicket === loadGeneration.current) setLastUpdated(new Date().toISOString());
    } catch (error) {
      if (ticket === profilesGeneration.current) { setProfiles(null); setProfilesError(prettyError(error)); }
    } finally {
      await providers;
      if (loadTicket === loadGeneration.current) setRefreshing(false);
    }
  }, [applyState, refreshProviders]);

  const completedSwitch = useCallback((id: string) => {
    profilesGeneration.current++;
    setState((current) => current ? { ...current, app: { ...current.app, workspaces: current.app.workspaces.map((w) => {
      if (!w.accountIds.includes(id)) return w;
      return { ...w, usage: { ...w.usage, activeAccounts: { ...w.usage.activeAccounts, codex: id },
        ...(w.id === current.app.activeWorkspaceId && (w.usage.menuBarProvider ?? "codex") === "codex" ? { menuBarAccountId: id } : {}) } };
    }) } } : current);
    setProfiles((current) => current ? { ...current, activeProfileId: id, profiles: current.profiles.map((p) => ({ ...p, active: p.id === id, needsActivation: p.id === id ? false : p.needsActivation })) } : current);
    void load();
  }, [load]);
  const restart = useCodexRestart(notify, completedSwitch);
  const changeState = useCallback((fresh: AppState) => {
    loadGeneration.current++;
    refreshGeneration.current++;
    profilesGeneration.current++;
    setRefreshing(false);
    setBankedResetId(null);
    applyState(fresh);
  }, [applyState]);

  const imported = useCallback((fresh: AppState) => {
    changeState(fresh); setCreateOpen(false); setImportOpen(false); setAddOpen(false);
    void refreshProviders().catch((e) => setCliError(prettyError(e)));
    void claudeProfiles().then(setClaudeAccounts).catch(() => {});
    void codexProfiles().then(applyProfiles).catch((e) => notify(prettyError(e), "err"));
    setUsageRefreshKey((key) => key + 1);
  }, [changeState, applyProfiles, notify, refreshProviders]);

  const switchCodex = async (id: string, allowLimited = false, desktopInstalled = profiles?.desktopInstalled) => {
    if (desktopInstalled !== false) {
      await restart.schedule(id, allowLimited);
      return;
    }
    applyProfiles(await activateCodexProfile(id));
    completedSwitch(id);
    notify("Account active. Start a new Codex CLI session to use it.", "ok");
  };

  const activate = async (id: string) => {
    if (restart.busy || workspaceBusy || checkingSwitch.current || !workspace?.accountIds.includes(id)) return;
    checkingSwitch.current = true;
    setWorkspaceBusy(true);
    setCheckingAccountId(id);
    const workspaceId = workspace.id;
    const name = profiles?.profiles.find((p) => p.id === id)?.name ?? "This account";
    try {
      const fresh = await codexProfileQuota(id);
      if (latestWorkspace.current?.id !== workspaceId || !latestWorkspace.current.accountIds.includes(id)) return;
      if (fresh.error) throw new Error(`Couldn’t check ${name}’s limits. ${fresh.error}`);
      const reset = accountLimitText(fresh, Date.now());
      if (reset) { setLimitSwitchError(null); setLimitedTarget({ id, workspaceId, name, email: profiles?.profiles.find((p) => p.id === id)?.email ?? null, reset }); return; }
      await switchCodex(id);
    } catch (e) { notify(prettyError(e), "err"); }
    finally { checkingSwitch.current = false; setWorkspaceBusy(false); setCheckingAccountId(null); }
  };

  const continueLimitedSwitch = async () => {
    if (!limitedTarget || restart.busy || checkingSwitch.current || workspaceBusy) return;
    if (latestWorkspace.current?.id !== limitedTarget.workspaceId || !latestWorkspace.current.accountIds.includes(limitedTarget.id)) {
      setLimitedTarget(null); return;
    }
    checkingSwitch.current = true; setWorkspaceBusy(true); setLimitSwitchError(null);
    try {
      await switchCodex(limitedTarget.id, true);
      setLimitedTarget(null);
    } catch (e) { setLimitSwitchError(prettyError(e)); }
    finally { checkingSwitch.current = false; setWorkspaceBusy(false); }
  };

  useEffect(() => {
    if (limitedTarget && (workspace?.id !== limitedTarget.workspaceId || !workspace.accountIds.includes(limitedTarget.id))) {
      setLimitedTarget(null); setLimitSwitchError(null);
    }
  }, [workspace, limitedTarget]);

  const quickSwitch = async (activeId: string) => {
    if (restart.busy || workspaceBusy || !workspace || !state) return;
    setWorkspaceBusy(true);
    try {
      const freshProfiles = await codexProfiles();
      if (freshProfiles.activeProfileId !== activeId) throw new Error("The active account changed. Refresh and try again.");
      const accounts = workspace.accountIds.flatMap((id) => freshProfiles.profiles.find((p) => p.id === id) ?? []);
      const freshQuotas = Object.fromEntries(await Promise.all(accounts.filter((p) => p.connected).map(async (p) => [p.id, await codexProfileQuota(p.id).catch(() => null)])));
      if (!accountLimitText(freshQuotas[activeId], Date.now())) throw new Error("This account is no longer limited. Refresh to check its usage.");
      const target = nextUsableAccount(accounts, activeId, freshQuotas, Date.now(), Object.fromEntries(accounts.map((p) => [p.id, codexAccountPreferences(state.app, p.id).knownWindows])));
      if (!target) throw new Error("No other account has available capacity.");
      if (latestWorkspace.current?.id !== workspace.id || !latestWorkspace.current.accountIds.includes(activeId) || !latestWorkspace.current.accountIds.includes(target.id)) throw new Error("Workspace accounts changed. Try again.");
      await switchCodex(target.id, false, freshProfiles.desktopInstalled);
    } catch (e) { notify(prettyError(e), "err"); }
    finally { setWorkspaceBusy(false); }
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void listen<string>("codex-profile-switched", (event) => { if (typeof event.payload === "string") completedSwitch(event.payload); else void load(); })
      .then((unlisten) => { if (disposed) unlisten(); else stop = unlisten; })
      .catch(() => { /* Browser previews have no native event bridge. */ });
    return () => { disposed = true; stop?.(); };
  }, [load, completedSwitch]);

  // Theme + accent paint <html> instantly and persist via displayPrefs.
  useEffect(() => {
    applyDisplayPrefs(display);
  }, [display]);


  // When following the OS, re-resolve on OS changes without a reload.
  useEffect(() => {
    if (display.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyDisplayPrefs(display);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [display]);
  // Show the mounted panel immediately. Refresh on focus is opt-in; while
  // the panel is open, keep data current at the configured interval.
  const refreshIntervalSecs = state?.app?.refreshIntervalSecs ?? 60;
  const refreshOnFocus = display.refreshOnFocus;
  useEffect(() => {
    const onFocus = () => {
      if (refreshOnFocus) void load();
    };
    window.addEventListener("focus", onFocus);
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const drift = now - last - refreshIntervalSecs * 1000;
      last = now;
      const woke = drift > 10_000;
      if (document.hasFocus() || woke) void load();
    }, refreshIntervalSecs * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [load, refreshIntervalSecs, refreshOnFocus]);

  const includeProvider = async (providerId: string) => {
    if (!workspace || workspace.providerIds == null || workspace.providerIds.includes(providerId)) return;
    changeState(await includeWorkspaceProvider(workspace.id, providerId));
  };

  const openCreate = (origin?: HTMLElement) => {
    createOrigin.current = origin ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setCreateStep(0); setCreateOpen(true);
  };

  const scopedStatuses = (cli ?? []).filter((s) => s.id !== "codex" && !(s.id === "claude" && workspace?.claudeAccountIds != null) && (workspace?.providerIds == null || workspace.providerIds.includes(s.id)));
  const scopedClaude = useMemo(() => {
    if (workspace?.providerIds && !workspace.providerIds.includes("claude")) return [];
    const activeId = workspace ? activeProviderAccountId("claude", workspace, claudeAccounts) : null;
    return claudeAccounts
      .filter((account) => workspace?.claudeAccountIds == null || workspace.claudeAccountIds.includes(account.id))
      .map((account) => ({ ...account, active: account.id === activeId }));
  }, [workspace, claudeAccounts]);
  const hasWorkspaceAccounts = !!(workspace?.accountIds.length || workspace?.claudeAccountIds?.length || workspace?.antigravityAccountIds?.length || scopedClaude.length || scopedStatuses.some(status => status.binaryFound && status.loggedIn === true));

  return (
    <>
      <HomeHeader workspace={workspace} workspaces={state?.app.workspaces ?? []} workspaceBusy={workspaceBusy} refreshing={refreshing} updatedAt={lastUpdated}
        onSelect={(id) => { setWorkspaceBusy(true); void selectWorkspace(id).then(changeState).catch((e) => notify(prettyError(e), "err")).finally(() => setWorkspaceBusy(false)); }}
        onRefresh={() => void load()} onWorkspaceSettings={() => { setWorkspaceSection("general"); setWorkspaceSettingsOpen(true); }} onQuit={() => void quitApp()} onCreate={openCreate} />

      <CodexRestartBanner restart={restart} />

      {lastError && (
        <div className="error-panel" role="alert">
          <div className="error-head">
            <span className="error-title">{lastError.split("\n")[0]}</span>
            <span className="error-actions">
              <Button
                type="button"
                className="link-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(lastError);
                    showToast("Error details copied", "ok");
                  } catch {
                    showToast("Couldn’t copy error details", "err");
                  }
                }}
              >
                Copy
              </Button>
              <Button
                type="button"
                className="link-btn"
                onClick={() => setLastError(null)}
              >
                Dismiss
              </Button>
            </span>
          </div>
          {lastError.includes("\n") && (
            <details className="error-details">
              <summary>Details</summary>
              <pre className="error-text">{lastError}</pre>
            </details>
          )}
        </div>
      )}

      <main className="providers home-accounts" aria-label="Accounts">
        {!workspace ? <h1 className="sr-only">Aiturn</h1> : null}
        {loadError ? (
          <EmptyState headingLevel={2} title="Unable to load accounts" message={loadError} action={<Button onClick={() => void load()} disabled={refreshing}>Try again</Button>} />
        ) : !state ? (
          <LoadingSkeleton />
        ) : !workspace ? (
          <Suspense fallback={<LoadingSkeleton />}>
            <WorkspaceSetup onAccountAdded={() => notify("Account added", "ok")} step={setupStep} onStepChange={setSetupStep} onCreated={imported} onStatusChange={setSetupDraft} />
          </Suspense>
        ) : (
          <>
          {!hasWorkspaceAccounts && profiles && cli && !refreshing && !profilesError && !cliError ? <EmptyState headingLevel={2} title="Your workspace is ready" message="Add your first account to see its usage limits here." /> : null}
          {profilesError ? <div className="home-inline-error" role="alert"><p>Couldn’t load accounts: {profilesError}</p><Button size="sm" disabled={refreshing} onClick={() => void load()}>Retry</Button></div> : <WorkspaceAccounts
            workspace={workspace} profiles={profiles} app={state.app} quotas={quotas} busy={restart.busy || workspaceBusy} checkingId={checkingAccountId}
            switchingId={restart.busy ? restart.status?.profileId : undefined}
            onManage={setAccountSettingsId} onReconnect={setReconnectId} onBankedReset={setBankedResetId}
            onActivate={(id) => void activate(id)} onQuickSwitch={(id) => void quickSwitch(id)} />}
          {workspace.antigravityAccountIds?.length ? (
            <Suspense fallback={<LoadingSkeleton variant="cards" count={workspace.antigravityAccountIds.length} />}>
              <AntigravityAccounts workspace={workspace} refreshKey={usageRefreshKey} onChanged={changeState} />
            </Suspense>
          ) : null}
          {cliError ? <div className="home-inline-error" role="alert"><p>{cliError}</p><Button size="sm" disabled={refreshing} onClick={() => void load()}>Retry</Button></div> : null}
          <CliProviders
            statuses={scopedStatuses}
            claudeAccounts={scopedClaude}
            refreshKey={usageRefreshKey}
            showRemaining={state.app.usageShowRemaining}
            usageAppearance={state.app.usageAppearance}
            sectionLabel="Other providers"
            onManageClaude={(id) => { if (id) setClaudeSettingsId(id); else { setClaudeCreate(false); setClaudeManagedId(undefined); setClaudeProfilesOpen(true); } }}
            compactRows={display.compactRows}
            notify={notify}
            onAddAccount={() => setAddOpen(true)}
          />
          </>
        )}
      </main>
      {workspace ? <HomeActions busy={workspaceBusy || restart.busy} onAdd={() => setAddOpen(true)}
        onSettings={() => setSettingsOpen(true)} onQuit={() => void quitApp()} /> : null}
      <Suspense fallback={null}>{settingsOpen !== null || display.checkUpdatesOnLaunch ? <SettingsModal
        open={settingsOpen === true}
        onClose={() => setSettingsOpen(false)}
        state={state}
        onChanged={changeState}
        notify={notify}
        display={display}
        onDisplayChanged={setDisplay}
      /> : null}</Suspense>
      <Suspense fallback={null}><AppModal open={addOpen && !!workspace} onClose={() => setAddOpen(false)} title="Add Account" cardClass="add-accounts-card" hasUnsavedChanges={importDraft.dirty} busy={importDraft.busy}>
        {workspace ? <AddAccountsPanel onAccountAdded={() => notify("Account added", "ok")} workspace={workspace} onSaved={imported} onStatusChange={setImportDraft} /> : null}
      </AppModal></Suspense>
      <LimitedSwitchWarning target={limitedTarget} busy={workspaceBusy || restart.pending} error={limitSwitchError} onClose={() => { setLimitedTarget(null); setLimitSwitchError(null); }} onContinue={() => void continueLimitedSwitch()} />
      <Suspense fallback={null}>{claudeProfilesOpen !== null ? <ClaudeProfilesModal open={claudeProfilesOpen} onClose={() => setClaudeProfilesOpen(false)}
        initialCreate={claudeCreate} initialProfileId={claudeManagedId} onProfilesChanged={(fresh) => { setClaudeAccounts(fresh); if (claudeCreate && fresh.length) void includeProvider("claude").catch((e) => notify(prettyError(e), "err")); }}
        onCodex={() => {setClaudeProfilesOpen(false);setImportOpen(true);}} appState={state} onAppChanged={changeState} notify={notify} /> : null}</Suspense>
      <Suspense fallback={null}>{workspace ? <ModalTarget target={claudeSettingsAccount}>{(account, presence) => <AccountSettings {...presence} key={`${workspace.id}:claude:${account.id}`} workspace={workspace} provider="claude" profile={account} onClose={() => setClaudeSettingsId(null)} onChanged={changeState} onRename={async (name) => setClaudeAccounts(await editClaudeProfile(account.id, name))} />}</ModalTarget> : null}</Suspense>
      <Suspense fallback={null}>{workspace ? <ModalTarget target={settingsAccount}>{(account, presence) => <AccountSettings {...presence} key={`${workspace.id}:${account.id}`} workspace={workspace} provider="codex" profile={account} onClose={() => setAccountSettingsId(null)} onChanged={changeState} onRename={async (name) => applyProfiles(await renameCodexProfile(account.id, name))} />}</ModalTarget> : null}</Suspense>
      <Suspense fallback={null}>{workspace ? <ModalTarget target={bankedResetAccount}>{(account, presence) => <CodexUsageModal {...presence} key={`${workspace.id}:${account.id}`} profile={account} refreshKey={usageRefreshKey}
        onClose={() => setBankedResetId(null)} onUsed={() => setUsageRefreshKey(key => key + 1)} notify={notify} />}</ModalTarget> : null}</Suspense>
      <Suspense fallback={null}>{workspace && state && workspaceSettingsOpen !== null ? <WorkspaceSettings claudeAccounts={claudeAccounts} open={workspaceSettingsOpen} workspace={workspace} state={state} profiles={profiles} initialSection={workspaceSection} onClose={() => setWorkspaceSettingsOpen(false)} onChanged={changeState} notify={notify} /> : null}</Suspense>
      <Suspense fallback={null}><ModalTarget target={reconnectAccount}>{(account, presence) => <ReconnectAccount {...presence} key={`${workspace?.id}:${account.id}`} profile={account} onClose={() => setReconnectId(null)} onProfilesChanged={applyProfiles} notify={notify} />}</ModalTarget></Suspense>
      <Suspense fallback={null}><AppModal open={createOpen} returnFocusRef={createOrigin} hasUnsavedChanges={createDraft.dirty} busy={createDraft.busy} onClose={() => { setCreateOpen(false); }} title="Create workspace" cardClass="workspace-setup-card"><WorkspaceSetup onAccountAdded={() => notify("Account added", "ok")} step={createStep} onStepChange={setCreateStep} onCreated={imported} onStatusChange={setCreateDraft} /></AppModal></Suspense>
      <Suspense fallback={null}><AppModal open={importOpen && !!workspace} hasUnsavedChanges={importDraft.dirty} busy={importDraft.busy} onClose={() => setImportOpen(false)} onBack={() => { setImportOpen(false); setAddOpen(true); }} backLabel="All providers" title="Add Codex account">{workspace ? <WorkspaceImportAccount workspace={workspace} onImported={imported} onStatusChange={setImportDraft} /> : null}</AppModal></Suspense>
      <Toast theme={display.theme} />
    </>
  );
}
