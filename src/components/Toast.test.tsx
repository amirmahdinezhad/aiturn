import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Toast, showToast } from "./Toast";
import { toast } from "sonner";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

afterEach(() => { toast.dismiss(); cleanup(); });

describe("Toast", () => {
  it("renders accessible success feedback and lets the user dismiss it", async () => {
    render(<Toast />);
    act(() => { showToast("Profile switched", "ok"); });
    const message = await screen.findByText("Profile switched");
    expect(message.closest("[data-sonner-toast]")).toHaveAttribute("data-type", "success");
    await userEvent.setup().click(screen.getByRole("button", { name: "Close toast" }));
    await waitFor(() => expect(screen.queryByText("Profile switched")).not.toBeInTheDocument());
  });

  it("deduplicates repeated errors while preserving a different notification", async () => {
    render(<Toast />);
    act(() => {
      showToast("Connection unavailable", "err");
      showToast("Connection unavailable", "err");
      showToast("Account added", "ok");
    });
    await screen.findByText("Connection unavailable");
    expect(screen.getAllByText("Connection unavailable")).toHaveLength(1);
    expect(await screen.findByText("Account added")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders its message", () => {
    render(<EmptyState message="Couldn't load keys" />);
    expect(screen.getByText("Couldn't load keys")).toBeInTheDocument();
  });
});

describe("LoadingSkeleton", () => {
  it("is announced as a busy region", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
