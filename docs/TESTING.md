# Testing

## Required checks

Run after every task:

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

For Rust changes, also run from `src-tauri/`:

```bash
cargo check --offline
cargo test --offline
```

`--offline` prevents Cargo dependency downloads; dependencies must already be
cached. It does not prevent a CLI subprocess from making its own requests.
The `cli_status_covers_the_four_supported_clis` integration test invokes real
installed CLIs, so its duration and probe behavior depend on the machine.

Before committing frontend changes, `pnpm run build` verifies the production
frontend bundle. This does not package the native app. A Tauri release build
requires an explicit user request.

## Automated coverage

| Layer | Files | Coverage |
| --- | --- | --- |
| Frontend unit | `src/api.test.ts`, `src/format.test.ts`, `src/displayPrefs.test.ts` | IPC names/payloads, formatting, validated preference storage and appearance tokens. |
| Frontend component | `src/components/*.test.tsx` | Connected cards, setup validation, usage windows/errors/snapshot age, dialog focus, settings and updater phases. |
| Frontend integration | `src/App.test.tsx` | Loading, load/probe failures, connected providers, setup/usage popups, manual refresh and default focus behavior. |
| Rust unit | `#[cfg(test)]` modules under `src-tauri/src/` | CLI parsers, local Claude snapshots, quota parsing, Codex claims, settings/store normalization, tray pixels and panel placement. |
| Rust integration | `src-tauri/tests/integration.rs` | IPC serialization, real CLI registry probes, settings/store round trips, atomic file permissions and live dev frontend mode. |

Vitest uses jsdom and `src/test/setup.ts`. Frontend tests replace native IPC
and updater calls with mocks; they do not prove that the tray panel or a live
quota endpoint works. Use `user-event` for interaction and scope text queries
when logo titles overlap provider names. Time-dependent assertions use fixed
clocks where needed.

Rust parser and filesystem tests use synthetic payloads or temporary
directories. Codex profile tests cover identity/workspace matching, isolated
login, active switching, rotated-token preservation, external sign-ins,
private file permissions, rejected corrupt/symlink credentials and storage
restrictions. Real user credentials are not changed by those tests. The native
entry point remains thin so integration tests can use `aiturn_lib`.

## Live native verification

Saved Codex usage renews expired/rejected access tokens once through the CLI's
managed app-server. `profiles` tests cover inactive-account isolation, active
snapshot synchronization and failure preservation; `codex_refresh` tests cover
the bounded auth-only RPC, timeout cleanup and sanitized errors. The App recovery
test follows Reconnect account → Replace login → fresh account-specific usage,
without activation. A reused/revoked refresh token needs a fresh auth.json; opening
the unrelated active Codex account cannot repair that saved session.

Start the dev stack on port 5174 and test the **menu-bar panel**:

1. Open, hide and reopen using the tray icon. The existing panel should appear
   immediately with its mounted state. Click outside to verify dismissal.
2. Confirm connected providers match real CLI status. Missing or signed-out
   CLIs should appear only in Add account.
3. Check the wizard's installation and sign-in validation. A missing CLI must
   remain at Install; a signed-out CLI must remain at Sign in. Run installation
   or login in your own terminal only if you intend to change that CLI.
4. Open available usage popups. Verify percentage/reset display or the source
   error. Claude popups must load live usage even without transcript snapshots;
   verify inactive profiles use their own login and session failures remain explicit.
   Both Claude and Codex require usable OAuth sessions. Close and reopen a popup to request fresh data.
   For a connected Codex ChatGPT account, also check its public reset outlook:
   a scheduled announcement shows total hours/minutes and local hours/minutes
   without GMT or a source link. Close it and verify it stays closed after
   refresh/restart; a new announcement must appear again. Banked credits retain
   their explanation. Passed deadlines and completed resets, including legacy
   saved completions, stay hidden. A current probability-only watch shows Possible
   reset with its probability/window when enabled. Toggle Show possible resets
   under Settings → General → Codex resets; announcements must remain visible.
   Change Reset refetch interval and verify timer replacement and saved settings.
   Expired watches and failed/stale outlooks leave no placeholder. For 93.5% used, both native
   menu-bar and popup must show 7% remaining. Time markers are neutral without an
   elapsed-time description below the bars.

5. Change a reversible preference, close/reopen Settings and verify persistence,
   then restore its original value. Check keyboard tab navigation and Escape.
   Under Add account → Import file, choose a synthetic auth.json and verify its
   filename and Ready to import state. Choose another file, then Cancel: the
   panel and previous selection must remain visible. The native file chooser
   taking focus must not trigger the panel's ordinary focus-loss dismissal.
6. Check the displayed running version. Updater download/install/relaunch is
   covered by mocks and requires a separate signed-release validation.
7. Open Codex profiles and verify the name form, custom auth.json path form and
   isolated browser login. Going back before submitting must create nothing; importing
   must preserve the source and active account. Replacing a file for an existing
   account must keep the new tokens pending across refreshes until activation.
   Import and Set active must show a 30-second countdown with Cancel restart
   and Restart now. Cancel leaves active credentials intact. Timer tests use
   a synthetic desktop driver: expiry/manual close/Restart now must quit first,
   activate after exit, reopen, then verify. Missing app/refused quit cannot
   replace credentials; a failed file write reopens the prior login.
   A worker whose process ancestry includes the desktop being closed must reject
   the operation before requesting quit. On macOS start dev with `pnpm run run`
   and confirm `pnpm run dev:status` reports a launchd-owned supervisor.
   Use temporary app data and synthetic Codex credentials for switching checks.
   Verify active-name changes, rename/removal and preservation of the previous
   login. A real second-account browser login requires the user's participation;
   do not claim desktop-app account synchronization from UI mocks alone.

User-supplied files can be tested without changing the real Codex home or
controlling the desktop app. This opt-in test runs import → isolated activation
with a synthetic lifecycle → same-account replacement → Personal restoration,
checks source preservation/0600 copies, and makes no network/model requests:

```bash
cd src-tauri
AITURN_TEST_AUTH_DIR=/path/to/files cargo test --offline supplied_files_round_trip_in_isolated_storage -- --ignored
```

`pnpm run test:native-restart` builds a small temporary AppKit fixture, then uses
the production native driver code to quit it, reach the activation boundary,
reopen the same app path and verify a new PID. Under Rust unit-test compilation
the driver's bundle ID is fixed to the fixture. It cannot target real Codex or
use account credentials. The runner removes its fixture after testing.

For any `src/` change, also verify served source, HMR log and browser:

```bash
curl -s 'http://localhost:5174/src/api.ts' | grep -c 'Read all available quota sources'
tail -n 3 /tmp/aiturn-vite-5174.log
```

Inspect a preview tab on 5174 with a snapshot or DOM evaluation. Its lack of
Tauri IPC is expected; it cannot prove the native panel is current.

To prove **native HMR**, move all preview tabs off port 5174, keep the panel
open, confirm an established WebKit connection, then touch a frontend file:

```bash
lsof -nP -iTCP:5174
touch src/components/CliProviders.tsx
tail -n 3 /tmp/aiturn-vite-5174.log
```

Require a fresh update/reload and confirm the panel still renders current
content. `CliProviders.tsx` exports formatting helpers alongside components,
so Fast Refresh invalidation followed by a full reload is expected.

After Rust changes, confirm the `tauri dev` watcher finishes rebuilding and
starts a new `target/debug/aiturn` PID. Use `/tmp/aiturn-tauri-dev.log` when
startup output is redirected there. Restart dev after the task, stopping the
old debug app and Vite first to avoid single-instance shadowing.

## Limits and troubleshooting

There is no automated tray/WebDriver harness. Live provider availability,
authentication changes, network failures, quota endpoints and signed updates
need native checks; passing mocks is insufficient.

- Plugin permission errors mentioning another project indicate a stale
  `src-tauri/target/` copied from that project; rebuild from a clean target.
- `ERR_PNPM_UNEXPECTED_STORE` indicates a pnpm store/version mismatch. The
  release workflow uses pnpm 11; use a matching version/store for this checkout.

## Usage preferences regression checks

`SettingsModal.test.tsx`, `ProfileDisplaySettings.test.tsx`,
`CodexAccountModal.test.tsx`, `ClaudeProfilesModal.test.tsx` and `usage.test.ts`
cover percent-only controls, appearance/threshold persistence, custom alerts,
daily background downloads, isolated profile creation, manual credential import,
account tests and known-window pace calculations. Rust tests cover threshold
history/reset re-arming, private Claude config references, random profile names,
percent wording, auto-switch candidate selection and native text rendering.

For a native percentage image for visual inspection, run this opt-in test from
`src-tauri` (the synthetic image contains no account data):

```bash
AITURN_TEST_TRAY_RGBA=/tmp/aiturn-percent.rgba cargo test --offline tray_text::tests
```

It writes straight RGBA plus `[width,height]` in the adjacent `.json` file.
The original mark, system-font percentages, profile caption and active underline
must render on a transparent 36-pixel-high retina image.

For OpenCode Go, a stored key alone is not evidence of an active subscription.
An explicit EntitlementError / OpenCode Go subscription required response must
hide Go (or its entire provider card if no other services remain). Generic
403/WAF errors and exhausted rolling/weekly/monthly limits must not establish
expiry. A confirmed ended state must survive a transient source failure; real
usage windows should restore visibility after renewal.

## Start onboarding again (macOS)

Run `pnpm run reset:data`. It stops Aiturn and dev, deletes Aiturn workspace
settings, saved profiles, alert history and native WebKit/cache data, then starts
dev again on port 5174. Saved Aiturn profiles are removed permanently.
Provider CLI logins (`~/.codex`, `~/.claude`, Gemini and OpenCode) and unrelated
files in OpenCode's shared application directory remain intact.
`AITURN_OPENCODE_USERDATA` is honored when set in the invoking shell.

The reset writes an empty workspace state with migration already completed, so
an existing Codex CLI login is shown by discovery instead of automatically
creating a legacy Personal workspace. Browser preview storage is separate.

Verify the reset's deletion boundaries with `node --test scripts/reset-data.test.mjs`.
