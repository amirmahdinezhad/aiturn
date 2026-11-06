# Release security checks

Run this checklist on every release candidate before requesting publication approval.
Record the candidate version, source changes, scanner/database versions, results,
findings and limitations in `docs/releases/<version>.security.md`. Refresh the report
after candidate changes. A failed or unavailable required check blocks release review
until fixed or explicitly accepted by the owner with a documented reason.

## Automated gate

Install `cargo-audit` and `gitleaks` from their official distributions. Run
`pnpm install --frozen-lockfile`, then `pnpm run security:check`.
The gate checks all JavaScript dependencies including development tools, scans
Git-tracked and non-ignored untracked files and Git history with redacted Gitleaks
output, checks CSP/IPC/updater policy, and audits the resolved Rust dependency union
for Apple Silicon and Intel macOS against a freshly fetched RustSec database.
Vulnerabilities and warnings in that union fail the gate. The full lockfile is also
reviewed and findings for other operating systems are printed separately. The
supported release is universal macOS. Evaluate those findings before adding another
platform. Keep secrets and local account files outside the repository.

Run the full behavioral checks alongside the gate.

```sh
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm run test:release
pnpm run release:check
cd src-tauri
cargo check --locked --offline
cargo test --locked --offline
```

## Review attack surfaces

- Review changed Rust commands and Tauri capabilities. Only the local main window
  receives the specific IPC operations it uses. Keep remote pages outside IPC scope.
- Check production CSP and provider URL scopes. Exercise hostile account names and
  markup, external URL spoofing, unexpected schemes/ports, and release URL traversal.
- Check credential imports for bounded reads, malformed JSON, path traversal,
  symbolic links, owner-only files/directories, and cleanup after cancellation or
  partial failure. Use disposable files and synthetic tokens.
- Check CLI arguments and isolated credential environments, subprocess time/output
  bounds, cancellation, and token/error redaction before data crosses IPC or logs.
- Check OAuth callback state rejection and cancellation. Check account identity and
  explicit confirmation before mutations, including reset redemption retries.
- Review HTTPS certificate verification, redirects, proxies, and connection reuse.
  Credentials belong to individual requests, never shared client default headers.

## Native and artifact verification

Complete the live dev checklist in AGENTS.md. In the native panel, verify settings,
account import/cancellation, external provider sign-in, focus, refresh, and updater
check/download followed by the explicit install choice. Use isolated test accounts
for mutations. Record any flow that could not be exercised.

Build the exact candidate for both macOS architectures. Verify the bundle's code
signature, DMG integrity, checksums and signed updater archive with
`pnpm run release:verify <directory>`. Use a tampered copy to confirm signature
verification rejects altered archives. Run upgrade/install tests against a disposable
app copy, preserving the installed application and updater trust root.

CI runs the automated security gate before a release build. Publication still
requires the reviewed candidate's explicit owner approval. Report residual risks,
unavailable checks and artifact provenance. Passing scans and tests are bounded
evidence, never a guarantee that all vulnerabilities or bugs have been found.

`release:check` requires a version-matched report with results and remaining
verification. `release:publish --approved` reruns the security gate on the clean
tagged candidate before contacting GitHub. A failed gate stops publication.
