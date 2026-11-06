import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountQuotaPreview, AccountUsagePreview, accountPreviewWindows, accountTimeMarker, resetDeadline } from "./AccountUsagePreview";
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("shows measured main limits in session/week order without a popup trigger", () => {
  const windows = accountPreviewWindows({provider:"codex",windows:[{window:"gpt-reserve",percent:90},{window:"weekly",percent:61},{window:"rolling",percent:28},{window:"5-hour",percent:30},{window:"model-extra",percent:10},{window:"monthly",percent:30}]});
  render(<AccountUsagePreview windows={windows} accountName="Emma" />);
  expect(screen.getByRole("group", {name:"Usage for Emma"})).toHaveAccessibleDescription("5-hour 72% remaining, Weekly 39% remaining");
  expect(screen.getAllByRole("meter").map(m => m.getAttribute("aria-valuenow"))).toEqual(["72", "39"]);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("distinguishes zero remaining from missing/invalid data and supports used mode", () => {
  expect(accountPreviewWindows({provider:"codex",error:"Offline",windows:[{window:"weekly",percent:10}]})).toEqual([]);
  expect(accountPreviewWindows({provider:"codex",windows:[{window:"weekly",percent:NaN},{window:"rolling",percent:-1}]})).toEqual([]);
  const windows = accountPreviewWindows({provider:"codex",windows:[{window:"weekly",percent:100}]});
  const view = render(<AccountUsagePreview windows={windows} accountName="Work" />);
  expect(screen.getByRole("group")).toHaveAccessibleDescription("Weekly 0% remaining");
  view.rerender(<AccountUsagePreview windows={windows} accountName="Work" showRemaining={false} />);
  expect(screen.getByRole("group")).toHaveAccessibleDescription("Weekly 100% used");
  view.rerender(<AccountUsagePreview windows={[]} accountName="Work" />);
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
});

it("uses local calendar days, including year boundaries, without long countdown copy", () => {
  const now = new Date(2026,11,31,22).getTime();
  expect(resetDeadline(new Date(2026,11,31,23,30).toISOString(),now)?.day).toBe("Today");
  expect(resetDeadline(new Date(2027,0,1,0,30).toISOString(),now)?.day).toBe("Tomorrow");
  expect(resetDeadline(new Date(2027,0,2,8).toISOString(),now)?.day).toMatch(/2027/);
  expect(resetDeadline("invalid",now)).toBeNull();
  expect(resetDeadline(new Date(now-1).toISOString(),now)?.day).toBe("Updating");
});

it("updates at the actual deadline without claiming the quota has already refreshed", async () => {
  vi.useFakeTimers(); const now = new Date(2026,10,4,10).getTime(); vi.setSystemTime(now);
  render(<AccountUsagePreview accountName="Work" windows={[{window:"5-hour",percent:100,resetsAt:new Date(now+1000).toISOString()}]} />);
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", expect.stringContaining("Resets"));
  expect(screen.queryByText("Today")).not.toBeInTheDocument();
  await act(async()=>{ vi.advanceTimersByTime(1000); });
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", expect.stringContaining("waiting for fresh usage"));
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow","0");
});

it("keeps reserve/model windows inline and doesn't disguise unknown reset times as zero", () => {
  render(<AccountQuotaPreview accountName="Work" quota={{provider:"codex",windows:[{window:"weekly",percent:12},{window:"gpt-reserve",percent:40}]}} />);
  expect(screen.getByText("Additional limits")).toBeInTheDocument();
  expect(screen.getByText("gpt-reserve")).toBeInTheDocument();
  expect(screen.getByRole("meter",{name:"Weekly remaining"})).toHaveAttribute("aria-valuetext",expect.stringContaining("Reset time unavailable"));
  expect(document.querySelector(".usage-preview-time-marker")).toBeNull();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("aligns the time marker to remaining/used mode and hides unmeasurable periods", () => {
  const now=new Date(2026,10,4,10).getTime();
  const session={window:"5-hour",percent:62,resetsAt:new Date(now+2*3600000).toISOString()};
  expect(accountTimeMarker(session,now,true)).toBeCloseTo(.4);
  expect(accountTimeMarker(session,now,false)).toBeCloseTo(.6);
  expect(accountTimeMarker({...session,window:"monthly"},now,true)).toBeNull();
  expect(accountTimeMarker({...session,resetsAt:new Date(now+6*3600000).toISOString()},now,true)).toBeNull();
  expect(accountTimeMarker({...session,resetsAt:"invalid"},now,true)).toBeNull();
  expect(accountTimeMarker({...session,resetsAt:null},now,true)).toBeNull();
  expect(accountTimeMarker({...session,resetsAt:new Date(now-1).toISOString()},now,true)).toBe(0);
  expect(accountTimeMarker({...session,resetsAt:new Date(now-1).toISOString()},now,false)).toBe(1);
});

it("shows the exact reset time on keyboard focus without adding a time row", async () => {
  render(<AccountUsagePreview accountName="Work" windows={[{window:"5-hour",percent:62,resetsAt:new Date(Date.now()+2*3600000).toISOString()}]} />);
  const meter=screen.getByRole("meter",{name:"5-hour remaining"});
  expect(meter).toHaveAttribute("aria-valuetext",expect.stringContaining("Time marker: 40%"));
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(document.querySelector(".usage-deadline")).toBeNull();
  await userEvent.setup().tab();
  expect(meter).toHaveFocus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent("5-hour reset");
  expect(screen.getByRole("tooltip")).toHaveTextContent(/\d{2}:\d{2}/);
  expect(screen.getByRole("tooltip").textContent?.length).toBeLessThan(45);
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("of window time");
  expect(meter).toHaveAttribute("aria-valuetext", expect.stringContaining("40% of window time remaining"));
});

it("reveals the reset details on pointer hover and dismisses them on Escape", async () => {
  const user=userEvent.setup();
  render(<AccountUsagePreview accountName="Work" windows={[{window:"weekly",percent:10,resetsAt:new Date(Date.now()+86400000).toISOString()}]} />);
  await user.hover(screen.getByRole("meter"));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Weekly reset");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
