import { useEffect, useLayoutEffect, useId, useState, type ReactNode } from "react";
import { prettyError, setCodexAccountPreferences, updateWorkspace, antigravityAccounts, type SetupAccount } from "../api";
import { codexAccountPreferences } from "../accountPrefs";
import type { AppState, CodexProfilesState, Workspace, WorkspaceUsage, ClaudeProfile } from "../types";
import { AppModal } from "./AppModal";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent, segmentStyle } from "./ui/tabs";
import type { ToastKind } from "./Toast";
import { WorkspaceMenuBar } from "./WorkspaceMenuBar";

const WORKSPACE_TABS = [["general", "General"], ["usage", "Usage"], ["menu-bar", "Menu bar"]] as const;

const EMPTY_CLAUDE_ACCOUNTS: ClaudeProfile[] = [];

function Row({ name, description, descriptionId, children }: { name: string; description?: string; descriptionId?: string; children: ReactNode }) {
  return <div className="setting-row"><div className="setting-text"><span className="setting-name">{name}</span>{description ? <span className="setting-desc" id={descriptionId}>{description}</span> : null}</div>{children}</div>;
}

interface Props {
  open: boolean; workspace: Workspace; state: AppState; profiles: CodexProfilesState | null;
  onClose: () => void; onChanged: (state: AppState) => void;
  notify: (message: string, kind?: ToastKind) => void;
  initialSection?: string;
  claudeAccounts?: ClaudeProfile[];
}

/** Workspace identity and usage policy; account management lives on account cards. */
export function WorkspaceSettings({ open, workspace, state, profiles, initialSection = "general", claudeAccounts = EMPTY_CLAUDE_ACCOUNTS, onClose, onChanged, notify }: Props) {
  const [googleAccounts, setGoogleAccounts] = useState<SetupAccount[]>([]);
  useEffect(() => { if (!open) return; let current = true; void antigravityAccounts().then((a) => { if (current) setGoogleAccounts(a); }).catch(() => {}); return () => { current = false; }; }, [open, workspace.id]);
  const descriptionPrefix = useId();
  const [tab, setTab] = useState("general");
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accounts = workspace.accountIds.map((id) => profiles?.profiles.find((p) => p.id === id)).filter((p) => !!p);
  useLayoutEffect(() => {
    const body = document.getElementById("workspace-settings-body");
    if (body) body.scrollTop = 0;
  }, [tab]);
  useEffect(() => {
    if (!open) return;
    setKeyboardNavigation(true);
    setTab(["usage", "menu-bar"].includes(initialSection) ? initialSection : "general");
    setName(workspace.name); setError(null);
  }, [open, workspace.id, initialSection]);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); } catch (e) { setError(prettyError(e)); }
    finally { setBusy(false); }
  };
  const saveUsage = (patch: Partial<WorkspaceUsage>) => run(async () => onChanged(await updateWorkspace({ ...workspace, usage: { ...workspace.usage, ...patch } })));
  const toggle = (label: string, checked: boolean, patch: (value: boolean) => Partial<WorkspaceUsage>, description?: string) => {
    const descriptionId = `${descriptionPrefix}-${label.toLowerCase().replace(/ /g, "-")}`;
    return <Row name={label} description={description} descriptionId={descriptionId}><Switch aria-label={label} aria-describedby={description ? descriptionId : undefined} checked={checked} disabled={busy} onCheckedChange={(value) => void saveUsage(patch(value))} /></Row>;
  };
  const colorThresholds = workspace.usage.warningThresholds ?? [75, 90, 95];
  const colorLevels = [75, 90, 95];
  return <Tabs value={tab} onValueChange={(next) => { setTab(next); setError(null); }}>
    <AppModal open={open} onClose={onClose} busy={busy} hasUnsavedChanges={name.trim() !== workspace.name} title="Workspace settings" cardClass={`workspace-settings-card ${keyboardNavigation ? "is-keyboard" : "is-pointer"}`} bodyId="workspace-settings-body" navigation={
      <TabsList className="workspace-tabs ios-segments" aria-label="Workspace settings sections"
        style={segmentStyle(WORKSPACE_TABS.length, WORKSPACE_TABS.findIndex(([id]) => id === tab), keyboardNavigation)}
        onPointerDownCapture={() => setKeyboardNavigation(false)}
        onKeyDownCapture={() => setKeyboardNavigation(true)}>{WORKSPACE_TABS.map(([value, label]) => <TabsTrigger key={value} value={value} disabled={busy}>{label}</TabsTrigger>)}</TabsList>
    }>
      {error ? <p className="workspace-error" role="alert">{error}</p> : null}
      <TabsContent value="general" className="workspace-general">
        <div className="page-intro"><h3>Workspace identity</h3><p>Make this space easy to recognize.</p></div>
        <form className="workspace-form" onSubmit={(e) => { e.preventDefault(); void run(async () => { onChanged(await updateWorkspace({ ...workspace, name: name.trim() })); notify("Workspace saved", "ok"); }); }}>
          <label>Workspace name<input aria-label="Workspace name" required maxLength={64} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /></label>
          <div className="workspace-form-actions"><Button variant="default" type="submit" disabled={busy || !name.trim() || name.trim() === workspace.name}>Save changes</Button></div>
        </form>
      </TabsContent>
      <TabsContent value="usage" className="workspace-usage" onPointerDownCapture={() => setKeyboardNavigation(false)} onKeyDownCapture={() => setKeyboardNavigation(true)}>
        <section className="settings-section" aria-labelledby={`${descriptionPrefix}-display`}>
          <h3 className="settings-subtitle" id={`${descriptionPrefix}-display`}>Usage display</h3>
          <RadioGroup className="usage-display-cards" aria-label="Usage display" aria-describedby={`${descriptionPrefix}-display-example`} value={workspace.usage.showRemaining ? "remaining" : "used"} disabled={busy} onValueChange={(value) => void saveUsage({ showRemaining: value === "remaining" })}>
            {([['remaining', 'Remaining', '72', 'Capacity left'], ['used', 'Used', '28', 'Capacity consumed']] as const).map(([value, label, percent, hint]) => <RadioGroupItem className="menubar-style usage-display-card" key={value} value={value} aria-label={label}>
              <span className="usage-display-value" aria-hidden="true">{percent}<span>%</span></span>
              <span className={`usage-display-meter is-${value}`} aria-hidden="true"><i /></span>
              <span className="usage-display-label">{label}<span className="usage-display-check" aria-hidden="true">✓</span></span>
              <span className="usage-display-hint">{hint}</span>
            </RadioGroupItem>)}
          </RadioGroup>
          <p className="menubar-example-note" id={`${descriptionPrefix}-display-example`}>Same usage, two perspectives. Example values.</p>
        </section>
        <section className="settings-section" aria-labelledby={`${descriptionPrefix}-resets`}>
          <h3 className="settings-subtitle" id={`${descriptionPrefix}-resets`}>Codex resets</h3>
          <div className="settings-group usage-resets-group">
            {toggle("Show reset updates", workspace.usage.showCodexResets ?? true, (showCodexResets) => ({ showCodexResets }), "Announced and recently confirmed resets.")}
            <label className="usage-predictions">
              <Checkbox persistIndicator aria-label="Include predictions" aria-describedby={`${descriptionPrefix}-prediction-help`} checked={workspace.usage.showProbableResets} disabled={busy || !(workspace.usage.showCodexResets ?? true)} onCheckedChange={(checked) => void saveUsage({ showProbableResets: checked === true })} />
              <span><span className="setting-name">Include predictions</span><span className="setting-desc" id={`${descriptionPrefix}-prediction-help`}>Estimates only. Resets aren’t guaranteed.</span></span>
            </label>
          </div>
        </section>
        <section className="settings-section" aria-label="Automatic switching">
          <div className="settings-group">
            {toggle("Auto-switch accounts", workspace.usage.autoSwitchEnabled, (autoSwitchEnabled) => ({ autoSwitchEnabled }), "Move to another Codex account near its limit.")}
            {workspace.usage.autoSwitchEnabled ? <>
              <Row name="When remaining reaches"><span className="workspace-percent-control"><input aria-label="Switch at remaining percent" type="number" min="0" max="100" defaultValue={workspace.usage.autoSwitchRemaining ?? 2} key={workspace.usage.autoSwitchRemaining ?? 2} disabled={busy} onBlur={(e) => { const value = Number(e.target.value); if (e.target.value && Number.isInteger(value) && value >= 0 && value <= 100 && value !== (workspace.usage.autoSwitchRemaining ?? 2)) void saveUsage({ autoSwitchRemaining: value }); }} /><span aria-hidden="true">%</span></span></Row>
              <div className="usage-cycle" role="group" aria-labelledby={`${descriptionPrefix}-accounts`}>
                <span className="settings-subtitle" id={`${descriptionPrefix}-accounts`}>Accounts in rotation</span>
                {accounts.map((p) => { const prefs = codexAccountPreferences(state.app, p.id); const id = `${descriptionPrefix}-cycle-${p.id}`; return <label className="usage-account" key={p.id} htmlFor={id}><Checkbox persistIndicator id={id} aria-label={`Include ${p.name} in switch cycle`} checked={prefs.autoSwitch} disabled={busy || !p.connected && !prefs.autoSwitch} onCheckedChange={(checked) => void run(async () => onChanged(await setCodexAccountPreferences(p.id, { ...prefs, autoSwitch: checked === true })))} /><span>{p.name}</span>{!p.connected ? <small>Disconnected</small> : null}</label>; })}
                {accounts.length < 2 ? <p className="setting-note">Add at least two Codex accounts to use auto-switch.</p> : null}
              </div>
            </> : null}
          </div>
          {workspace.usage.autoSwitchEnabled ? <p className="setting-note">Switches start immediately. Running threads ask for confirmation before Codex closes.</p> : null}
        </section>
      </TabsContent>
      <TabsContent value="menu-bar" className="menubar-settings" onPointerDownCapture={() => setKeyboardNavigation(false)} onKeyDownCapture={() => setKeyboardNavigation(true)}>
        <section className="settings-section"><div className="settings-group">
          {toggle("Menu bar usage", workspace.usage.menuBarEnabled, (menuBarEnabled) => ({ menuBarEnabled }))}
        </div></section>
        {workspace.usage.menuBarEnabled ? <WorkspaceMenuBar workspace={workspace} app={state.app} accounts={accounts} claudeAccounts={claudeAccounts} googleAccounts={googleAccounts} busy={busy} onSave={saveUsage} /> : null}
        {workspace.usage.menuBarEnabled ? <section className="settings-section menubar-colors" aria-label="Limit colors"><div className="settings-group">
          {toggle("Change colors near limits", workspace.usage.warningColors ?? false, (warningColors) => ({ warningColors }))}
          {workspace.usage.warningColors ? <div className="workspace-limit-colors" role="group" aria-label="Color thresholds">
            <div className="menubar-thresholds">
              {colorLevels.map((level) => {
                const tone = level >= 95 ? "critical" : level >= 90 ? "high" : level >= 75 ? "warning" : "early";
                const name = level >= 95 ? "Critical" : level >= 90 ? "High usage" : level >= 75 ? "Warning" : "Early warning";
                const id = `${descriptionPrefix}-color-${level}`;
                return <label className={`menubar-threshold is-${tone}`} key={level}>
                  <span className="menubar-threshold-dot" aria-hidden="true" />
                  <span className="menubar-threshold-name" id={id}>{name}</span>
                  <span className="menubar-threshold-value">{level}% used</span>
                  <Switch aria-label={`Change color at ${level}% used`} aria-describedby={id} checked={colorThresholds.includes(level)} disabled={busy} onCheckedChange={(enabled) => void saveUsage({ warningThresholds: enabled === true ? colorLevels.filter((n) => n === level || colorThresholds.includes(n)) : colorLevels.filter((n) => n !== level && colorThresholds.includes(n)) })} />
                </label>;
              })}
            </div>

          </div> : null}
          <p className="setting-note">At each enabled level, the icon and usage change to the matching color.</p>
        </div></section> : <p className="setting-note">Turn on menu bar usage to choose its source and appearance.</p>}
      </TabsContent>
    </AppModal>
  </Tabs>;
}
