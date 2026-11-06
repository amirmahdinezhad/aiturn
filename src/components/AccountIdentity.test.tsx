import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AccountIdentity, accountInitials } from "./AccountIdentity";
afterEach(cleanup);
it("uses complete Unicode letters and skips emoji prefixes in account initials", () => {
  expect(accountInitials("Emma Brooks")).toBe("EB");
  expect(accountInitials("👨‍💻 علی رضایی")).toBe("عر");
  expect(accountInitials("Ólafur Darri Ólafsson")).toBe("ÓÓ");
  expect(accountInitials("Jo")).toBe("J");
  expect(accountInitials("  ")).toBe("?");
});
it("keeps the full identity readable while the monogram is decorative", () => {
  const { container } = render(<AccountIdentity name="Aleksandra Wiśniewska-Kowalczyk" email="aleksandra@example.com"><span>Plus</span></AccountIdentity>);
  expect(screen.getByText("Aleksandra Wiśniewska-Kowalczyk")).toHaveAttribute("dir", "auto");
  expect(screen.getByText("aleksandra@example.com")).toBeVisible();
  expect(container.querySelector('.account-monogram')).toHaveAttribute("aria-hidden", "true");
});

it("shows the active status beside the account name only when active", () => {
  const { rerender } = render(<AccountIdentity name="Emma Brooks" active><span>Plus</span></AccountIdentity>);
  expect(screen.getByText("Active")).toBeVisible();

  rerender(<AccountIdentity name="Emma Brooks"><span>Plus</span></AccountIdentity>);
  expect(screen.queryByText("Active")).not.toBeInTheDocument();
});
