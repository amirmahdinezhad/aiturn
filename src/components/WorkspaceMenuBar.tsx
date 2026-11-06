import { useEffect, useState } from "react";
import { antigravityAccountQuota, claudeProfileQuota, codexProfileQuota, prettyError, type SetupAccount, type QuotaSet } from "../api";
import { accountWindows, accountWindowLabel, canonicalAccountWindow, codexAccountPreferences } from "../accountPrefs";
import { DEFAULT_CODEX_ACCOUNT_PREFERENCES, type AppSettings, type ClaudeProfile, type CodexProfile, type Workspace, type WorkspaceUsage } from "../types";
import { accountInitials } from "./AccountIdentity";
import { Select } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

const MENU_BAR_STYLES = [
  ["resetTimeline", "Reset timeline"],
  ["percentages", "Percentages"],
  ["progress", "Progress bars"],
] as const;

function MenuBarSample({ style }: { style: NonNullable<WorkspaceUsage["menuBarStyle"]> }) {
  if (style === "progress") return <span className="menubar-sample-bars"><i /><i /></span>;
  return <span className={style === "resetTimeline" ? "menubar-sample-timeline" : undefined}>
    <span>72<span className="menubar-sample-unit">%</span></span>
  </span>;
}

/** Follow the active Codex login within this workspace and discover its limits. */
export function WorkspaceMenuBar({ workspace, app, accounts, claudeAccounts, googleAccounts, busy, onSave }: {
  workspace: Workspace; app: AppSettings; accounts: CodexProfile[]; claudeAccounts: ClaudeProfile[]; googleAccounts: SetupAccount[];
  busy: boolean; onSave: (patch: Partial<WorkspaceUsage>) => Promise<unknown>;
}) {
  const groups = [
    { id: "codex" as const, label: "Codex", items: accounts.filter((p) => workspace.accountIds.includes(p.id)) },
    { id: "claude" as const, label: "Claude", items: claudeAccounts.filter((p) => workspace.claudeAccountIds == null || workspace.claudeAccountIds.includes(p.id)) },
    { id: "antigravity" as const, label: "Antigravity", items: googleAccounts.filter((p) => workspace.antigravityAccountIds?.includes(p.id)) },
  ].filter((group) => group.items.length > 0);
  const group = groups.find((g) => g.id === workspace.usage.menuBarProvider) ?? groups[0];
  const provider = group?.id;
  const account = provider === "codex" ? group?.items.find((p) => "active" in p && p.active) : group?.items.find((p) => p.id === workspace.usage.menuBarAccountId)
    ?? group?.items.find((p) => p.id === workspace.usage.activeAccounts?.[group.id]) ?? group?.items[0];
  const [result, setResult] = useState<{ key: string; quota: QuotaSet } | null>(null);
  const key = `${workspace.id}:${provider}:${account?.id}`;
  const quota = result?.key === key ? result.quota : null;
  useEffect(() => {
    let current = true;
    if (!provider || !account) return;
    const read = provider === "codex" ? codexProfileQuota : provider === "claude" ? claudeProfileQuota : antigravityAccountQuota;
    void read(account.id).catch((e) => ({ provider, error: prettyError(e) } as QuotaSet)).then((quota) => { if (current) setResult({ key, quota }); });
    return () => { current = false; };
  }, [key]);
  if (!group) return <section className="settings-section"><h3 className="settings-subtitle">Menu bar</h3><p className="setting-note">Add an account to this workspace first.</p></section>;
  const prefs = provider === "codex" && account ? codexAccountPreferences(app, account.id) : DEFAULT_CODEX_ACCOUNT_PREFERENCES;
  const reported = (quota?.error ? [] : quota?.windows ?? []).map((w) => canonicalAccountWindow(w.window) ?? w.window);
  const defaults = workspace.usage.defaultMenuBarLimits
    ? ["5-hour", "weekly"].filter((kind) => reported.includes(kind))
    : [];
  const selected = account ? workspace.usage.accountWindows?.[account.id]
    ?? (prefs.menuBarWindows.length ? prefs.menuBarWindows : defaults) : [];
  const windows = provider === "codex" ? accountWindows(quota, { ...prefs, menuBarWindows: selected }) : [...new Set([...selected, ...reported])];
  // Keep targets independent of the saved selection order, including during quota outages.
  windows.sort((a, b) => {
    const duration = (value: string) => ({ "5-hour": 300, weekly: 10080, monthly: 43200 }[value] ?? (/^[1-9]\d*[mhd]$/.test(value) ? Number(value.slice(0, -1)) * ({ m: 1, h: 60, d: 1440 }[value.slice(-1)] ?? 1) : Infinity));
    return duration(a) - duration(b) || a.localeCompare(b);
  });
  const showInitials = workspace.usage.showAccountName ?? prefs.showProfileLabel;
  const style = workspace.usage.menuBarStyle ?? "percentages";
  return <section className="settings-section workspace-menu-bar" aria-label="Menu bar limits"><h3 className="settings-subtitle">Source</h3>
    <div className="menubar-source">
      <Select className="menubar-source-select" aria-label="Menu bar provider" value={group.id} disabled={busy} options={groups.map((g) => ({ value: g.id, label: g.label }))} onValueChange={(value) => { const next = groups.find((g) => g.id === value)!; void onSave({ menuBarProvider: next.id, menuBarAccountId: next.items.find((p) => p.id === workspace.usage.activeAccounts?.[next.id])?.id ?? next.items[0].id, displayMode: "active" }); }} />
      {provider === "codex" ? <p className="menubar-source-account" aria-label="Menu bar active account">{account ? <><span>Active account</span><bdi>{account.name}</bdi></> : "No active Codex account."}</p> : null}
      {provider !== "codex" && account ? <div className="menubar-source-account-picker"><h3 className="settings-subtitle">Account</h3><Select className="menubar-source-select" aria-label="Menu bar account" value={account.id} disabled={busy} options={group.items.map((p) => ({ value: p.id, label: p.name }))} onValueChange={(menuBarAccountId) => void onSave({ menuBarProvider: group.id, menuBarAccountId })} /></div> : null}
    </div>
    <h3 className="settings-subtitle menubar-section-title">Appearance</h3>
    <RadioGroup className="menubar-styles" aria-label="Menu bar display style" value={style} disabled={busy} onValueChange={(value) => void onSave({ menuBarStyle: value as WorkspaceUsage["menuBarStyle"] })}>
      {MENU_BAR_STYLES.map(([value, label]) => <RadioGroupItem className="menubar-style" key={value} value={value} aria-label={label}>
        <span className="menubar-style-sample" aria-hidden="true"><MenuBarSample style={value} /></span>
        <span className="menubar-style-caption">{label}</span>
      </RadioGroupItem>)}
    </RadioGroup>
    <p className="menubar-example-note">Illustrative styles, not live usage.</p>
    {account ? <label className="menubar-initials-preview">
      <span className="menubar-identity-sample" aria-hidden="true"><span className="menubar-initials-sample" data-visible={showInitials}>{accountInitials(account.name)}</span><MenuBarSample style={style} /></span>
      <span className="menubar-initials-caption"><Checkbox persistIndicator aria-label="Show account initials" checked={showInitials} disabled={busy} onCheckedChange={(value) => void onSave({ showAccountName: value === true })} /><span>Show account initials</span></span>
    </label> : null}
    {account ? <fieldset className="menubar-limits" key={key}><legend className="settings-subtitle">Visible limits</legend>
      <div className="menubar-limit-options">{windows.map((kind) => <label className="menubar-check menubar-limit" key={kind}><Checkbox persistIndicator aria-label={`Show ${account.name} ${accountWindowLabel(kind)} limit`} checked={selected.includes(kind)} disabled={busy} onCheckedChange={(enabled) => void onSave({ menuBarAccountId: account.id, accountWindows: { ...workspace.usage.accountWindows, [account.id]: enabled === true ? [...selected, kind] : selected.filter((w) => w !== kind) } })} /><span>{accountWindowLabel(kind)}</span></label>)}</div>
      {!windows.length ? <p className="setting-note" role="status">{quota ? quota.error ?? "No limits reported for this account." : "Reading account limits…"}</p> : selected.length === 0 ? <p className="setting-note">Select a limit to show usage in the menu bar.</p> : null}
    </fieldset> : <p className="setting-note">Only the active account in this workspace appears in the menu bar.</p>}
    {style === "progress" ? <p className="setting-note">A single limit uses a larger bar. A time marker shows progress toward reset when timing is available.</p> : null}
    {style === "resetTimeline" ? <p className="setting-note">When reset timing is available, the line shrinks as reset approaches.</p> : null}
  </section>;
}
