import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSettings } from "./WorkspaceSettings";
import { DEFAULT_WORKSPACE_USAGE, type Workspace } from "../types";
import { makeState } from "../test/fixtures";

const api = vi.hoisted(() => ({ updateWorkspace: vi.fn(), antigravityAccounts: vi.fn(), codexProfileQuota: vi.fn(), claudeProfileQuota: vi.fn(), renameCodexProfile: vi.fn(), editClaudeProfile: vi.fn(), renameAntigravityAccount: vi.fn(), removeWorkspaceAccount: vi.fn() }));
vi.mock("../api", async (original) => ({ ...await original<typeof import("../api")>(), ...api }));
const workspace: Workspace = { id: "studio", name: "Studio", accent: "#007aff", accountIds: ["codex"], claudeAccountIds: ["claude"], antigravityAccountIds: ["google"], usage: { ...DEFAULT_WORKSPACE_USAGE } };
const codex = { id: "codex", name: "Personal", email: "personal@example.com", plan: null, connected: true, active: true, connectionError: null, needsActivation: false, loginCommand: "" };
const claude = { id: "claude", name: "Work", email: "work@example.com", configDir: "", createdAt: "", connected: true, subscription: null, loginCommand: "", launchCommand: "", quota: null };
function show(section: string, usage = workspace.usage) {
  const current = { ...workspace, usage };
  const state = makeState({ app: { ...makeState().app, workspaces: [current], activeWorkspaceId: current.id } });
  api.updateWorkspace.mockResolvedValue(state); api.removeWorkspaceAccount.mockResolvedValue(state);
  render(<WorkspaceSettings open workspace={current} state={state} profiles={{ profiles: [codex], activeProfileId: codex.id, canImport: true, switchError: null }} claudeAccounts={[claude]} initialSection={section} onClose={vi.fn()} onChanged={vi.fn()} notify={vi.fn()} />);
}
beforeEach(() => { vi.clearAllMocks(); api.antigravityAccounts.mockResolvedValue([{ id: "google", name: "Google work", provider: "antigravity", email: "google@example.com" }]); api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "weekly", percent: 10 }] }); api.claudeProfileQuota.mockResolvedValue({ provider: "claude", windows: [{ window: "5-hour", percent: 20 }] }); });
afterEach(cleanup);
it("has General, Usage and Menu bar tabs with no account management section", () => {
  show("general");
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["General", "Usage", "Menu bar"]);
  expect(screen.queryByRole("button", { name: /Edit|Remove|Add account/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Accounts" })).not.toBeInTheDocument();
});
it("enables all display defaults and exposes only the account's reported limit types", async () => {
  const user = userEvent.setup(); show("menu-bar");
  for (const label of ["Menu bar usage"]) expect(screen.getByRole("switch", { name: label })).toBeChecked();
  expect(screen.queryByRole("combobox", { name: "Accounts to display" })).not.toBeInTheDocument();
  const weekly = await screen.findByRole("checkbox", { name: "Show Personal Weekly limit" });
  expect(weekly).toBeChecked();
  await user.click(weekly);
  expect(api.updateWorkspace).toHaveBeenCalledWith(expect.objectContaining({ usage: expect.objectContaining({ accountWindows: { codex: [] } }) }));
  expect(screen.queryByRole("checkbox", { name: /Personal 5-hour/ })).not.toBeInTheDocument();
});
it("starts switching at 2% remaining and saves a custom threshold", async () => {
  show("usage", { ...workspace.usage, autoSwitchEnabled: true });
  const input = screen.getByRole("spinbutton", { name: "Switch at remaining percent" }); expect(input).toHaveValue(2);
  expect(screen.getByRole("checkbox", { name: "Include Personal in switch cycle" })).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "8" } }); fireEvent.blur(input);
  expect(api.updateWorkspace).toHaveBeenCalledWith(expect.objectContaining({ usage: expect.objectContaining({ autoSwitchRemaining: 8 }) }));
});
it("chooses provider before limit switches and keeps color warnings independent of notifications", async () => {
  const user = userEvent.setup(); show("menu-bar");
  await user.click(screen.getByRole("switch", { name: "Change colors near limits" }));
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ usage: expect.objectContaining({ warningColors: true }) }));
  await user.click(screen.getByRole("combobox", { name: "Menu bar provider" }));
  await user.click(screen.getByRole("option", { name: /^Claude$/ }));
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ usage: expect.objectContaining({ menuBarProvider: "claude", displayMode: "active" }) }));
});

it("uses a checkbox for initials and saves it per workspace", async () => {
  const user = userEvent.setup(); show("menu-bar");
  const toggle = screen.getByRole("checkbox", { name: "Show account initials" });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ usage: expect.objectContaining({ showAccountName: false }) }));
});


it("removes alert controls and saves the Codex section reset toggle", async () => {
  const user = userEvent.setup(); show("usage");
  for (const name of ["Workspace alerts", "Session reset", "Alert at 90%"])
    expect(screen.queryByRole("switch", { name })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Custom alert percent")).not.toBeInTheDocument();
  await user.click(screen.getByRole("switch", { name: "Show reset updates" }));
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({usage: expect.objectContaining({showCodexResets:false})}));
});

it("keeps usage policy separate from menu-bar presentation and explains reset predictions", async () => {
  const user = userEvent.setup(); show("usage");
  expect(screen.getByRole("radio", {name:"Remaining"})).toBeChecked();
  expect(screen.getByRole("switch", {name:"Show reset updates"})).toBeChecked();
  expect(screen.getByRole("checkbox", {name:"Include predictions"})).toBeChecked();
  expect(screen.getByRole("checkbox", {name:"Include predictions"})).toHaveAccessibleDescription("Estimates only. Resets aren’t guaranteed.");
  expect(screen.queryByRole("switch", {name:"Menu bar usage"})).not.toBeInTheDocument();
  expect(screen.queryByRole("switch", {name:"Change colors near limits"})).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", {name:"Menu bar provider"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", {name:"Include predictions"}));
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({usage:expect.objectContaining({showProbableResets:false})}));
  await user.click(screen.getByRole("tab", {name:"Menu bar"}));
  expect(screen.queryByRole("switch", {name:"Show reset updates"})).not.toBeInTheDocument();
  expect(screen.getByRole("switch", {name:"Menu bar usage"})).toBeChecked();
  expect(screen.getByRole("switch", {name:"Change colors near limits"})).toBeInTheDocument();
});

it("restores color details only when enabled and saves each level without alerts", async () => {
  const user = userEvent.setup(); show("menu-bar", {...workspace.usage, warningColors:true});
  for (const level of [75,90,95]) expect(screen.getByRole("switch",{name:`Change color at ${level}% used`})).toBeChecked();
  expect(screen.getByRole("switch",{name:"Change color at 75% used"})).toHaveAccessibleDescription("Warning");
  await user.click(screen.getByRole("switch",{name:"Change color at 95% used"}));
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({usage:expect.objectContaining({warningThresholds:[75,90],warningColors:true})}));
  expect(screen.queryByRole("switch",{name:"Workspace alerts"})).not.toBeInTheDocument();
});
it("preserves all-disabled levels and hides saved color details while the master is off", async () => {
  const user = userEvent.setup(); show("menu-bar", {...workspace.usage, warningColors:false,warningThresholds:[]});
  expect(screen.queryByRole("group",{name:"Color thresholds"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("switch",{name:"Change colors near limits"}));
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({usage:expect.objectContaining({warningColors:true,warningThresholds:[]})}));
});
it("removes custom thresholds and drops legacy custom levels when a preset changes", async () => {
  const user = userEvent.setup(); show("menu-bar", {...workspace.usage,warningColors:true,warningThresholds:[55,75,90,95]});
  expect(screen.queryByText("Custom threshold")).not.toBeInTheDocument();
  expect(screen.queryByRole("spinbutton",{name:"Custom color threshold"})).not.toBeInTheDocument();
  expect(screen.queryByRole("switch",{name:"Change color at 55% used"})).not.toBeInTheDocument();
  const level = screen.getByRole("switch",{name:"Change color at 95% used"});
  level.focus(); await user.keyboard(" ");
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({usage:expect.objectContaining({warningThresholds:[75,90]})}));
});

 it("offers visual radio choices with keyboard activation and preserves other usage settings", async () => {
  const user = userEvent.setup(); show("menu-bar");
  expect(screen.getByRole("radio", {name:"Reset timeline"})).toBeChecked();
  screen.getByRole("radio", {name:"Progress bars"}).focus(); await user.keyboard(" ");
  await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalled());
  expect(api.updateWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({usage:expect.objectContaining({menuBarStyle:"progress", menuBarEnabled:true})}));
});
it("hides dependent controls when menu bar usage is disabled", () => {
  show("menu-bar", {...workspace.usage, menuBarEnabled:false});
  expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  expect(screen.queryByRole("switch", {name:"Change colors near limits"})).not.toBeInTheDocument();
});

it("saves the usage direction with keyboard activation and retains focus", async () => {
  const user = userEvent.setup(); show("usage");
  screen.getByRole("radio", { name: "Used" }).focus();
  await user.keyboard(" ");
  await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledWith(expect.objectContaining({ usage: expect.objectContaining({ showRemaining: false, menuBarEnabled: true }) })));
  await waitFor(() => expect(screen.getByRole("radio", { name: "Used" })).toHaveFocus());
});

it("preserves the saved prediction preference while reset updates are hidden", async () => {
  const user = userEvent.setup(); show("usage", { ...workspace.usage, showProbableResets: true });
  await user.click(screen.getByRole("switch", { name: "Show reset updates" }));
  expect(api.updateWorkspace).toHaveBeenCalledWith(expect.objectContaining({ usage: expect.objectContaining({ showCodexResets: false, showProbableResets: true }) }));
});

it("disables predictions while resets are hidden and retains the saved preference", () => {
  show("usage", { ...workspace.usage, showCodexResets: false, showProbableResets: true });
  expect(screen.getByRole("checkbox", { name: "Include predictions" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Include predictions" })).toBeDisabled();
});

it("reports reset save errors without changing the selected preference", async () => {
  const user = userEvent.setup(); show("usage", { ...workspace.usage, showCodexResets: false });
  api.updateWorkspace.mockRejectedValueOnce(new Error("Could not save usage"));
  await user.click(screen.getByRole("switch", { name: "Show reset updates" }));
  expect(api.updateWorkspace).toHaveBeenCalledWith(expect.objectContaining({ usage: expect.objectContaining({ showCodexResets: true }) }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save usage");
  expect(screen.getByRole("switch", { name: "Show reset updates" })).not.toBeChecked();
});
