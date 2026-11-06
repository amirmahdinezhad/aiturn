import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceQuotas } from "./WorkspaceAccounts";
import type { QuotaSet } from "../api";
import type { CodexProfile } from "../types";

const quota = vi.hoisted(() => vi.fn());
const resetStatus = vi.hoisted(() => vi.fn());
vi.mock("../api", async (original) => ({ ...await original<typeof import("../api")>(), codexProfileQuota: quota, codexResetStatus: resetStatus }));
const profile = (id: string): CodexProfile => ({ id, name: id, email: null, plan: null, connected: true, active: false, needsActivation: false, connectionError: null, loginCommand: "" });
const ready = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { provider: "codex" }]));
beforeEach(() => { resetStatus.mockResolvedValue({generatedAt:new Date().toISOString(),latestReset:null,scheduledReset:null,activeWatch:null}); });
afterEach(cleanup);
it("rejects a delayed quota response after switching workspace", async () => {
  let resolveOld!: (quota: QuotaSet) => void;
  quota.mockImplementation((id) => id === "old" ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({ provider: "codex", windows: [{ window: "weekly", percent: 10 }] }));
  function Harness({ id }: { id: string }) { return <output>{JSON.stringify(useWorkspaceQuotas([profile(id)], id, 0))}</output>; }
  const view = render(<Harness id="old" />);
  view.rerender(<Harness id="new" />);
  expect(await screen.findByText(/"new"/)).toBeInTheDocument();
  await act(async () => resolveOld({ provider: "codex", windows: [{ window: "weekly", percent: 100 }] }));
  expect(screen.getByRole("status")).not.toHaveTextContent('"old"');
});

it("shows the live active account, one explicit Switch action, and one provider logo", async () => {
  const { WorkspaceAccounts } = await import("./WorkspaceAccounts");
  const { DEFAULT_APP_SETTINGS, DEFAULT_WORKSPACE_USAGE } = await import("../types");
  const defaults = { ...DEFAULT_WORKSPACE_USAGE, showProbableResets: false, activeAccounts: { codex: "emma" } };
  const workspace = { id: "studio", name: "Studio", accent: "#007aff", accountIds: ["zoe", "emma"], usage: defaults };
  const emma = { ...profile("emma"), active: true, name: "Emma Brooks", email: "emma@example.com" };
  const zoe = { ...profile("zoe"), name: "Zoe Wilson", email: "zoe@example.com" };
  const activate = vi.fn();
  render(<WorkspaceAccounts workspace={workspace} app={{ ...DEFAULT_APP_SETTINGS, workspaces: [workspace], activeWorkspaceId: workspace.id }} profiles={{ profiles: [emma, zoe], activeProfileId: "emma", canImport: true, switchError: null }} quotas={ready("emma", "zoe")} busy={false} onManage={vi.fn()} onActivate={activate} onQuickSwitch={vi.fn()} onBankedReset={vi.fn()} />);
  const { within } = await import("@testing-library/react");
  const group = screen.getByRole("region", { name: "Workspace accounts" });
  const current = screen.getByRole("article", { name: "Emma Brooks account" });
  const backup = screen.getByRole("article", { name: "Zoe Wilson account" });
  expect(within(group).getAllByRole("article")).toEqual([current, backup]);
  expect(current).toHaveClass("is-active");
  expect(within(group).getAllByText("Active")).toHaveLength(1);
  expect(within(current).getByText("Active")).toBeVisible();
  expect(within(current).queryByRole("button", { name: /Switch to/ })).not.toBeInTheDocument();
  expect(within(backup).getByRole("button", { name: "Switch to Zoe Wilson" }).querySelector("svg")).not.toBeNull();
  expect(group.querySelectorAll(".plogo")).toHaveLength(1);
  expect(current.querySelector(".plogo")).toBeNull();
  const user = (await import("@testing-library/user-event")).default.setup();
  await user.click(within(backup).getByRole("button", { name: "Switch to Zoe Wilson" }));
  expect(activate).toHaveBeenCalledWith("zoe");
});

it("shows one provider reset outside account cards and stops polling when disabled", async () => {
  const { WorkspaceAccounts } = await import("./WorkspaceAccounts");
  const { DEFAULT_APP_SETTINGS, DEFAULT_WORKSPACE_USAGE } = await import("../types");
  resetStatus.mockResolvedValue({generatedAt: new Date().toISOString(), latestReset:{id:"reset",resetType:"regular",announcedAt:new Date(Date.now()-60_000).toISOString()}, scheduledReset:null,activeWatch:null});
  const workspace = {id:"studio",name:"Studio",accent:"#007aff",accountIds:["a","b"],usage:{...DEFAULT_WORKSPACE_USAGE}};
  const props = {workspace,app:DEFAULT_APP_SETTINGS,profiles:{profiles:[{...profile("a"),active:true},{...profile("b"),active:true}],activeProfileId:"a",canImport:true,switchError:null},quotas:ready("a","b"),busy:false,onManage:vi.fn(),onActivate:vi.fn(),onQuickSwitch:vi.fn(),onBankedReset:vi.fn()};
  const view = render(<WorkspaceAccounts {...props} />);
  const notice = await screen.findByLabelText("Codex reset outlook");
  expect(notice.closest("article")).toBeNull();
  expect(screen.getAllByText("Reset confirmed")).toHaveLength(1);
  const calls = resetStatus.mock.calls.length;
  view.rerender(<WorkspaceAccounts {...props} workspace={{...workspace,usage:{...workspace.usage,showCodexResets:false}}} />);
  expect(screen.queryByLabelText("Codex reset outlook")).not.toBeInTheDocument();
  expect(resetStatus).toHaveBeenCalledTimes(calls);
});

it("keeps Codex activity global when changing workspaces and allows activating a lone inactive account", async () => {
  const { WorkspaceAccounts } = await import("./WorkspaceAccounts");
  const { DEFAULT_APP_SETTINGS, DEFAULT_WORKSPACE_USAGE } = await import("../types");
  const profiles = { profiles: [{ ...profile("live"), active: true }, profile("imported")], activeProfileId: "live", canImport: true, switchError: null };
  const first = { id: "first", name: "First", accent: "#007aff", accountIds: ["live"], usage: { ...DEFAULT_WORKSPACE_USAGE, showCodexResets: false } };
  const second = { ...first, id: "second", accountIds: ["imported"], usage: { ...first.usage, activeAccounts: { codex: "imported" } } };
  const activate = vi.fn();
  const props = { app: DEFAULT_APP_SETTINGS, profiles, quotas: ready("live", "imported"), busy: false, onManage: vi.fn(), onActivate: activate, onQuickSwitch: vi.fn(), onBankedReset: vi.fn() };
  const view = render(<WorkspaceAccounts {...props} workspace={first} />);
  expect(screen.getAllByText("Active")).toHaveLength(1);
  view.rerender(<WorkspaceAccounts {...props} workspace={second} />);
  expect(screen.queryByText("Active")).not.toBeInTheDocument();
  const user = (await import("@testing-library/user-event")).default.setup();
  await user.click(screen.getByRole("button", { name: "Switch to imported" }));
  expect(activate).toHaveBeenCalledWith("imported");
  view.rerender(<WorkspaceAccounts {...props} workspace={{ ...second, accountIds: ["imported", "live"] }} />);
  const { within } = await import("@testing-library/react");
  expect(screen.getAllByText("Active")).toHaveLength(1);
  expect(screen.getAllByRole("article")[0]).toHaveAccessibleName("live account");
  expect(within(screen.getByRole("article", { name: "live account" })).getByText("Active")).toBeInTheDocument();
  view.rerender(<WorkspaceAccounts {...props} workspace={second} profiles={{ ...profiles, activeProfileId: "imported", profiles: [profile("live"), { ...profile("imported"), active: true }] }} />);
  expect(within(screen.getByRole("article", { name: "imported account" })).getByText("Active")).toBeInTheDocument();
  view.rerender(<WorkspaceAccounts {...props} workspace={first} profiles={{ ...profiles, activeProfileId: "imported", profiles: [profile("live"), { ...profile("imported"), active: true }] }} />);
  expect(screen.queryByText("Active")).not.toBeInTheDocument();
});

it("publishes a complete quota batch and settles failed accounts instead of revealing balances one at a time",async()=>{
  let fast!:(q:QuotaSet)=>void,slow!:(q:QuotaSet)=>void;
  quota.mockImplementation((id:string)=>id==="fast"?new Promise(resolve=>{fast=resolve;}):id==="slow"?new Promise(resolve=>{slow=resolve;}):Promise.reject(new Error("Offline")));
  function Harness(){return <output>{JSON.stringify(useWorkspaceQuotas([profile("fast"),profile("slow"),profile("failed")],"batch",0))}</output>;}
  render(<Harness />);
  await act(async()=>fast({provider:"codex",resetCredits:{availableCount:1,planType:"plus"}}));
  expect(screen.getByRole("status")).toHaveTextContent("{}");
  await act(async()=>slow({provider:"codex",resetCredits:{availableCount:0,planType:"plus"}}));
  expect(screen.getByRole("status")).toHaveTextContent('"fast"');expect(screen.getByRole("status")).toHaveTextContent('"slow"');expect(screen.getByRole("status")).toHaveTextContent("Offline");
});

it("keeps account identity behind the card skeleton until the entire batch is ready",async()=>{
  const {WorkspaceAccounts}=await import("./WorkspaceAccounts");const {DEFAULT_APP_SETTINGS,DEFAULT_WORKSPACE_USAGE}=await import("../types");
  const workspace={id:"loading",name:"Loading",accent:"#007aff",accountIds:["a","b"],usage:{...DEFAULT_WORKSPACE_USAGE,showCodexResets:false}};
  const props={workspace,app:DEFAULT_APP_SETTINGS,profiles:{profiles:[profile("a"),profile("b")],activeProfileId:null,canImport:true,switchError:null},busy:false,onManage:vi.fn(),onActivate:vi.fn(),onQuickSwitch:vi.fn(),onBankedReset:vi.fn()};
  const a:QuotaSet={provider:"codex",resetCredits:{availableCount:1,planType:"plus"}};
  const view=render(<WorkspaceAccounts {...props} quotas={{a}} />);
  expect(screen.getByLabelText("Loading accounts")).toBeInTheDocument();expect(screen.queryByRole("article")).not.toBeInTheDocument();
  view.rerender(<WorkspaceAccounts {...props} quotas={{a,b:{provider:"codex"}}} />);
  expect(screen.queryByLabelText("Loading accounts")).not.toBeInTheDocument();expect(screen.getAllByRole("article")).toHaveLength(2);
});


it("requires an installed Codex client before activating an imported login", async () => {
  const { WorkspaceAccounts } = await import("./WorkspaceAccounts");
  const { DEFAULT_APP_SETTINGS, DEFAULT_WORKSPACE_USAGE } = await import("../types");
  const workspace = { id: "setup", name: "Setup", accent: "#007aff", accountIds: ["imported"], usage: { ...DEFAULT_WORKSPACE_USAGE, showCodexResets: false } };
  render(<WorkspaceAccounts workspace={workspace} app={DEFAULT_APP_SETTINGS}
    profiles={{ profiles: [profile("imported")], activeProfileId: null, canImport: false, switchError: null, desktopInstalled: false, cliInstalled: false }}
    quotas={ready("imported")} busy={false} onManage={vi.fn()} onActivate={vi.fn()} onQuickSwitch={vi.fn()} onBankedReset={vi.fn()} />);
  expect(screen.getByText("Install Codex CLI or Codex app and sign in, then refresh.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Switch to imported" })).toBeDisabled();
  expect(screen.queryByText("Active")).not.toBeInTheDocument();
});
