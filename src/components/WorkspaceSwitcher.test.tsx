import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { DEFAULT_WORKSPACE_USAGE } from "../types";

const studio = { id: "studio", name: "Studio", accent: "#007aff", accountIds: [], usage: DEFAULT_WORKSPACE_USAGE };
const workspaces = [studio, { ...studio, id: "lab", name: "Research lab" }, { ...studio, id: "personal", name: "Personal" }];
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
});

function controlledAnimations(reduced = false) {
  const finishers: (() => void)[] = [];
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
    finished: new Promise<void>(resolve => { finishers.push(resolve); }), cancel: vi.fn(),
  }));
  Object.defineProperty(Element.prototype, "animate", { configurable: true, writable: true, value: animate });
  return { animate, finishers };
}

it("focuses the current workspace and navigates the full list with the keyboard", async () => {
  const user = userEvent.setup(), select = vi.fn();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={select} onCreate={vi.fn()} />);
  const trigger = screen.getByRole("combobox", { name: "Workspace" });
  await user.click(trigger);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Studio" })).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("option", { name: "Research lab" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(select).toHaveBeenCalledExactlyOnceWith("lab");
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("offers creation and never reselects the current workspace", async () => {
  const user = userEvent.setup(), select = vi.fn(), create = vi.fn();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={select} onCreate={create} />);
  const trigger = screen.getByRole("combobox", { name: "Workspace" });
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "Studio" }));
  expect(select).not.toHaveBeenCalled();
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "New workspace" }));
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
});

it("closes with Escape and prevents opening during a workspace switch", async () => {
  const user = userEvent.setup();
  const props = { workspace: studio, workspaces, status: null, onSelect: vi.fn(), onCreate: vi.fn() };
  const view = render(<WorkspaceSwitcher {...props} busy={false} />);
  await user.click(screen.getByRole("combobox", { name: "Workspace" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("dialog")).toHaveAttribute("data-motion", "instant");
  await user.keyboard("{Escape}");
  view.rerender(<WorkspaceSwitcher {...props} busy />);
  expect(screen.getByRole("combobox", { name: "Workspace" })).toBeDisabled();
});

it("keeps assistive click activation instant after a previous pointer opening", async () => {
  const user = userEvent.setup();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={vi.fn()} onCreate={vi.fn()} />);
  const trigger = screen.getByRole("combobox", { name: "Workspace" });
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Close workspace picker" }));
  fireEvent.click(trigger, { detail: 0 });
  expect(screen.getByRole("dialog")).toHaveAttribute("data-motion", "instant");
});

it.each(["close button", "outside click", "workspace selection"])("finishes the exit before unmounting after %s", async method => {
  const { finishers } = controlledAnimations();
  const user = userEvent.setup();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={vi.fn()} onCreate={vi.fn()} />);
  await user.click(screen.getByRole("combobox", { name: "Workspace" }));
  if (method === "close button") await user.click(screen.getByRole("button", { name: "Close workspace picker" }));
  else if (method === "outside click") await user.click(document.querySelector(".workspace-picker-overlay")!);
  else await user.click(screen.getByRole("option", { name: "Research lab" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await act(async () => { finishers.forEach(finish => finish()); });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("lets an exit finish when Escape is pressed during pointer dismissal", async () => {
  const { finishers } = controlledAnimations();
  const user = userEvent.setup();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={vi.fn()} onCreate={vi.fn()} />);
  const trigger = screen.getByRole("combobox", { name: "Workspace" });
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Close workspace picker" }));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await act(async () => { finishers.forEach(finish => finish()); });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("animates Escape dismissal after a keyboard opening", async () => {
  const { animate, finishers } = controlledAnimations();
  const user = userEvent.setup();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={vi.fn()} onCreate={vi.fn()} />);
  screen.getByRole("combobox", { name: "Workspace" }).focus();
  await user.keyboard("{Enter}");
  expect(animate).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(animate).toHaveBeenCalled();
  await act(async () => { finishers.forEach(finish => finish()); });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("uses opacity-only motion when reduced motion is requested", async () => {
  const { animate } = controlledAnimations(true);
  const user = userEvent.setup();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={vi.fn()} onCreate={vi.fn()} />);
  await user.click(screen.getByRole("combobox", { name: "Workspace" }));
  expect(animate).toHaveBeenCalled();
  for (const [frames, options] of animate.mock.calls) {
    expect(options.duration).toBe(100);
    expect(frames.every(frame => !("transform" in frame))).toBe(true);
  }
});


it.each(["Edit workspace", "New workspace"])("waits for picker exit before opening %s and keeps a stable focus origin", async label => {
  const { finishers } = controlledAnimations();
  const user = userEvent.setup(), edit = vi.fn(), create = vi.fn();
  render(<WorkspaceSwitcher workspace={studio} workspaces={workspaces} busy={false} status={null} onSelect={vi.fn()} onCreate={create} onEdit={edit} />);
  const trigger = screen.getByRole("combobox", { name: "Workspace" });
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: label }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(edit).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  await act(async () => { finishers.forEach(finish => finish()); });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  if (label === "Edit workspace") { expect(edit).toHaveBeenCalledOnce(); expect(create).not.toHaveBeenCalled(); }
  else { expect(create).toHaveBeenCalledExactlyOnceWith(trigger); expect(edit).not.toHaveBeenCalled(); }
});
