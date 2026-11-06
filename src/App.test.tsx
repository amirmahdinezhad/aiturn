import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({
  beginAccountSetup: vi.fn(), discardAccountSetup: vi.fn(), loadSetupAccounts: vi.fn(),
  startSetupLogin: vi.fn(), pollSetupLogin: vi.fn(), cancelSetupLogin: vi.fn(), submitSetupCode: vi.fn(),
  importSetupAccount: vi.fn(), connectCurrentGoogle: vi.fn(), connectSetupConfig: vi.fn(), commitAccountSetup: vi.fn(), removeWorkspaceAccount: vi.fn(), antigravityAccounts: vi.fn(), antigravityAccountQuota: vi.fn(),
  includeWorkspaceProvider: vi.fn(), getState: vi.fn(), setSettings: vi.fn(), setAppSettings: vi.fn(),
  codexProfileQuota: vi.fn(), setCodexAccountPreferences: vi.fn(), cliStatus: vi.fn(), codexProfiles: vi.fn(), claudeProfiles: vi.fn(),
  discoverWorkspaceAccounts: vi.fn(), createDiscoveredWorkspace: vi.fn(), createWorkspace: vi.fn(), importWorkspaceAccount: vi.fn(), selectWorkspace: vi.fn(), updateWorkspace: vi.fn(), moveWorkspaceAccount: vi.fn(),
  editClaudeProfile: vi.fn(), renameAntigravityAccount: vi.fn(), renameCodexProfile: vi.fn(), removeCodexProfile: vi.fn(), activateCodexProfile: vi.fn(),
  importCodexProfile: vi.fn(), importCodexProfileJson: vi.fn(),
  scheduleCodexRestart: vi.fn(), codexRestartStatus: vi.fn(), cancelCodexRestart: vi.fn(), runCodexRestartNow: vi.fn(),
  claudeProfileQuota: vi.fn(), codexBankedResets: vi.fn(), prepareCodexReset: vi.fn(), consumeCodexReset: vi.fn(),
  cliQuotas: vi.fn(), codexResetStatus: vi.fn(), quitApp: vi.fn(),
  prettyError: vi.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));
vi.mock("./api", () => api);
const nativeEvents = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => nativeEvents);
import App from "./App";
import type { SetupAccount } from "./api";
const opener = vi.hoisted(() => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/plugin-opener", () => opener);
import { makeState } from "./test/fixtures";
import { DEFAULT_CODEX_ACCOUNT_PREFERENCES, DEFAULT_WORKSPACE_USAGE, type AppState, type CodexProfile, type Workspace } from "./types";

const personal: CodexProfile = { id: "personal", name: "Personal account", email: "personal@example.com", plan: "plus", connected: true, active: true, needsActivation: false, connectionError: null, loginCommand: "" };
const work: CodexProfile = { ...personal, id: "work", name: "Work account", email: "work@example.com", active: false };
const studio: Workspace = { id: "studio", name: "Studio", accent: "#7c6cf0", accountIds: [personal.id, work.id], usage: { ...DEFAULT_WORKSPACE_USAGE } };
function savedState(workspaces = [studio], activeWorkspaceId = workspaces[0]?.id ?? null): AppState {
  return makeState({ app: { ...makeState().app, workspaceVersion: 1, workspaces, activeWorkspaceId } });
}
const claude = { id: "claude", label: "Claude", binary: "claude", binaryFound: true, loggedIn: true, authMethod: "claude.ai", email: "claude@example.com", loginCmd: "claude auth login", installUrl: "https://claude.com" };
const stagedClaude: SetupAccount = { id: "staged-claude", provider: "claude", name: "Claude", email: "claude@example.com", source: "cli", subscription: { id: "claude", service: "Claude", plan: "pro" } };
const stagedCodex: SetupAccount = { id: "staged-codex", provider: "codex", name: "Backup", email: "backup@example.com", source: "desktop", subscription: { id: "chatgpt", service: "ChatGPT", plan: "plus" } };
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  api.claudeProfileQuota.mockResolvedValue({provider:"claude",windows:[]});
  api.antigravityAccountQuota.mockResolvedValue({provider:"antigravity",windows:[]});
  api.cliQuotas.mockResolvedValue([]);
  nativeEvents.listen.mockResolvedValue(vi.fn());
  api.beginAccountSetup.mockResolvedValue("draft"); api.discardAccountSetup.mockResolvedValue(undefined);
  api.loadSetupAccounts.mockResolvedValue([stagedClaude]); api.commitAccountSetup.mockResolvedValue(savedState());
  api.importSetupAccount.mockResolvedValue(stagedCodex); api.connectSetupConfig.mockResolvedValue(stagedClaude);
  api.cancelSetupLogin.mockResolvedValue(undefined); api.submitSetupCode.mockResolvedValue(undefined); opener.openUrl.mockResolvedValue(undefined);
  api.startSetupLogin.mockResolvedValue({ attemptId: "attempt", status: "pending", authUrl: "https://auth.openai.com/authorize", userCode: null, error: null, account: null });
  api.pollSetupLogin.mockResolvedValue({ attemptId: "attempt", status: "completed", authUrl: null, userCode: null, error: null, account: stagedCodex });
  api.prettyError.mockImplementation((e) => e instanceof Error ? e.message : String(e));
  api.getState.mockResolvedValue(savedState());
  api.cliStatus.mockResolvedValue([claude]);
  api.discoverWorkspaceAccounts.mockResolvedValue([{ ...claude, subscriptions: [{ id: "claude", service: "Claude", plan: "pro" }] }]);
  api.claudeProfiles.mockResolvedValue([]);
  api.antigravityAccounts.mockResolvedValue([]);
  api.codexProfiles.mockResolvedValue({ profiles: [personal, work], activeProfileId: personal.id, canImport: true, switchError: null });
  api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "5-hour", percent: 20 }] });
  api.codexRestartStatus.mockResolvedValue(null);
  api.codexResetStatus.mockResolvedValue({ latestReset: null, scheduledReset: null, activeWatch: null, generatedAt: new Date().toISOString() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function uploadAuth(user: ReturnType<typeof userEvent.setup>, credentials: string) {
  await user.upload(screen.getByLabelText("Choose auth.json file"), new File([credentials], "auth.json", { type: "application/json" }));
  await screen.findByText("Ready to verify");
}

async function identity(user: ReturnType<typeof userEvent.setup>, name = "Lab") {
  await user.type(await screen.findByLabelText("Workspace name"), name);
  await user.click(screen.getByRole("button", { name: "Next" }));
}
async function fileMethod(user: ReturnType<typeof userEvent.setup>) {
  if (screen.queryByLabelText("Step 2 of 3")) await user.click(screen.getByRole("button", { name: "Next" }));
  if (!screen.queryByRole("group", { name: "Choose provider" })) await user.click(screen.getByRole("button", { name: "Add account" }));
  await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
  await user.click(screen.getByRole("button", { name: /Import auth.json/ }));
}

describe("workspace flow", () => {
  it("shows an active Codex account and an active Claude account at the same time", async () => {
    const loadedClaude = { id: "claude-loaded", name: "Claude current", configDir: "~/.claude", createdAt: "", email: "claude@example.com", connected: true, active: true, subscription: { id: "claude", service: "Claude", plan: "pro" }, loginCommand: "", launchCommand: "", quota: null };
    api.claudeProfiles.mockResolvedValue([loadedClaude]);
    api.getState.mockResolvedValue(savedState([{ ...studio, claudeAccountIds: [loadedClaude.id] }]));
    render(<App />);
    expect(within(await screen.findByRole("article", { name: "Personal account account" })).getByText("Active")).toBeInTheDocument();
    expect(within(await screen.findByRole("article", { name: "Claude current Claude account" })).getByText("Active")).toBeInTheDocument();
  });

  it("activates a saved Codex account without attempting a desktop restart on CLI-only Macs", async () => {
    const user = userEvent.setup();
    const inactive = { profiles: [{ ...personal, active: false }, work], activeProfileId: null, canImport: false, switchError: null, desktopInstalled: false };
    const active = { ...inactive, profiles: [inactive.profiles[0], { ...work, active: true }], activeProfileId: work.id, canImport: true };
    api.codexProfiles.mockResolvedValueOnce(inactive).mockResolvedValue(active);
    api.activateCodexProfile.mockResolvedValue(active);
    render(<App />);
    expect(await screen.findByText("Choose Switch to activate an account in Codex.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Switch to Work account" }));
    expect(api.activateCodexProfile).toHaveBeenCalledWith(work.id);
    expect(api.scheduleCodexRestart).not.toHaveBeenCalled();
    await waitFor(() => expect(within(screen.getByRole("article", { name: "Work account account" })).getByText("Active")).toBeVisible());
  });

  it("automatically loads verified accounts with their sources and no source picker", async () => {
    const user = userEvent.setup();
    api.getState.mockResolvedValue(savedState([]));
    api.loadSetupAccounts.mockResolvedValue([stagedCodex, stagedClaude]);
    render(<App />); await identity(user);
    const list = await screen.findByRole("group", { name: "Available accounts" });
    expect(within(list).getByText("Codex app")).toBeInTheDocument();
    expect(within(list).getByText("CLI")).toBeInTheDocument();
    expect(api.loadSetupAccounts).toHaveBeenCalledExactlyOnceWith("draft");
    expect(screen.queryByRole("button", { name: "Sources" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("shows one verified Codex login when adding from this Mac", async () => {
    const user = userEvent.setup();
    api.loadSetupAccounts.mockResolvedValue([{ ...stagedCodex, source: "cli" }]);
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
    const select = await screen.findByRole("button", { name: "Select" });
    expect(api.loadSetupAccounts).toHaveBeenCalledExactlyOnceWith("draft", "codex");
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    await user.click(select);
    expect(screen.getByRole("button", { name: "Selected" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Add accounts" }));
    expect(api.commitAccountSetup).toHaveBeenCalledWith("draft", "Studio", studio.accent, [stagedCodex.id], "studio");
  });

  it("does not allow an account already saved in Aiturn to be added again", async () => {
    const user = userEvent.setup();
    api.loadSetupAccounts.mockResolvedValue([{ ...stagedCodex, alreadyAdded: true }]);
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
    expect(await screen.findByRole("button", { name: "Added" })).toBeDisabled();
    expect(screen.getByText("Already added")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add accounts" })).not.toBeInTheDocument();
    expect(api.commitAccountSetup).not.toHaveBeenCalled();
  });

  it("rejects a manually imported account that is already saved", async () => {
    const user = userEvent.setup();
    api.importSetupAccount.mockResolvedValue({ ...stagedCodex, alreadyAdded: true });
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await fileMethod(user);
    await uploadAuth(user, '{"tokens":{"access_token":"synthetic"}}');
    await user.click(screen.getByRole("button", { name: "Verify account" }));
    expect(await screen.findByText("This account is already added to Aiturn.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add accounts" })).not.toBeInTheDocument();
    expect(api.commitAccountSetup).not.toHaveBeenCalled();
  });

  it("ignores a local discovery response after choosing a different provider", async () => {
    const user = userEvent.setup();
    let finish!: (accounts: SetupAccount[]) => void;
    api.loadSetupAccounts.mockImplementationOnce(() => new Promise<SetupAccount[]>((resolve) => { finish = resolve; })).mockResolvedValue([stagedClaude]);
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
    await waitFor(() => expect(api.loadSetupAccounts).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "All providers" }));
    await user.click(screen.getByRole("button", { name: "Claude" }));
    await within(screen.getByRole("region", { name: "Claude accounts on this Mac" })).findByText("claude@example.com");
    await act(async () => finish([stagedCodex]));
    expect(screen.queryByText("backup@example.com")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Claude accounts on this Mac" })).getByText("claude@example.com")).toBeInTheDocument();
  });

  it("marks the loaded current account independently for each provider", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([]));
    api.loadSetupAccounts.mockResolvedValue([{ ...stagedCodex, active: true }, { ...stagedClaude, active: true }]);
    render(<App />); await identity(user);
    const list = await screen.findByRole("group", { name: "Available accounts" });
    expect(within(list).getAllByText("Active")).toHaveLength(2);
  });

  it("shows an imported account's profile name separately from its saved label after reload", async () => {
    api.codexProfiles.mockResolvedValue({ profiles: [{ ...personal, name: "Work backup", displayName: "Emma Brooks", email: "work@example.com" }], activeProfileId: personal.id, canImport: true, switchError: null });
    render(<App />);
    const card = await screen.findByRole("article", { name: "Work backup account" });
    expect(within(card).getByText("Emma Brooks")).toBeInTheDocument();
    expect(within(card).getByText("work@example.com")).toBeInTheDocument();
    expect(within(card).getByText("Work backup")).toBeInTheDocument();
  });

  it("shows the Codex profile name with its email when loading available accounts", async () => {
    const user = userEvent.setup();
    api.getState.mockResolvedValue(savedState([]));
    api.loadSetupAccounts.mockResolvedValue([{ ...stagedCodex, name: "ChatGPT account", displayName: "Emma Brooks" }]);
    render(<App />); await identity(user);
    expect(await screen.findByText("Emma Brooks")).toBeInTheDocument();
    expect(screen.getByText(stagedCodex.email!)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Add Emma Brooks to workspace" })).toBeInTheDocument();
    expect(screen.queryByText("ChatGPT account")).not.toBeInTheDocument();
  });

  it("automatically loads accounts and lets the optional third step use only existing selections", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([])); render(<App />);
    await identity(user, "Studio");
    expect(api.loadSetupAccounts).toHaveBeenCalledTimes(1); expect(api.cliStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Load accounts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add new account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load again" }).textContent).toBe("");
    expect(screen.queryByRole("button", { name: /Import auth.json/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();

    expect(await screen.findByText("claude@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create workspace" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Add Claude to workspace" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Optional: add another account/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(api.commitAccountSetup).toHaveBeenCalledWith("draft", "Studio", "#625cc1", [stagedClaude.id], null);
    expect(api.activateCodexProfile).not.toHaveBeenCalled();
  });
  it("shows real spinners while automatically loading and refreshing accounts", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([]));
    let finish!: (accounts: SetupAccount[]) => void;
    api.loadSetupAccounts.mockImplementation(() => new Promise<SetupAccount[]>((resolve) => { finish = resolve; }));
    render(<App />); await identity(user);
    expect(screen.getByText("Checking your accounts").closest('[role="status"]')).toHaveTextContent("Checking your accounts");
    expect(screen.getByText("Checking your accounts").closest('[role="status"]')!.querySelector(".ak-spin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load again" }).querySelector(".ak-spin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load again" })).toBeDisabled();
    await act(async () => finish([stagedClaude]));
    await user.click(screen.getByRole("button", { name: "Load again" }));
    expect(screen.getByRole("button", { name: "Load again" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Load again" }).querySelector(".ak-spin")).toBeInTheDocument();
    await act(async () => finish([stagedClaude]));
    expect(screen.getByRole("button", { name: "Load again" })).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText(/Saved privately/)).not.toBeInTheDocument();
  });
  it("offers step three even when no existing paid accounts are found", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([])); api.loadSetupAccounts.mockResolvedValue([]); render(<App />);
    await identity(user);
    expect(await screen.findByText("No paid accounts found")).toBeInTheDocument();
    await fileMethod(user);
    expect(screen.getByLabelText("Choose auth.json file")).toBeInTheDocument();
    expect(screen.getByLabelText("Step 3 of 3")).toBeInTheDocument();
  });
  it("preserves existing selection across back, and removes unavailable accounts on reload", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([])); render(<App />); await identity(user);

    await user.click(await screen.findByRole("checkbox", { name: "Add Claude to workspace" }));
    await user.click(screen.getByRole("button", { name: "Back" })); await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("checkbox", { name: "Add Claude to workspace" })).toBeChecked();
    expect(api.loadSetupAccounts).toHaveBeenCalledTimes(1);
    api.loadSetupAccounts.mockResolvedValue([{...stagedClaude,id:"changed",email:"another@example.com"}]);
    await user.click(screen.getByRole("button", { name: "Load again" })); await screen.findByText("another@example.com");
    expect(screen.getByRole("checkbox", { name: "Add Claude to workspace" })).not.toBeChecked();
  });
  it("keeps discovery errors inline and the new-account route reachable", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([])); api.loadSetupAccounts.mockRejectedValue(new Error("Cannot read CLI accounts"));
    render(<App />); await identity(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot read CLI accounts"); await fileMethod(user);
    expect(screen.getByLabelText("Choose auth.json file")).toBeInTheDocument();
  });
  it("keeps a workspace draft until the user explicitly discards it", async () => {
    const user = userEvent.setup(); render(<App />); await user.click(await screen.findByRole("combobox", { name: "Workspace" }));
    await user.click(screen.getByRole("button", { name: "New workspace" }));
    await user.type(screen.getByLabelText("Workspace name"), "Unsaved"); await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" })); expect(screen.getByLabelText("Workspace name")).toHaveValue("Unsaved");
    await user.keyboard("{Escape}"); await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(api.commitAccountSetup).not.toHaveBeenCalled();
  });
  it("keeps file enrollment in a modal with workspace save actions unavailable", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([])); render(<App />); await identity(user); await fileMethod(user);
    await uploadAuth(user, '{"fixture":true}');
    expect(screen.getByRole("dialog", { name: "Add account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create workspace" })).not.toBeInTheDocument();
    expect(screen.queryByText("Enter a file path instead")).not.toBeInTheDocument();
    expect(screen.queryByText("claude@example.com")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByLabelText("Account name")).not.toBeInTheDocument();
    expect(screen.getByText("Ready to verify")).toBeInTheDocument();
    expect(api.importSetupAccount).not.toHaveBeenCalled();
  });
  it("verifies a file before allowing final workspace commit and never activates it", async () => {
    api.importSetupAccount.mockResolvedValue({ ...stagedCodex, name: "Emma Brooks", displayName: "Emma Brooks" });
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([])); api.commitAccountSetup.mockImplementation(async () => {api.getState.mockResolvedValue(savedState());return savedState();});
    render(<App />); await user.type(await screen.findByLabelText("Workspace name"), "Studio");
    await user.click(screen.getByRole("button", { name: "Next" })); await fileMethod(user); expect(screen.queryByLabelText("Account name")).not.toBeInTheDocument(); await uploadAuth(user, '{"fixture":true}');
    expect(screen.queryByRole("button", { name: "Create workspace" })).not.toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Verify account" }));
    expect(api.importSetupAccount).toHaveBeenCalledWith("draft", "codex", "", {credentials:'{"fixture":true}'});
    await screen.findByText("Account added");
    expect(screen.queryByRole("dialog", { name: "Add account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByText("Account verified and ready to add")).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Added accounts" })).getByText("backup@example.com")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Added accounts" })).getByText("Emma Brooks")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Include Emma Brooks" })).toBeChecked();
    expect(screen.queryByText("claude@example.com")).not.toBeInTheDocument();
    expect(api.commitAccountSetup).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(api.commitAccountSetup).toHaveBeenCalledWith("draft", "Studio", "#625cc1", [stagedCodex.id], null);
    expect(await screen.findByRole("article", {name:"Personal account account"})).toBeInTheDocument(); expect(api.activateCodexProfile).not.toHaveBeenCalled();
  });
  it("rejects failed or unknown paid-plan verification without committing a workspace", async () => {
    const user = userEvent.setup(); api.getState.mockResolvedValue(savedState([])); api.importSetupAccount.mockRejectedValue(new Error("A paid plan could not be confirmed"));
    render(<App />); await identity(user); await fileMethod(user); await uploadAuth(user,"{}");
    await user.click(screen.getByRole("button", {name:"Verify account"})); expect(await screen.findByRole("alert")).toHaveTextContent("paid plan");
    expect(screen.queryByRole("button", {name:"Create workspace"})).not.toBeInTheDocument(); expect(api.commitAccountSetup).not.toHaveBeenCalled();
  });
  it("adds a file to an existing workspace through the same staged flow", async () => {
    const user = userEvent.setup(); render(<App />); await user.click(await screen.findByRole("button", {name:"Add Account"}));
    expect(screen.getByRole("group", {name:"Choose provider"})).toBeInTheDocument();
    expect(screen.getAllByRole("dialog", {hidden:true})).toHaveLength(1);
    expect(screen.queryByRole("button", {name:"Add accounts"})).not.toBeInTheDocument();
    await fileMethod(user);
    await uploadAuth(user,'{"fixture":true}'); await user.click(screen.getByRole("button",{name:"Verify account"}));
    await screen.findByText("Account added");
    expect(screen.getByRole("heading", { name: "Studio", level: 3 })).toHaveFocus();
    const account = screen.getByRole("checkbox", { name: `Include ${stagedCodex.name}` });
    const submit = screen.getByRole("button", { name: "Add accounts" });
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(account).not.toBeChecked();
    expect(submit).toBeDisabled();
    expect(screen.getByText("0 selected")).toBeVisible();
    await user.click(account);
    expect(screen.getByText("1 selected")).toBeVisible();
    await user.click(submit);
    expect(api.commitAccountSetup).toHaveBeenCalledWith("draft","Studio","#7c6cf0",[stagedCodex.id],"studio");
  });
  it("supports browser sign-in and only adds the verified resulting account", async () => {
    const user = userEvent.setup(); render(<App />); await user.click(await screen.findByRole("button",{name:"Add Account"}));
    await user.click(screen.getByRole("button",{name:"ChatGPT / Codex"})); await user.click(screen.getByRole("button",{name:/Sign in with ChatGPT/}));
    expect(screen.queryByLabelText("Account name")).not.toBeInTheDocument(); expect(screen.queryByRole("button",{name:"Continue in browser"})).not.toBeInTheDocument();
    expect(await screen.findByText(/Finish signing in/)).toBeInTheDocument(); expect(api.commitAccountSetup).not.toHaveBeenCalled();
    expect(opener.openUrl).toHaveBeenCalledWith("https://auth.openai.com/authorize"); await screen.findByText("Account added");
    expect(api.startSetupLogin).toHaveBeenCalledWith("draft","codex","browser","");
  });
  it("cancels a pending device login and discards its draft on confirmed close", async () => {
    const user = userEvent.setup(); api.startSetupLogin.mockResolvedValue({attemptId:"device",status:"pending",authUrl:"https://auth.openai.com/codex/device",userCode:"ABCD-EFGH",error:null,account:null}); api.pollSetupLogin.mockReturnValue(new Promise(()=>{}));
    render(<App />); await user.click(await screen.findByRole("button",{name:"Add Account"}));
    await user.click(screen.getByRole("button",{name:"ChatGPT / Codex"})); await user.click(screen.getByRole("button",{name:/Use a device code/}));
    expect(screen.queryByLabelText("Account name")).not.toBeInTheDocument(); expect(screen.queryByRole("button",{name:"Get device code"})).not.toBeInTheDocument(); expect(api.startSetupLogin).toHaveBeenCalledWith("draft","codex","device","");
    expect(await screen.findByText("ABCD-EFGH")).toBeInTheDocument(); await user.click(screen.getByRole("button",{name:"Cancel sign-in"})); expect(api.cancelSetupLogin).toHaveBeenCalledWith("draft");
    await screen.findByRole("button", { name: /Use a device code/ });
    await user.click(screen.getByRole("button",{name:"Close"})); await waitFor(()=>expect(api.discardAccountSetup).toHaveBeenCalledWith("draft"));
  });
  it("returns failed direct starts to the method picker and retries only on another choice", async () => {
    const user = userEvent.setup();
    api.startSetupLogin.mockRejectedValueOnce(new Error("CLI unavailable"));
    api.pollSetupLogin.mockReturnValue(new Promise(() => {}));
    render(<App />); await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
    await user.click(screen.getByRole("button", { name: "Sign in with ChatGPT" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("CLI unavailable");
    expect(await screen.findByRole("group", { name: "Choose sign-in method" })).toBeInTheDocument();
    expect(api.startSetupLogin).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Sign in with ChatGPT" }));
    expect(await screen.findByText(/Finish signing in/)).toBeInTheDocument();
    expect(api.startSetupLogin).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Cancel sign-in" }));
    expect(await screen.findByRole("group", { name: "Choose sign-in method" })).toBeInTheDocument();
  });
  it("returns to sign-in options when polling fails and focuses the step heading", async () => {
    const user = userEvent.setup();
    api.pollSetupLogin.mockRejectedValueOnce(new Error("Sign-in expired. Try again."));
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
    await user.click(screen.getByRole("button", { name: "Sign in with ChatGPT" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in expired");
    expect(await screen.findByRole("group", { name: "Choose sign-in method" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Connect your account" })).toHaveFocus());
    expect(screen.queryByText("Starting sign-in…")).not.toBeInTheDocument();
  });
  it("confirms a device code was copied without finishing sign-in", async () => {
    const user = userEvent.setup();
    api.startSetupLogin.mockResolvedValue({ attemptId: "device", status: "pending", authUrl: "https://auth.openai.com/codex/device", userCode: "ABCD-EFGH", error: null, account: null });
    api.pollSetupLogin.mockReturnValue(new Promise(() => {}));
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
    await user.click(screen.getByRole("button", { name: "Use a device code" }));
    await user.click(await screen.findByRole("button", { name: "Copy code" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe("ABCD-EFGH");
    expect(api.commitAccountSetup).not.toHaveBeenCalled();
  });
  it("blocks repeated direct starts while the first request is in flight", async () => {
    const user = userEvent.setup(); let finish!: (login: unknown) => void;
    api.startSetupLogin.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    api.pollSetupLogin.mockReturnValue(new Promise(() => {}));
    render(<App />); await user.click(await screen.findByRole("button", { name: "Add Account" }));
    await user.click(await screen.findByRole("button", { name: "ChatGPT / Codex" }));
    await user.dblClick(screen.getByRole("button", { name: "Use a device code" }));
    expect(api.startSetupLogin).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Starting sign-in…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    await act(async () => finish({ attemptId: "direct", status: "pending", authUrl: null, userCode: "ABCD", error: null, account: null }));
    expect(await screen.findByText("ABCD")).toBeInTheDocument();
  });
  it("provides official Claude login and config-folder choices rather than a Codex file format", async () => {
    const user = userEvent.setup(); render(<App />); await user.click(await screen.findByRole("button",{name:"Add Account"}));
    await user.click(screen.getByRole("button",{name:"Claude"}));
    expect(screen.getByRole("button",{name:/Sign in with Claude Code/})).toBeInTheDocument(); expect(screen.queryByRole("button",{name:/Import auth.json/})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:/Connect a configuration/})); await user.type(screen.getByLabelText("Account name"),"Work Claude"); await user.type(screen.getByLabelText("Claude configuration folder"),"~/.claude-work");
    await user.click(screen.getByRole("button",{name:"Verify account"})); expect(api.connectSetupConfig).toHaveBeenCalledWith("draft","Work Claude","~/.claude-work");
  });
  it("labels Antigravity experimental and offers its own JSON import", async () => {
    const user = userEvent.setup(); render(<App />); await user.click(await screen.findByRole("button",{name:"Add Account"}));
    await user.click(screen.getByRole("button",{name:"Antigravity"}));
    expect(screen.getByRole("button",{name:/Sign in with Google/})).toBeInTheDocument(); await user.click(screen.getByRole("button",{name:/Import credentials JSON/}));
    expect(screen.getByLabelText("Choose credentials.json file")).toBeInTheDocument(); expect(screen.getByText(/Experimental integration/)).toBeInTheDocument();
  });
  it("saves selected existing and new accounts together in one final commit", async () => {
    const user=userEvent.setup();api.getState.mockResolvedValue(savedState([]));render(<App />);await identity(user);
    await user.click(await screen.findByRole("checkbox",{name:"Add Claude to workspace"}));
    await fileMethod(user);await uploadAuth(user,'{"fixture":true}');await user.click(screen.getByRole("button",{name:"Verify account"}));
    await screen.findByText("Account added");expect(api.commitAccountSetup).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button",{name:"Create workspace"}));expect(api.commitAccountSetup).toHaveBeenCalledWith("draft","Lab","#625cc1",[stagedClaude.id,stagedCodex.id],null);
  });
  it("keeps the draft open after commit failure and retries without repeating login", async () => {
    const user=userEvent.setup();api.getState.mockResolvedValue(savedState([]));api.commitAccountSetup.mockRejectedValueOnce(new Error("Cannot save settings"));render(<App />);await identity(user);
    await user.click(await screen.findByRole("checkbox",{name:"Add Claude to workspace"}));await user.click(screen.getByRole("button",{name:"Next"}));await user.click(screen.getByRole("button",{name:"Create workspace"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot save settings");expect(screen.getByText(/Optional: add another account/)).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Create workspace"}));expect(api.commitAccountSetup).toHaveBeenCalledTimes(2);
  });
  it("renders saved accounts and hides unselected providers", async () => {
    api.getState.mockResolvedValue(savedState([{...studio,providerIds:[]}])); render(<App />); await screen.findByRole("article",{name:"Personal account account"}); expect(screen.queryByRole("region",{name:"Claude accounts"})).not.toBeInTheDocument();
  });
  it("switches workspaces without changing the active CLI login", async () => {
    const user=userEvent.setup(); const first={...studio,accountIds:[personal.id]}; const second={...studio,id:"second",name:"Second",accountIds:[work.id]}; api.getState.mockResolvedValue(savedState([first,second])); api.selectWorkspace.mockResolvedValue(savedState([first,second],second.id));
    render(<App />); await screen.findByRole("article",{name:"Personal account account"}); await user.click(screen.getByRole("combobox",{name:"Workspace"})); await user.click(screen.getByRole("option",{name:"Second"}));
    expect(await screen.findByRole("article",{name:"Work account account"})).toBeInTheDocument(); expect(screen.queryByRole("article",{name:"Personal account account"})).not.toBeInTheDocument(); expect(api.activateCodexProfile).not.toHaveBeenCalled();
  });
});

describe("limit countdown and quick switching", () => {
  it("moves Active immediately on native success before the profile refresh returns", async () => {
    let switched!: (event: { payload: string }) => void;
    nativeEvents.listen.mockImplementation(async (name, callback) => { if (name === "codex-profile-switched") switched = callback; return vi.fn(); });
    render(<App />);
    const oldCard = await screen.findByRole("article", { name: "Personal account account" });
    expect(within(oldCard).getByText("Active")).toBeInTheDocument();
    api.codexProfiles.mockImplementation(() => new Promise(() => {}));
    await act(async () => switched({ payload: work.id }));
    expect(within(screen.getByRole("article", { name: "Work account account" })).getByText("Active")).toBeInTheDocument();
    expect(within(oldCard).queryByText("Active")).not.toBeInTheDocument();
  });

  it("selects the switched account for a menu bar using the same provider before refresh finishes", async () => {
    let switched!: (event: { payload: string }) => void;
    nativeEvents.listen.mockImplementation(async (name, callback) => { if (name === "codex-profile-switched") switched = callback; return vi.fn(); });
    api.getState.mockResolvedValue(savedState([{ ...studio, usage: { ...studio.usage, menuBarProvider: "codex", menuBarAccountId: personal.id } }]));
    const user = userEvent.setup(); render(<App />);
    await screen.findByRole("article", { name: "Work account account" });
    api.getState.mockImplementation(() => new Promise(() => {}));
    await act(async () => switched({ payload: work.id }));
    await user.click(screen.getByRole("combobox", { name: "Workspace" }));
    await user.click(screen.getByRole("button", { name: "Edit workspace" }));
    await user.click(await screen.findByRole("tab", { name: "Menu bar" }));
    expect(screen.getByLabelText("Menu bar active account")).toHaveTextContent(work.name);
  });

  const fixed = Date.parse("2026-10-17T10:00:00Z");
  function exhausted() {
    vi.spyOn(Date, "now").mockReturnValue(fixed);
    api.codexProfileQuota.mockImplementation(async (id) => ({ provider: "codex", windows: id === personal.id ? [
      { window: "5-hour", percent: 100, resetsAt: "2026-10-17T11:00:00Z" },
      { window: "weekly", percent: 100, resetsAt: "2026-10-18T14:15:00Z" },
    ] : [{ window: "5-hour", percent: 20, resetsAt: "2026-10-17T14:00:00Z" }] }));
  }
  it("shows progress on the requested account while checking its capacity", async () => {
    const user = userEvent.setup(); render(<App />);
    await screen.findByRole("article", { name: "Work account account" });
    await waitFor(() => expect(screen.getByRole("group", { name: "Usage for Work account" })).toHaveAccessibleDescription());
    let resolve!: (quota: { provider: string; windows: { window: string; percent: number }[] }) => void;
    api.codexProfileQuota.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const switchButton = screen.getByRole("button", { name: "Switch to Work account" });
    await user.click(switchButton);
    expect(switchButton).toHaveAttribute("aria-busy", "true");
    expect(switchButton).toBeDisabled();
    await act(async () => { resolve({ provider: "codex", windows: [{ window: "weekly", percent: 100 }] }); });
    await screen.findByRole("dialog", { name: "Account limit reached" });
    expect(api.scheduleCodexRestart).not.toHaveBeenCalled();
  });
  it("warns before switching to a freshly limited account and never schedules a restart", async () => {
    const user = userEvent.setup(); render(<App />);
    await screen.findByRole("article", { name: "Work account account" });
    api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "weekly", percent: 100, resetsAt: new Date(Date.now() + 3_600_000).toISOString() }] });
    await user.click(screen.getByRole("button", { name: "Switch to Work account" }));
    const warning = await screen.findByRole("dialog", { name: "Account limit reached" });
    expect(warning).toHaveTextContent("Work account");
    expect(warning).toHaveTextContent("Codex may be unavailable on this account until the limit resets");
    expect(warning).toHaveTextContent("Resets in");
    expect(api.scheduleCodexRestart).not.toHaveBeenCalled();
    expect(api.activateCodexProfile).not.toHaveBeenCalled();
    await user.click(within(warning).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Account limit reached" })).not.toBeInTheDocument();
  });
  it("switches anyway only after confirmation and keeps scheduling errors in the warning", async () => {
    const user = userEvent.setup(); render(<App />);
    await screen.findByRole("article", { name: "Work account account" });
    api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "weekly", percent: 100 }] });
    const status = { profileId: work.id, profileName: work.name, deadlineAt: new Date(Date.now()).toISOString(), phase: "quitting", error: null, processId: null, credentialsVerified: false };
    api.scheduleCodexRestart.mockRejectedValueOnce(new Error("Codex could not be started. Try again.")).mockResolvedValueOnce(status);
    await user.click(screen.getByRole("button", { name: "Switch to Work account" }));
    const warning = await screen.findByRole("dialog", { name: "Account limit reached" });
    expect(warning).toHaveTextContent("Reset time unavailable");
    expect(api.scheduleCodexRestart).not.toHaveBeenCalled();
    await user.click(within(warning).getByRole("button", { name: "Switch anyway" }));
    expect(await within(warning).findByRole("alert")).toHaveTextContent("Codex could not be started");
    expect(api.scheduleCodexRestart).toHaveBeenLastCalledWith(work.id, true);
    await user.click(within(warning).getByRole("button", { name: "Switch anyway" }));
    expect(await screen.findByLabelText("Account switch")).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "Switch to Work account" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("dialog", { name: "Account limit reached" })).not.toBeInTheDocument();
    expect(api.scheduleCodexRestart).toHaveBeenCalledTimes(2);
    expect(api.activateCodexProfile).not.toHaveBeenCalled();
  });
  it("disables repeated confirmation while an override is being scheduled", async () => {
    const user = userEvent.setup(); render(<App />);
    await screen.findByRole("article", { name: "Work account account" });
    api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "weekly", percent: 100 }] });
    let finish!: (value: unknown) => void;
    api.scheduleCodexRestart.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await user.click(screen.getByRole("button", { name: "Switch to Work account" }));
    const warning = await screen.findByRole("dialog", { name: "Account limit reached" });
    const confirm = within(warning).getByRole("button", { name: "Switch anyway" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(api.scheduleCodexRestart).toHaveBeenCalledExactlyOnceWith(work.id, true);
    expect(within(warning).getByRole("button", { name: "Starting switch…" })).toBeDisabled();
    expect(within(warning).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(warning).getByRole("status")).toHaveTextContent("Starting account switch");
    await act(async () => finish({ profileId: work.id, profileName: work.name, deadlineAt: new Date(Date.now()).toISOString(), phase: "quitting", error: null, processId: null, credentialsVerified: false }));
    expect(screen.queryByRole("dialog", { name: "Account limit reached" })).not.toBeInTheDocument();
  });
  it("does not retain the capacity override after dismissing a warning", async () => {
    const user = userEvent.setup(); render(<App />);
    await screen.findByRole("article", { name: "Work account account" });
    api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "5-hour", percent: 100 }] });
    await user.click(screen.getByRole("button", { name: "Switch to Work account" }));
    const warning = await screen.findByRole("dialog", { name: "Account limit reached" });
    await user.click(within(warning).getByRole("button", { name: "Cancel" }));
    api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "5-hour", percent: 20 }] });
    api.scheduleCodexRestart.mockResolvedValue({ profileId: work.id, profileName: work.name, deadlineAt: new Date(Date.now()).toISOString(), phase: "quitting", error: null, processId: null, credentialsVerified: false });
    await user.click(screen.getByRole("button", { name: "Switch to Work account" }));
    await waitFor(() => expect(api.scheduleCodexRestart).toHaveBeenCalledWith(work.id));
    expect(api.scheduleCodexRestart).toHaveBeenCalledTimes(1);
  });
  it("checks fresh usage and schedules a manual switch when the target still has capacity", async () => {
    const user = userEvent.setup();
    api.scheduleCodexRestart.mockResolvedValue({ profileId: work.id, profileName: work.name, deadlineAt: new Date(Date.now()).toISOString(), phase: "quitting", error: null, processId: null, credentialsVerified: false });
    render(<App />); await screen.findByRole("article", { name: "Work account account" });
    api.codexProfileQuota.mockClear();
    await user.click(screen.getByRole("button", { name: "Switch to Work account" }));
    await waitFor(() => expect(api.scheduleCodexRestart).toHaveBeenCalledWith(work.id));
    expect(api.codexProfileQuota).toHaveBeenCalledWith(work.id);
    expect(screen.queryByRole("dialog", { name: "Account limit reached" })).not.toBeInTheDocument();
  });
  it("shows the effective recovery time and starts an immediate native switch with one click", async () => {
    const user = userEvent.setup(); exhausted();
    const status = { profileId: work.id, profileName: work.name, deadlineAt: "2026-10-17T10:00:00Z", phase: "quitting", error: null, processId: null, credentialsVerified: false };
    api.scheduleCodexRestart.mockResolvedValue(status);
    api.cancelCodexRestart.mockResolvedValue({ ...status, phase: "cancelled" });
    render(<App />);
    expect(await screen.findByLabelText("Account usage limit")).toHaveTextContent("Limit reached");
    expect(screen.queryByText("Resets in 28h 15m")).not.toBeInTheDocument();
    const weekly = within(screen.getByRole("article", {name:"Personal account account"})).getByRole("meter", {name:"Weekly remaining"});
    expect(weekly).toHaveAttribute("aria-valuetext", expect.stringContaining("Resets"));
    expect(weekly).toHaveAttribute("aria-valuetext", expect.stringContaining("2026"));
    await user.click(screen.getByRole("button", { name: "Switch to next available account" }));
    expect(api.scheduleCodexRestart).toHaveBeenCalledWith(work.id);
    expect(await screen.findByLabelText("Account switch")).toHaveClass("sr-only");
    expect(screen.queryByRole("button", { name: "Switch now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(api.cancelCodexRestart).not.toHaveBeenCalled();
    expect(api.activateCodexProfile).not.toHaveBeenCalled();
  });
  it("disables quick switching when no account has usable quota", async () => {
    exhausted(); api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "weekly", percent: 100, resetsAt: "2026-10-18T14:15:00Z" }] });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Switch to next available account" })).toBeDisabled();
    expect(api.scheduleCodexRestart).not.toHaveBeenCalled();
  });
});

describe("settings and refresh", () => {
  it("keeps account management out of global settings and workspace usage out of global saves", async () => {
    const user = userEvent.setup(); api.updateWorkspace.mockImplementation(async (workspace) => savedState([workspace]));
    render(<App />); await screen.findByRole("combobox", { name: "Workspace" });
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Global settings" })).toBeInTheDocument();
    expect(screen.queryByText("Codex account")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Include reset predictions" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("combobox", { name: "Workspace" }));
    await user.click(screen.getByRole("button", { name: "Edit workspace" }));
    await screen.findByRole("tab", { name: "General" });
    for (const name of ["General", "Usage", "Menu bar"]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Usage" }));
    await user.click(screen.getByRole("switch", { name: "Show reset updates" }));
    expect(api.updateWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: "studio", usage: expect.objectContaining({ showCodexResets: false }) }));
    expect(api.setAppSettings).not.toHaveBeenCalled();
  });

  it("opens account settings with only rename and removal, separately from workspace preferences", async () => {
    const user = userEvent.setup();
    api.renameCodexProfile.mockResolvedValue({ profiles: [personal, { ...work, name: "Office" }], activeProfileId: personal.id, canImport: true, switchError: null });
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Edit Work account" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit account" });
    expect(within(dialog).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Replace login" })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Account name"));
    await user.type(screen.getByLabelText("Account name"), "Office");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(api.renameCodexProfile).toHaveBeenCalledWith(work.id, "Office"));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Workspace" }));
    await user.click(screen.getByRole("button", { name: "Edit workspace" }));
    expect(screen.queryByRole("tab", { name: "Accounts" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Edit Office" }));
    expect(screen.getByLabelText("Account name")).toHaveValue("Office");
    expect(screen.queryByRole("button", { name: "Account color Moss" })).not.toBeInTheDocument();
  });

  it.each([false, true])("removes an account with forget=%s only after confirmation", async (forget) => {
    const user = userEvent.setup();
    api.removeWorkspaceAccount.mockResolvedValue(savedState([{ ...studio, accountIds: [personal.id] }]));
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Edit Work account" }));
    await user.click(screen.getByRole("button", { name: "Remove account" }));
    expect(api.removeWorkspaceAccount).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: forget ? "Forget in all workspaces" : "Remove from this workspace" }));
    await waitFor(() => expect(api.removeWorkspaceAccount).toHaveBeenCalledWith(studio.id, "codex", work.id, forget));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Work account account" })).not.toBeInTheDocument();
  });

  it.each([["claude", false], ["claude", true], ["antigravity", false], ["antigravity", true]] as const)("uses the same rename/remove settings for %s with forget=%s", async (provider, everywhere) => {
    const user = userEvent.setup();
    const id = `${provider}-saved`;
    const name = `${provider} Personal`;
    const account = { id, name, email: "account@example.com", configDir: "/tmp/claude-test", createdAt: "2026-10-01", active: true, connected: true, subscription: { id: provider, service: provider, plan: "pro" }, loginCommand: "", launchCommand: "", quota: null };
    const workspace = { ...studio, claudeAccountIds: provider === "claude" ? [id] : [], antigravityAccountIds: provider === "antigravity" ? [id] : [] };
    api.getState.mockResolvedValue(savedState([workspace]));
    api.claudeProfiles.mockResolvedValue(provider === "claude" ? [account] : []);
    api.antigravityAccounts.mockResolvedValue([{ ...account, provider: "antigravity" }]);
    api.editClaudeProfile.mockResolvedValue([{ ...account, name: "Office" }]);
    api.renameAntigravityAccount.mockResolvedValue(undefined);
    render(<App />);
    await user.click(await screen.findByRole("button", { name: `Edit ${name}` }));
    const dialog = screen.getByRole("dialog", { name: "Edit account" });
    expect(within(dialog).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Configuration directory")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Account name"));
    await user.type(screen.getByLabelText("Account name"), "Office");
    const rename = provider === "claude" ? api.editClaudeProfile : api.renameAntigravityAccount;
    rename.mockRejectedValueOnce(new Error("Could not save account name"));
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save account name");
    expect(screen.getByLabelText("Account name")).toHaveValue("Office");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(provider === "claude" ? api.editClaudeProfile : api.renameAntigravityAccount).toHaveBeenCalledWith(id, "Office"));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: "Edit Office" }));
    expect(screen.getByLabelText("Account name")).toHaveValue("Office");
    await user.click(screen.getByRole("button", { name: "Remove account" }));
    expect(api.removeWorkspaceAccount).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Keep account" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep account" }));
    expect(screen.getByRole("button", { name: "Remove account" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Forget in all workspaces" })).not.toBeInTheDocument();
    api.removeWorkspaceAccount.mockResolvedValue(savedState([{ ...workspace, claudeAccountIds: [], antigravityAccountIds: [] }]));
    await user.click(screen.getByRole("button", { name: "Remove account" }));
    await user.click(screen.getByRole("button", { name: everywhere ? "Forget in all workspaces" : "Remove from this workspace" }));
    await waitFor(() => expect(api.removeWorkspaceAccount).toHaveBeenCalledWith(studio.id, provider, id, everywhere));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Office" })).not.toBeInTheDocument();
  });

  it("restores global settings tabs while keeping usage in the workspace", async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    for (const name of ["General", "Updates"]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Alerts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Display" })).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Color theme" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("combobox", { name: "Workspace" }));
    await user.click(screen.getByRole("button", { name: "Edit workspace" }));
    await user.click(screen.getByRole("tab", { name: "Menu bar" }));
    expect(screen.getByRole("switch", { name: "Menu bar usage" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Global settings" })).not.toBeInTheDocument();
  });

  it("uses the shared iris accent despite legacy account and workspace colors", async () => {
    const initial = savedState(); initial.app.codexAccounts = { [work.id]: { ...DEFAULT_CODEX_ACCOUNT_PREFERENCES, color: "#2f9e6e" } };
    api.getState.mockResolvedValue(initial);
    render(<App />);
    await screen.findByRole("article", { name: "Work account account" });
    expect(screen.getByRole("article", { name: "Work account account" }).style.getPropertyValue("--accent")).toBe("");
    expect(screen.getByRole("article", { name: "Personal account account" }).style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#625cc1");
  });

  it("shows saved account quota inline and refreshes it without a usage popup", async () => {
    const user = userEvent.setup(); render(<App />);
    expect(await within(await screen.findByRole("group", {name:"Usage for Work account"})).findByText("80%")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/Usage limits/})).not.toBeInTheDocument();
    api.codexProfileQuota.mockResolvedValue({provider:"codex",windows:[{window:"5-hour",percent:21}]});
    await user.click(screen.getByRole("button",{name:"Refresh data"}));
    await waitFor(()=>expect(within(screen.getByRole("group",{name:"Usage for Work account"})).getByText("79%")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.cliQuotas).not.toHaveBeenCalled();
  });

  it("opens Banked Reset for the account with credit and omits the generic saved-reset action", async () => {
    api.codexProfileQuota.mockImplementation(async (id) => ({
      provider: "codex", windows: [{ window: "weekly", percent: 100 }],
      resetCredits: { availableCount: id === work.id ? 0 : 1, planType: "plus" },
    }));
    api.codexBankedResets.mockResolvedValue({ availableCount: 0, credits: [], pendingCredit: null });
    const user = userEvent.setup();
    render(<App />);
    const card = within(await screen.findByRole("article", { name: "Personal account account" }));
    expect(card.getByRole("meter", { name: "Weekly remaining" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Switch to next available account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /saved reset/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Banked Reset for/ })).toHaveLength(1);
    expect(api.codexBankedResets).not.toHaveBeenCalled();
    const resetButton = card.getByRole("button", { name: "Banked Reset for Personal account, 1 available" });
    expect(resetButton).toHaveTextContent(/^1$/);
    await user.click(resetButton);
    const dialog = await screen.findByRole("dialog", { name: "Banked Reset" });
    expect(await within(dialog).findByText("No resets available")).toBeInTheDocument();
    expect(within(dialog).queryByRole("meter")).not.toBeInTheDocument();
    expect(api.codexBankedResets).toHaveBeenCalledWith(personal.id);
    expect(api.consumeCodexReset).not.toHaveBeenCalled();
  });

  it("recovers a rejected saved session through the same account and refetches usage after replacement", async () => {
    const user = userEvent.setup();
    api.codexProfileQuota.mockImplementation(async (id) => id === work.id
      ? { provider: "codex", error: "session could not be renewed — reconnect this account or replace its auth.json in account settings" }
      : { provider: "codex", windows: [{ window: "5-hour", percent: 20 }] });
    api.importCodexProfileJson.mockImplementation(async () => {
      api.codexProfileQuota.mockResolvedValue({ provider: "codex", windows: [{ window: "Weekly", percent: 12 }] });
      return { profiles: [personal, { ...work, needsActivation: true }], activeProfileId: personal.id, canImport: true, switchError: null };
    });
    render(<App />);
    expect(await screen.findByText(/session could not be renewed/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Reconnect account" }));
    expect(screen.queryByRole("dialog", { name: "Usage limits" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Replace login" }));
    await uploadAuth(user, '{"fixture":"renewed"}');
    await user.click(screen.getByRole("button", { name: "Save login" }));
    await waitFor(() => expect(api.importCodexProfileJson).toHaveBeenCalledWith(work.name, '{"fixture":"renewed"}', work.id));
    await screen.findByRole("button", { name: "Replace login" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(await within(await screen.findByRole("group", { name: "Usage for Work account" })).findByText("88%")).toBeInTheDocument();
    expect(api.activateCodexProfile).not.toHaveBeenCalled();
    expect(api.scheduleCodexRestart).not.toHaveBeenCalled();
  });

  it("updates inline usage from 18% to 17% at the configured refresh interval", async () => {
    vi.useFakeTimers(); vi.spyOn(document,"hasFocus").mockReturnValue(true);
    const state=savedState(); api.getState.mockResolvedValue({...state,app:{...state.app,refreshIntervalSecs:30}});
    api.codexProfileQuota.mockResolvedValue({provider:"codex",windows:[{window:"5-hour",percent:82}]});
    try {
      await act(async()=>{render(<App />);});
      expect(within(screen.getByRole("group",{name:"Usage for Work account"})).getByText("18%")).toBeInTheDocument();
      api.codexProfileQuota.mockResolvedValue({provider:"codex",windows:[{window:"5-hour",percent:83}]});
      await act(async()=>{vi.advanceTimersByTime(29_000);});
      expect(within(screen.getByRole("group",{name:"Usage for Work account"})).getByText("18%")).toBeInTheDocument();
      await act(async()=>{vi.advanceTimersByTime(1000);});
      expect(within(screen.getByRole("group",{name:"Usage for Work account"})).getByRole("meter")).toHaveAttribute("aria-valuenow","17");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.cliQuotas).not.toHaveBeenCalled();
    } finally {cleanup();vi.useRealTimers();}
  });

  it("loads saved accounts even if another provider probe fails", async () => {
    api.cliStatus.mockRejectedValue(new Error("probe failed")); render(<App />);
    expect(await screen.findByRole("article", { name: "Personal account account" })).toBeInTheDocument();
    expect(screen.getByText("Couldn't read CLI status: probe failed")).toBeInTheDocument();
  });

  it("shows the initial loading skeleton and reports load failures", async () => {
    api.getState.mockReturnValueOnce(new Promise(() => {})); const view = render(<App />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument(); view.unmount();
    api.getState.mockRejectedValue(new Error("permission denied")); render(<App />);
    expect(await screen.findByText("Couldn't load settings: permission denied")).toBeInTheDocument();
  });


});

describe("home page actions and recovery", () => {
  it("keeps settings, refresh and the primary add action available in an empty workspace", async () => {
    api.getState.mockResolvedValue(savedState([{ ...studio, accountIds: [], providerIds: [], claudeAccountIds: [] }]));
    api.cliStatus.mockResolvedValue([]);
    api.codexProfiles.mockResolvedValue({ profiles: [], activeProfileId: null, canImport: false, switchError: null });
    render(<App />);
    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    expect(screen.queryByText("No current Codex accounts")).not.toBeInTheDocument();
    const actions = screen.getByRole("contentinfo", { name: "Account and app actions" });
    expect(within(actions).getByRole("button", { name: "Add Account" })).toBeEnabled();
    expect(screen.getByRole("main", { name: "Accounts" })).not.toContainElement(actions);
    expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refresh data" })).toBeEnabled();
    await userEvent.setup().click(within(actions).getByRole("button", { name: "Add Account" }));
    expect(await screen.findByRole("dialog", { name: "Add Account" })).toBeInTheDocument();
  });

  it("retries an account-list failure beside its error without losing page actions", async () => {
    api.codexProfiles.mockRejectedValueOnce(new Error("Temporary read failure"));
    render(<App />);
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Temporary read failure");
    await userEvent.setup().click(within(error).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("article", { name: "Personal account account" })).toBeInTheDocument();
    expect(screen.queryByText(/Temporary read failure/)).not.toBeInTheDocument();
  });
});

it("hands focus from the workspace picker to the creation dialog", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("combobox", { name: "Workspace" }));
  await user.click(screen.getByRole("button", { name: "New workspace" }));
  const dialog = await screen.findByRole("dialog", { name: "Create workspace" });
  await waitFor(() => expect(within(dialog).getByRole("textbox", { name: "Workspace name" })).toHaveFocus());
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Workspace" })).toHaveFocus());
});
