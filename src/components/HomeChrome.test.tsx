import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { HomeActions, HomeHeader } from "./HomeChrome";
import { DEFAULT_WORKSPACE_USAGE } from "../types";
const workspace={id:"one",name:"Person",accent:"#007aff",accountIds:[],usage:DEFAULT_WORKSPACE_USAGE};
const props=()=>({workspace,workspaces:[workspace],workspaceBusy:false,refreshing:false,updatedAt:"2026-11-04T10:00:00Z",onSelect:vi.fn(),onRefresh:vi.fn(),onWorkspaceSettings:vi.fn(),onQuit:vi.fn(),onCreate:vi.fn()});
afterEach(cleanup);
it("keeps routine freshness out of the header and offers it on the refresh control",async()=>{
  const base=props(),user=userEvent.setup();render(<HomeHeader {...base} />);
  expect(screen.queryByText(/Updated|last checked/)).not.toBeInTheDocument();
  expect(screen.getByRole("heading",{name:"Accounts"})).toHaveClass("sr-only");
  await user.hover(screen.getByRole("button",{name:"Refresh data"}));
  expect(await screen.findByRole("tooltip")).toHaveTextContent(/Refresh.*last checked.*Nov 4.*10:00/);
  await user.click(screen.getByRole("button",{name:"Refresh data"}));
  expect(base.onRefresh).toHaveBeenCalledOnce();
});
it("keeps refreshing feedback accessible and blocks duplicate refresh requests",()=>{
  const base=props();render(<HomeHeader {...base} refreshing />);
  expect(screen.getByRole("button",{name:"Refresh data"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"Refresh data"})).toHaveAttribute("aria-busy","true");
  expect(screen.getByRole("status")).toHaveTextContent("Refreshing accounts…");
  expect(screen.queryByRole("button",{name:"Settings"})).not.toBeInTheDocument();
});

it("offers one icon-only app settings action and keeps workspace actions in the picker", async () => {
  const user = userEvent.setup(), base = props(), settings = vi.fn();
  render(<><HomeHeader {...base} /><HomeActions busy={false} onAdd={vi.fn()} onSettings={settings} onQuit={vi.fn()} /></>);
  expect(screen.getAllByRole("button", { name: "Settings" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Settings" })).toHaveTextContent("");
  expect(screen.queryByRole("button", { name: "Workspace settings" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create workspace" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(settings).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("combobox", { name: "Workspace" }));
  expect(screen.getByRole("button", { name: "Edit workspace" })).toHaveTextContent("");
  expect(screen.getByRole("button", { name: "Edit workspace" }).closest(".workspace-current-card")).toContainElement(screen.getByRole("option", { name: "Person" }));
  expect(screen.getByRole("button", { name: "Edit workspace" }).closest("[role=listbox]")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Edit workspace" }));
  expect(base.onWorkspaceSettings).toHaveBeenCalledOnce();
  expect(screen.getByRole("combobox", { name: "Workspace" })).toHaveFocus();
});
it("keeps app settings and quit available while workspace changes are busy", () => {
  render(<HomeActions busy onAdd={vi.fn()} onSettings={vi.fn()} onQuit={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Add Account" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Quit Aiturn" })).toBeEnabled();
});
