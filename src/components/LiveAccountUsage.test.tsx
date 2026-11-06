import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiveAccountUsage } from "./LiveAccountUsage";
import type { QuotaSet } from "../api";
afterEach(cleanup);
it("ignores quota arriving after the account changes and refreshes the same account on demand", async () => {
  let finish!:(q:QuotaSet)=>void;
  const old = vi.fn(()=>new Promise<QuotaSet>(resolve=>{finish=resolve;}));
  const fresh = vi.fn().mockResolvedValue({provider:"claude",windows:[{window:"weekly",percent:20}]});
  const view=render(<LiveAccountUsage identity="old" accountName="Old" load={old} refreshKey={0} />);
  await act(async()=>{});
  view.rerender(<LiveAccountUsage identity="new" accountName="New" load={fresh} refreshKey={0} />);
  expect(await screen.findByText("80%")).toBeInTheDocument();
  await act(async()=>finish({provider:"claude",windows:[{window:"weekly",percent:99}]}));
  expect(screen.queryByText("1%")).not.toBeInTheDocument();
  fresh.mockResolvedValue({provider:"claude",windows:[{window:"weekly",percent:30}]});
  view.rerender(<LiveAccountUsage identity="new" accountName="New" load={fresh} refreshKey={1} />);
  expect(await screen.findByText("70%")).toBeInTheDocument();
});
it("keeps multiple quota sources separate and displays read failures as unknown", async () => {
  const load=vi.fn().mockResolvedValue([{provider:"opencode",windows:[{window:"weekly",percent:20}]},{provider:"opencode-go",error:"Session unavailable"}]);
  render(<LiveAccountUsage identity="opencode" accountName="OpenCode" load={load} />);
  expect(await screen.findByText("80%")).toBeInTheDocument();
  expect(screen.getByText("Session unavailable")).toBeInTheDocument();
  expect(screen.getAllByRole("meter")).toHaveLength(1);
});
