import type { ReactNode } from "react";

/** Letters rather than UTF-16 units keep Persian names and emoji prefixes intact. */
export function accountInitials(name: string): string {
  const words = name.trim().split(/\s+/).map(word => word.match(/[\p{L}\p{N}]/u)?.[0]).filter((letter): letter is string => !!letter);
  if (!words.length) return "?";
  return (words.length > 1 ? words[0] + words[words.length - 1] : words[0]).toLocaleUpperCase();
}

/** One identity layout for saved accounts; the monogram never replaces the full name. */
export function AccountIdentity({ name, email, detail, active, children }: {
  name: string; email?: string | null; detail?: string | null; active?: boolean; children: ReactNode;
}) {
  return <div className="workspace-account-info account-identity">
    <span className="account-monogram" aria-hidden="true">{accountInitials(name)}</span>
    <div className="account-identity-copy">
      <div className="workspace-account-title">
        <span className="row-title" dir="auto">{name}</span>
        {children}
        {active ? <span className="account-active-label">Active</span> : null}
      </div>
      {detail ? <p className="workspace-account-email" dir="auto">{detail}</p> : null}
      {email ? <p className="workspace-account-email" dir="auto">{email}</p> : null}
    </div>
  </div>;
}
