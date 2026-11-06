import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AntigravityAccounts } from "./AntigravityAccounts";
import { DEFAULT_WORKSPACE_USAGE } from "../types";
import type { SetupAccount } from "../api";

const list = vi.hoisted(() => vi.fn());
vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), antigravityAccounts: list }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const account = (id: string): SetupAccount => ({ id, provider: "antigravity", name: id, email: `${id}@example.com`, subscription: { id: "google", service: "Google", plan: "Pro" } });
const workspace = { id: "studio", name: "Studio", accent: "#007aff", accountIds: [], antigravityAccountIds: ["one"], usage: DEFAULT_WORKSPACE_USAGE };

it("keeps loading distinct from an error and recovers through Retry", async () => {
  let reject!: (error: Error) => void;
  list.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValueOnce([account("one")]);
  render(<AntigravityAccounts workspace={workspace} refreshKey={0} onChanged={vi.fn()} />);
  expect(screen.getByLabelText("Loading accounts")).toBeInTheDocument();
  await act(async () => reject(new Error("Offline")));
  expect(screen.getByRole("alert")).toHaveTextContent("Offline");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("article", { name: "one Antigravity account" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("ignores a delayed result from the previous workspace", async () => {
  let resolve!: (accounts: SetupAccount[]) => void;
  list.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce([account("two")]);
  const view = render(<AntigravityAccounts workspace={workspace} refreshKey={0} onChanged={vi.fn()} />);
  view.rerender(<AntigravityAccounts workspace={{ ...workspace, id: "next", antigravityAccountIds: ["two"] }} refreshKey={0} onChanged={vi.fn()} />);
  expect(await screen.findByRole("article", { name: "two Antigravity account" })).toBeInTheDocument();
  await act(async () => resolve([account("one")]));
  expect(screen.getByRole("article", { name: "two Antigravity account" })).toBeInTheDocument();
  expect(screen.queryByRole("article", { name: "one Antigravity account" })).not.toBeInTheDocument();
});


it("replaces the sign-in prompt when refresh confirms the saved Google account", async () => {
  list.mockResolvedValueOnce([account("one")]).mockResolvedValueOnce([{ ...account("one"), active: true }]);
  const props = { workspace: { ...workspace, usage: { ...workspace.usage, activeAccounts: { antigravity: "one" } } }, onChanged: vi.fn() };
  const view = render(<AntigravityAccounts {...props} refreshKey={0} />);
  expect(await screen.findByText(/Sign in with one of these accounts in Antigravity/)).toBeVisible();
  expect(screen.queryByText("Active")).not.toBeInTheDocument();
  view.rerender(<AntigravityAccounts {...props} refreshKey={1} />);
  expect(await within(await screen.findByRole("article", { name: "one Antigravity account" })).findByText("Active")).toBeVisible();
  expect(screen.queryByText(/Sign in with one of these accounts in Antigravity/)).not.toBeInTheDocument();
});
