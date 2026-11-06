# Development

Aiturn uses Tauri v2, Rust, React, TypeScript and Tailwind. The native tray panel
is the development reference; a browser preview cannot perform Tauri IPC.


```bash
pnpm install --frozen-lockfile
pnpm run run
```

This starts Vite on **http://localhost:5174/** and the native Tauri dev app.
Use the menu-bar icon to open the actual panel. A browser preview has no Tauri
IPC and is expected to show a settings-load error.

On macOS, `pnpm run run` starts a launchd-owned supervisor so closing Codex
cannot also close Aiturn or Vite during an account restart. The command returns
while dev continues. `pnpm run dev:status` checks that ownership;
`pnpm run dev:stop` stops both services. Logs remain in
`/tmp/aiturn-vite-5174.log` and `/tmp/aiturn-tauri-dev.log`.

If Vite is already running:

```bash
pnpm exec tauri dev --config '{"build":{"devUrl":"http://localhost:5174","beforeDevCommand":""}}'
```

For desktop account-restart testing from Codex, use the independent combined
startup. A dev instance owned by Codex refuses to close its own ancestor.

Keep port 5174 and `strictPort`. Leave `custom-protocol` out of permanent Tauri
features so dev uses Vite and HMR. Do not create a release bundle unless the
user explicitly requests one.

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
cd src-tauri
cargo check --offline
cargo test --offline
```

See [Testing](TESTING.md) for native panel and HMR checks.

## Local data

| Location on macOS | Purpose |
| --- | --- |
| `~/Library/Application Support/ai.opencode.desktop/agent-rtl.keys` | Launch-at-login flag; the OS is the source of truth. |
| `…/agent-rtl.settings.json` | Refresh cadence, percentage display, menu-bar appearance, multi-profile selection and auto-switch. |
| Webview localStorage: `aiturn.displayPrefs` | Theme, focus refresh and daily automatic update preference; legacy density fields. |
| Webview localStorage: `aiturn.lastUpdateCheck` | Timestamp of the latest successful update check. |
| `…/aiturn-claude-profiles/profiles.json` | Anthropic profile names and Claude configuration-directory references. |
| Webview localStorage: `aiturn.skippedUpdateVersion` | Skipped updater version. |
| `~/.local/share/opencode/auth.json` | Read-only OpenCode credentials and connected services. Honors `XDG_DATA_HOME`. |
| `~/.codex/auth.json` | Codex identity and OAuth access token. Explicit profile activation replaces this cache atomically. Honors `CODEX_HOME`. |
| `…/aiturn-codex-profiles/profiles.json` | Profile IDs and names; independent of legacy app-data cleanup. |
| `…/aiturn-codex-profiles/<id>/auth.json` | Each profile's private ChatGPT login cache. Credentials never cross IPC. |
| `~/.claude/projects/**/*.jsonl` | Read-only Claude quota snapshots. Honors `CLAUDE_CONFIG_DIR`. |
| `~/.gemini/oauth_creds.json` / Gemini environment variables | Read-only Gemini authentication detection. |

`AITURN_OPENCODE_USERDATA` overrides Aiturn's application-data directory for
isolated testing. On startup, recognized legacy keys/accounts/profile-era
preferences are removed from Aiturn's own store/settings files. Named Codex
profiles use their own directory and survive that cleanup. Profile directories
use mode 0700 and credential files use 0600 on macOS. Files contain tokens in
plaintext, like Codex's own file store; keep them out of source control and logs.

## Codex profiles

Open **Codex profile** at the top of the panel (also reachable through Add
account). Choose Add profile and enter a name. Then choose:

- **Import auth.json file:** paste its full path in the in-app form (absolute or starting with `~/`). Aiturn
  validates it and saves a private copy; the source and active account stay intact.
- **Sign in to another account:** Continue with browser launches the installed
  Codex CLI's sign-in for this isolated profile. Aiturn detects completion.
  Cancel stops the child process. Terminal and device-code instructions remain
  available as fallbacks.
- **Save current Codex account:** keep the existing login as a named profile.

Manual Switch starts the graceful desktop replacement immediately on macOS,
without a countdown. Aiturn quits Codex gracefully, installs the selected login
after exit and reopens it. Automatic switching also has no countdown. If
a local thread is running, a confirmation offers **Close and switch** and
**Cancel**; uncertain activity gets a separate explanation and the same choice. No force quit is used; refusal to close aborts replacement.
A missing desktop app blocks restart.
The running app's bundle path is captured before closing and reopened directly.
**Activate for CLI only** is available under Manage for a file-only switch.
New CLI processes use the selected cache; existing sessions should be reopened.

Manage an existing profile to **Replace login from file** when a manager sends
updated credentials. Imported replacements remain pending until activation;
refreshing the list cannot overwrite their new tokens with the old active cache.

Activation changes only `auth.json`, preserving Codex configuration and chat
history. A current account that has not yet been saved is preserved as a
Previous account profile. Removing a profile forgets its saved login without
logging out the active CLI. External CLI sign-ins are reflected on refresh;
profile identity uses the token's subject and workspace, not its email.

The close/replace/reopen workflow is based on this user's observed desktop
setup, not a universal desktop switching API. Restart verification checks that
the active login file matches and a new desktop process is running. The account
displayed inside Codex still needs to be checked; no remote token validity or
in-memory desktop identity is claimed. Versions using a separate sign-in may
require their own login. If replacement fails after quitting, Aiturn reopens
Codex with the old login. A reopen failure leaves a recovery profile available.
ChatGPT API-key logins
and non-file credential stores cannot currently be imported or activated.

## Anthropic profiles

Choose **Anthropic profiles** inside Codex profiles, or select Anthropic in the
new-profile form. Track the current Claude configuration or create an isolated
one. Run the supplied sign-in command in Terminal, then choose **Test connection /
Rescan**. Start Claude with the profile's **Use this account** command.

Isolation uses the CLI's documented `CLAUDE_CONFIG_DIR` workflow. Claude owns
credentials, Keychain entries, settings and conversation history. Aiturn stores
metadata and reads subscription usage with the selected profile’s existing login;
it does not replace Claude’s global credentials. Forgetting a tracked profile preserves its CLI directory and login.
Codex auto-switch applies only to Codex profiles.

See [usage preferences](USAGE_PREFERENCES.md) for defaults and alert/pace
behavior, and [Claude authentication](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts)
for the configuration-directory workflow.

## Docs

- [Frontend/backend contract](../CONTRACT.md)
- [Adding a provider](ADDING_A_PROVIDER.md)
- [Testing](TESTING.md)
- [Release workflow](RELEASING.md)

### Home panel rendering

`HomeChrome.tsx` owns the workspace header and persistent bottom actions; only
`main.home-accounts` scrolls. `WorkspaceAccounts` owns Codex content rather than
page controls. `useAccountClock` updates display time every 30 seconds and at
exact subscription expiration, plus on focus. The native restart hook still
polls every second, but preserves equal status and does not update a clock while
idle. Its regression test verifies both idle render stability and detection of a
new native switch.

Home feedback uses a single Sonner Toaster through components/Toast.tsx;
showToast retains the existing ok/err call contract. Keep notifications above
the fixed dock and outside dialogs. main.tsx wraps the app in the shared Radix
TooltipProvider so adjacent controls can reuse the skip-delay window. The current
home.css skin uses graphite/iris tokens and separate static usage tiles, replacing
the earlier blue/ring proposal. Temporary IPC mocks are QA artifacts and must not
be published or committed with account data.

Home usage is now read-only: AccountQuotaPreview renders measured values, a time marker on the capacity bar and optional inline secondary windows. Exact
local reset deadlines appear in the shared accessible tooltip. LiveAccountUsage supplies
identity/refresh-key guarded reads only when a saved snapshot isn't supplied.
Codex's Available resets dialog contains inventory and the existing explicit
redemption review, rather than quota charts. The general UsageModal component
remains available to other consumers but is no longer mounted by App. Home's
single-pixel gradient borders use identical opaque padding-box surfaces and
gradient border-box layers, without CSS masks, and opacity-only 500ms ease fades; no layout or quota values animate.

Tooltip's optional motion/contentClassName props are used by the compact reset
hint. Radix remains responsible for interactions/positioning. Its opt-in WAAPI
presence retains pointer exits, resumes interrupted fades and ignores cancelled
completion callbacks. Ordinary button/title tooltips remain uncontrolled and
unchanged. Visible reset copy is brief; aria-valuetext retains the full date and
time-marker explanation. Preserve existing card-edge geometry/timing.
