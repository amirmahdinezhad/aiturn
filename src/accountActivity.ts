import type { AccountProvider } from "./api";
import type { Workspace } from "./types";

/** Promote the active card while preserving the saved order of other accounts. */
export function activeAccountFirst<T extends { id: string }>(accounts: T[], activeId?: string | null): T[] {
  const index = accounts.findIndex(account => account.id === activeId);
  if (index < 1) return accounts;
  return [accounts[index], ...accounts.slice(0, index), ...accounts.slice(index + 1)];
}

/** A saved workspace default never establishes a provider login. */
export function activeProviderAccountId(provider: AccountProvider, workspace: Workspace, accounts: readonly { id: string; active?: boolean }[]): string | null {
  const ids = provider === "codex" ? workspace.accountIds : provider === "claude" ? workspace.claudeAccountIds : workspace.antigravityAccountIds;
  return accounts.find((account) => account.active && (ids == null || ids.includes(account.id)))?.id ?? null;
}
