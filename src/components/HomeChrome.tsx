import type { Workspace } from "../types";
import { AppLogo } from "../logos";
import { AddIcon, LogoutIcon, RefreshIcon, SettingIcon } from "../icons";
import { Button } from "./ui/button";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export function HomeHeader({ workspace, workspaces, workspaceBusy, refreshing, updatedAt, onSelect, onRefresh, onWorkspaceSettings, onQuit, onCreate }: {
  workspace?: Workspace; workspaces: Workspace[]; workspaceBusy: boolean; refreshing: boolean; updatedAt: string | null;
  onSelect: (id: string) => void; onRefresh: () => void; onWorkspaceSettings: () => void; onQuit: () => void; onCreate: (origin?: HTMLElement) => void;
}) {
  return <header className="app-header home-header">
    <div className="home-topline"><div className="brand">{workspace ? <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} busy={workspaceBusy} onSelect={onSelect} onCreate={onCreate} onEdit={onWorkspaceSettings} status={null} /> : <><AppLogo /><div className="brand-text workspace-brand"><span className="brand-caption">Aiturn</span><span className="profile-picker-name">Account manager</span></div></>}</div>
    <div className="header-actions">
      {workspace ? <><Button size="icon-sm" variant="ghost" className={`gear-btn home-refresh home-icon-button${refreshing ? " spinning" : ""}`} aria-label="Refresh data" title={refreshing ? "Refreshing accounts…" : updatedAt ? `Refresh · last checked ${new Date(updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}` : "Refresh accounts"} aria-busy={refreshing} disabled={refreshing} onClick={onRefresh}><RefreshIcon size={18} /></Button></> : <Button size="icon-sm" variant="ghost" className="home-quit home-icon-button" aria-label="Quit Aiturn" title="Quit Aiturn" onClick={onQuit}><LogoutIcon size={18} /></Button>}
    </div></div>
    {workspace ? <><h1 className="sr-only">Accounts</h1><span className="sr-only" role="status">{refreshing ? "Refreshing accounts…" : updatedAt ? "Accounts refreshed" : ""}</span></> : null}
  </header>;
}

/** Persistent actions remain outside the independently scrolling account list. */
export function HomeActions({ busy, onAdd, onSettings, onQuit }: {
  busy: boolean; onAdd: () => void; onSettings: () => void; onQuit: () => void;
}) {
  return <footer className="home-actions" aria-label="Account and app actions">
    <Button variant="default" className="home-add-account" disabled={busy} onClick={onAdd}><AddIcon size={20} /><span>Add Account</span></Button>
    <div className="home-secondary-actions">
      <Button size="icon-sm" variant="ghost" className="home-settings home-icon-button" aria-label="Settings" title="Settings" onClick={onSettings}><SettingIcon size={18} /></Button>
      <Button size="icon-sm" variant="ghost" className="home-quit home-icon-button" aria-label="Quit Aiturn" title="Quit Aiturn" onClick={onQuit}><LogoutIcon size={18} /></Button>
    </div>
  </footer>;
}
