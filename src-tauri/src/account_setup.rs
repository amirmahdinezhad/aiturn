//! Native onboarding drafts, outside both permanent profile indexes and workspace membership.
//! The webview holds opaque IDs/metadata only. Login and validation never activate accounts.
use crate::{
    account_login::{Login, Progress},
    claude_profiles, cli, paths, profiles, settings,
    subscriptions::Subscription,
    workspaces,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{LazyLock, Mutex},
};

static SESSIONS: LazyLock<Mutex<HashMap<String, Draft>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub provider: String,
    pub name: String,
    pub display_name: Option<String>,
    pub active: bool,
    pub already_added: bool,
    pub email: Option<String>,
    pub subscription: Subscription,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<AccountSource>,
}
struct Entry {
    account: Account,
    home: PathBuf,
    existing: Option<String>,
    owned: bool,
    identity: String,
}
enum Runner {
    Cli(Login),
    Google(crate::antigravity::OAuthLogin),
}
impl Runner {
    fn poll(&mut self) -> Progress {
        match self {
            Self::Cli(login) => login.poll(),
            Self::Google(login) => login.poll(),
        }
    }
    fn stop(&mut self) {
        match self {
            Self::Cli(login) => login.stop(),
            Self::Google(login) => login.stop(),
        }
    }
    fn submit_code(&mut self, code: &str) -> Result<(), String> {
        match self {
            Self::Cli(login) => login.submit_code(code),
            _ => Err("Complete Google sign-in in your browser.".into()),
        }
    }
}
struct Attempt {
    id: String,
    provider: String,
    name: String,
    home: PathBuf,
    login: Runner,
}
struct Draft {
    entries: Vec<Entry>,
    attempt: Option<Attempt>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResult {
    pub attempt_id: String,
    #[serde(flatten)]
    pub progress: Progress,
    pub account: Option<Account>,
}

fn with_draft<T>(
    id: &str,
    action: impl FnOnce(&mut Draft) -> Result<T, String>,
) -> Result<T, String> {
    let mut sessions = SESSIONS
        .lock()
        .map_err(|_| "Account setup is busy. Try again.")?;
    action(
        sessions
            .get_mut(id)
            .ok_or("This setup has ended. Reopen Add account.")?,
    )
}
fn staging_home() -> Result<PathBuf, String> {
    let home = paths::opencode_user_data()
        .join("aiturn-login-homes")
        .join(uuid::Uuid::new_v4().to_string());
    profiles::private_dir(&home)?;
    Ok(home)
}
fn account_name(raw: &str) -> Result<String, String> {
    let name = raw.trim();
    if name.is_empty() || name.chars().count() > 64 || name.chars().any(char::is_control) {
        return Err("Use an account name with 1–64 characters.".into());
    }
    Ok(name.into())
}
/// Codex receives its display label from the verified login, including browser/device sign-in.
fn enrollment_name(provider: &str, raw: &str) -> Result<String, String> {
    if provider == "codex" && raw.trim().is_empty() { Ok(String::new()) }
    else { account_name(raw) }
}
fn inspect(
    provider: &str,
    home: &Path,
    existing: Option<&str>,
) -> Result<(String, Option<String>, Subscription), String> {
    if provider == "codex" {
        let identity = if let Some(id) = existing { profiles::inspect_saved(id)? } else { profiles::inspect_staged(home)? };
        let quota = if let Some(id) = existing { profiles::quota_for(id) } else {
            paths::read_json(&home.join("auth.json")).and_then(|auth| crate::quota::codex_quota_from_auth(&auth))
        };
        require_loaded_usage(quota.as_ref())?;
        return Ok(identity);
    }
    if provider == "antigravity" {
        let identity = crate::antigravity::inspect(home)?;
        require_loaded_usage(Some(&crate::antigravity::quota_in(home)?))?;
        return Ok(identity);
    }
    if provider != "claude" {
        return Err("Choose a supported provider.".into());
    }
    let binary =
        claude_reader().ok_or("Open the Code tab in Claude Desktop or install Claude Code to connect this account.")?;
    let (connected, method, email, _, subscription) = cli::probe_claude_at(&binary, Some(home));
    if connected != Some(true) || method.as_deref() != Some("claude.ai") {
        return Err("Sign in to Claude Code with a Claude subscription first.".into());
    }
    let sub = subscription
        .filter(|s| s.is_paid())
        .ok_or("A confirmed paid Claude plan is required. Check your subscription and retry.")?;
    let identity = email
        .clone()
        .ok_or("Claude could not verify the account email. Sign in again.")?;
    require_loaded_usage(Some(&crate::claude_usage::current_quota_in(home)))?;
    Ok((identity, email, sub))
}
/// Exhaustion is valid data; missing or failed usage must never create an account entry.
fn require_loaded_usage(quota: Option<&crate::quota::QuotaSet>) -> Result<(), String> {
    if quota.is_some_and(|q| q.error.is_none() && q.windows.iter().flatten().any(|w| w.percent.is_finite() && (0.0..=100.0).contains(&w.percent))) { Ok(()) }
    else { Err("Account usage could not be loaded. Check the login and try again.".into()) }
}

fn add_entry(
    draft: &mut Draft,
    provider: &str,
    name: String,
    home: PathBuf,
    existing: Option<String>,
    owned: bool,
) -> Result<Account, String> {
    let result = (|| {
        let (identity, email, subscription) = inspect(provider, &home, existing.as_deref())?;
        if let Some(old) = draft
            .entries
            .iter()
            .find(|entry| entry.account.provider == provider && entry.identity == identity)
        {
            return Ok(old.account.clone());
        }
        let already_added = existing.is_some() || match provider {
            "codex" => profiles::contains_setup_identity(&identity)?,
            "claude" => claude_profiles::contains_setup_email(&identity)?,
            "antigravity" => crate::antigravity::list()?.iter().any(|saved|
                saved.email.as_deref().zip(email.as_deref()).is_some_and(|(saved, email)| saved.eq_ignore_ascii_case(email))),
            _ => false,
        };
        let display_name = if provider == "codex" {
            paths::read_json(&home.join("auth.json")).and_then(|auth| crate::codex::profile_display_name(&auth))
        } else { None };
        let name = if provider == "codex" && name.trim().is_empty() {
            paths::read_json(&home.join("auth.json")).map(|auth| crate::codex::imported_account_label(&auth)).unwrap_or_else(|| "ChatGPT account".into())
        } else if provider == "codex" && name == "ChatGPT account" { display_name.clone().map(|value| value.chars().take(64).collect()).unwrap_or(name) } else { name };
        let mut account = Account {
            id: uuid::Uuid::new_v4().to_string(),
            provider: provider.into(),
            name,
            display_name,
            active: false,
            already_added,
            email,
            subscription,
            source: existing.as_ref().map(|_| AccountSource::Saved),
        };
        if provider == "codex" && existing.is_none() && profiles::is_current_setup_identity(&identity) {
            mark_active(draft, &mut account);
        }
        draft.entries.push(Entry {
            account: account.clone(),
            home: home.clone(),
            existing,
            owned,
            identity,
        });
        Ok(account)
    })();
    if owned && !draft.entries.iter().any(|entry| entry.home == home) {
        cleanup_home(provider, &home);
    }
    result
}
fn cleanup_home(provider: &str, home: &Path) {
    if provider == "claude" {
        // Remove only the service derived from an app-owned, isolated configuration.
        // Never log out or delete the user's ambient Claude Keychain entry.
        crate::account_setup_cleanup::claude(home);
    }
    let _ = std::fs::remove_dir_all(home);
}
impl Drop for Draft {
    fn drop(&mut self) {
        if let Some(mut attempt) = self.attempt.take() {
            attempt.login.stop();
            cleanup_home(&attempt.provider, &attempt.home);
        }
        for entry in &self.entries {
            if entry.owned {
                cleanup_home(&entry.account.provider, &entry.home);
            }
        }
    }
}
pub fn begin() -> Result<String, String> {
    let mut sessions = SESSIONS.lock().map_err(|_| "Account setup is busy.")?;
    if sessions.len() >= 8 {
        return Err("Close another account setup before opening a new one.".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    sessions.insert(
        id.clone(),
        Draft {
            entries: vec![],
            attempt: None,
        },
    );
    Ok(id)
}
pub fn discard(id: &str) -> Result<(), String> {
    SESSIONS
        .lock()
        .map_err(|_| "Account setup is busy.")?
        .remove(id);
    Ok(())
}
pub fn shutdown() {
    if let Ok(mut sessions) = SESSIONS.lock() {
        sessions.clear();
    }
}

/// Current logins are exclusive within their provider, independent of other providers.
fn mark_active(draft: &mut Draft, account: &mut Account) {
    for entry in &mut draft.entries {
        if entry.account.provider == account.provider { entry.account.active = entry.account.id == account.id; }
    }
    account.active = true;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountSource {
    Desktop,
    Cli,
    Saved,
}

pub(crate) fn desktop_installed(bundle_id: &str, app_name: &str) -> bool {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSRunningApplication, NSWorkspace};
        use objc2_foundation::NSString;
        if objc2::rc::autoreleasepool(|_| {
            let id = NSString::from_str(bundle_id);
            let registered = NSWorkspace::sharedWorkspace().URLForApplicationWithBundleIdentifier(&id);
            let running = NSRunningApplication::runningApplicationsWithBundleIdentifier(&id);
            registered.or_else(|| running.iter().find_map(|app| app.bundleURL()))
                .and_then(|url| url.path())
                .is_some_and(|path| Path::new(&path.to_string()).is_dir())
        }) {
            return true;
        }
    }
    Path::new("/Applications").join(app_name).join("Contents/Info.plist").is_file()
        || dirs::home_dir().is_some_and(|home| {
            home.join("Applications").join(app_name).join("Contents/Info.plist").is_file()
        })
}

const CLAUDE_BUNDLE_ID: &str = "com.anthropic.claudefordesktop";

fn same_home(left: &Path, right: &Path) -> bool {
    left == right || left.canonicalize().ok().zip(right.canonicalize().ok())
        .is_some_and(|(left, right)| left == right)
}

fn selected_homes(desktop: Option<PathBuf>, cli: Option<PathBuf>) -> Vec<PathBuf> {
    // Preserve the path supplied to Claude. Its Keychain service depends on that path.
    let same = desktop.is_some() && desktop == cli;
    if same { return cli.into_iter().collect(); }
    [desktop, cli].into_iter().flatten().collect()
}

/// The default Codex cache is shared. A separate CLI override can take
/// precedence, with the desktop cache as a fallback if verification fails.
fn codex_candidates(desktop: Option<PathBuf>, cli: Option<PathBuf>) -> Vec<(PathBuf, AccountSource)> {
    if desktop.as_ref().zip(cli.as_ref()).is_some_and(|(a, b)| same_home(a, b)) {
        return desktop.into_iter().map(|path| (path, AccountSource::Desktop)).collect();
    }
    [(cli, AccountSource::Cli), (desktop, AccountSource::Desktop)]
        .into_iter()
        .filter_map(|(path, source)| path.map(|path| (path, source)))
        .collect()
}

fn merge_discovered(found: &mut Vec<Account>, mut account: Account, source: AccountSource) {
    account.source = Some(source);
    if let Some(old) = found.iter_mut().find(|old| old.id == account.id) {
        old.active |= account.active;
        if matches!(old.source, None | Some(AccountSource::Saved)) {
            old.source = account.source;
        }
    } else {
        found.push(account);
    }
}

/// Check the CLI override first, then the Desktop Code configuration.
pub(crate) fn claude_current_homes() -> Vec<(PathBuf, AccountSource)> {
    let desktop = dirs::home_dir().filter(|_| desktop_installed(CLAUDE_BUNDLE_ID, "Claude.app"))
        .map(|home| home.join(".claude"));
    let cli = cli::which_binary("claude").map(|_| paths::claude_home());
    selected_homes(desktop.clone(), cli).into_iter().rev().map(|config| {
        let source = if desktop.as_ref() == Some(&config) { AccountSource::Desktop } else { AccountSource::Cli };
        (config, source)
    }).collect()
}

/// Reuse Claude Desktop's local Code runtime when no standalone CLI exists.
pub(crate) fn claude_reader() -> Option<PathBuf> {
    cli::which_binary("claude").or_else(|| {
        if !desktop_installed(CLAUDE_BUNDLE_ID, "Claude.app") { return None; }
        let runtime = dirs::home_dir()?.join("Library/Application Support/Claude/claude-code-vm");
        std::fs::read_dir(runtime).ok()?.filter_map(Result::ok).filter_map(|entry| {
            let version = entry.file_name().to_str()?.split('.')
                .map(str::parse::<u32>).collect::<Result<Vec<_>, _>>().ok()?;
            let binary = entry.path().join("claude");
            #[cfg(unix)]
            use std::os::unix::fs::PermissionsExt;
            let metadata = binary.metadata().ok()?;
            #[cfg(unix)]
            if metadata.permissions().mode() & 0o111 == 0 { return None; }
            metadata.is_file().then_some((version, binary))
        }).max_by(|a, b| a.0.cmp(&b.0)).map(|(_, path)| path)
    })
}

/// With a provider filter, check only its local sessions. Workspace setup
/// includes saved profiles so they can be shared across workspaces.
pub fn discover(id: &str, provider: Option<&str>) -> Result<Vec<Account>, String> {
    if provider.is_some_and(|id| !matches!(id, "codex" | "claude" | "antigravity")) {
        return Err("Choose a supported provider.".into());
    }
    let includes = |id: &str| provider.is_none_or(|provider| provider == id);
    let home = dirs::home_dir();
    with_draft(id, |draft| {
        let mut found = vec![];
        for entry in &mut draft.entries {
            if includes(&entry.account.provider) { entry.account.active = false; }
        }
        for profile in if provider.is_none() { profiles::list()?.profiles } else { vec![] } {
            if profile
                .subscription
                .as_ref()
                .is_some_and(Subscription::is_paid)
            {
                if let Ok(path) = profiles::saved_auth_path(&profile.id) {
                    if let Ok(mut account) = add_entry(
                        draft,
                        "codex",
                        profile.name,
                        path.parent().unwrap().into(),
                        Some(profile.id),
                        false,
                    ) {
                        if profile.active { mark_active(draft, &mut account); }
                        found.push(account);
                    }
                }
            }
        }
        if includes("codex") {
            let current = profiles::live_codex_home();
            let desktop = home.as_ref()
                .filter(|_| desktop_installed("com.openai.codex", "Codex.app"))
                .map(|path| path.join(".codex"));
            let cli = cli::which_binary("codex").map(|_| paths::codex_home());
            for (config, source) in codex_candidates(desktop, cli) {
                let auth = config.join("auth.json");
                if !auth.is_file() { continue; }
                let staging = staging_home()?;
                if copy_auth(&auth, &staging).is_err() {
                    cleanup_home("codex", &staging);
                    continue;
                }
                if let Ok(mut account) = add_entry(draft, "codex", "ChatGPT account".into(), staging, None, true) {
                    if same_home(&config, &current) {
                        mark_active(draft, &mut account);
                        for old in &mut found { if old.provider == "codex" { old.active = old.id == account.id; } }
                    }
                    merge_discovered(&mut found, account, source);
                    break;
                }
            }
        }
        for profile in if provider.is_none() { claude_profiles::list()? } else { vec![] } {
            if let Ok(mut account) = add_entry(
                draft,
                "claude",
                profile.profile.name,
                profile.profile.config_dir,
                Some(profile.profile.id),
                false,
            ) {
                if profile.active { mark_active(draft, &mut account); }
                found.push(account);
            }
        }
        if includes("claude") {
            for (config, source) in claude_current_homes() {
                if let Ok(mut account) = add_entry(draft, "claude", "Claude account".into(), config, None, false) {
                    if !found.iter().any(|old| old.provider == "claude" && old.active) {
                        mark_active(draft, &mut account);
                    }
                    merge_discovered(&mut found, account, source);
                }
            }
        }
        for profile in if provider.is_none() { crate::antigravity::list()? } else { vec![] } {
            if let Ok(account) = add_entry(
                draft,
                "antigravity",
                profile.name,
                profile.home,
                Some(profile.id),
                false,
            ) {
                found.push(account);
            }
        }
        if includes("antigravity") {
            // Desktop and agy use the same current Google login.
            let source = if desktop_installed("com.google.antigravity", "Antigravity.app") {
                Some(AccountSource::Desktop)
            } else {
                cli::which_binary("agy").map(|_| AccountSource::Cli)
            };
            if let Some(source) = source {
                if let Ok(account) = discover_current_google(draft, "Antigravity account".into()) {
                    merge_discovered(&mut found, account, source);
                }
            }
        }
        Ok(found)
    })
}
fn copy_auth(source: &Path, home: &Path) -> Result<(), String> {
    let metadata =
        std::fs::symlink_metadata(source).map_err(|_| "Cannot read the selected login file.")?;
    if !metadata.is_file() || metadata.len() > 256 * 1024 {
        return Err("Choose one JSON login file smaller than 256 KB.".into());
    }
    let raw = std::fs::read(source).map_err(|_| "Cannot read the selected login file.")?;
    let value: serde_json::Value =
        serde_json::from_slice(&raw).map_err(|_| "This login file is not valid JSON.")?;
    profiles::write_private(&home.join("auth.json"), &value)
}
pub fn import(
    id: &str,
    provider: &str,
    name: &str,
    credentials: Option<String>,
    path: Option<String>,
) -> Result<Account, String> {
    let name = enrollment_name(provider, name)?;
    if !matches!(provider, "codex" | "antigravity") {
        return Err("For Claude, use CLI sign-in or connect a configuration directory.".into());
    }
    with_draft(id, |draft| {
        let home = staging_home()?;
        let result = (|| {
            match (credentials, path) {
                (Some(raw), None) if raw.len() <= 256 * 1024 => {
                    let value: serde_json::Value = serde_json::from_str(&raw)
                        .map_err(|_| "This login file is not valid JSON.")?;
                    profiles::write_private(&home.join("auth.json"), &value)?;
                }
                (None, Some(path)) => copy_auth(&crate::resolve_import_path(&path)?, &home)?,
                _ => return Err("Choose one login file.".into()),
            }
            add_entry(draft, provider, name, home.clone(), None, true)
        })();
        if result.is_err() {
            cleanup_home(provider, &home);
        }
        result
    })
}
pub fn connect_config(id: &str, name: &str, path: &str) -> Result<Account, String> {
    let name = account_name(name)?;
    let config = crate::resolve_import_path(path)?
        .canonicalize()
        .map_err(|_| "Choose an existing Claude configuration directory.")?;
    if !config.is_dir() {
        return Err("Choose a Claude configuration directory, not a credentials file.".into());
    }
    with_draft(id, |draft| {
        add_entry(draft, "claude", name, config, None, false)
    })
}
pub fn start(id: &str, provider: &str, method: &str, name: &str) -> Result<LoginResult, String> {
    let name = enrollment_name(provider, name)?;
    if !matches!(
        (provider, method),
        ("codex", "browser" | "device") | ("claude", "browser") | ("antigravity", "browser")
    ) {
        return Err("Choose an available sign-in method.".into());
    }
    with_draft(id, |draft| {
        if draft.attempt.is_some() {
            return Err("Finish or cancel the current sign-in first.".into());
        }
        let home = staging_home()?;
        let result = if provider == "antigravity" {
            crate::antigravity::OAuthLogin::start(&home).map(Runner::Google)
        } else {
            cli::which_binary(provider)
                .ok_or(format!(
                    "Install {} CLI before signing in.",
                    if provider == "codex" {
                        "Codex"
                    } else {
                        "Claude Code"
                    }
                ))
                .and_then(|binary| Login::start(&binary, provider, method, &home))
                .map(Runner::Cli)
        };
        match result {
            Ok(mut login) => {
                let mut progress = login.poll();
                progress.status = "pending".into();
                let attempt_id = uuid::Uuid::new_v4().to_string();
                draft.attempt = Some(Attempt {
                    id: attempt_id.clone(),
                    provider: provider.into(),
                    name,
                    home,
                    login,
                });
                Ok(LoginResult {
                    attempt_id,
                    progress,
                    account: None,
                })
            }
            Err(error) => {
                cleanup_home(provider, &home);
                Err(error)
            }
        }
    })
}
pub fn poll(id: &str, attempt_id: &str) -> Result<LoginResult, String> {
    with_draft(id, |draft| {
        let attempt = draft
            .attempt
            .as_mut()
            .filter(|a| a.id == attempt_id)
            .ok_or("This sign-in was cancelled.")?;
        let progress = attempt.login.poll();
        if progress.status == "pending" {
            return Ok(LoginResult {
                attempt_id: attempt_id.into(),
                progress,
                account: None,
            });
        }
        let attempt = draft.attempt.take().unwrap();
        drop(attempt.login);
        let account = if progress.status == "completed" {
            Some(add_entry(
                draft,
                &attempt.provider,
                attempt.name,
                attempt.home,
                None,
                true,
            )?)
        } else {
            cleanup_home(&attempt.provider, &attempt.home);
            None
        };
        Ok(LoginResult {
            attempt_id: attempt_id.into(),
            progress,
            account,
        })
    })
}
pub fn cancel(id: &str) -> Result<(), String> {
    with_draft(id, |draft| {
        if let Some(mut attempt) = draft.attempt.take() {
            attempt.login.stop();
            cleanup_home(&attempt.provider, &attempt.home);
        }
        Ok(())
    })
}
pub fn submit_code(id: &str, code: &str) -> Result<(), String> {
    with_draft(id, |draft| {
        draft
            .attempt
            .as_mut()
            .ok_or("This sign-in was cancelled.")?
            .login
            .submit_code(code)
    })
}

/// Validate every selection before any permanent writes, then roll back new indexes on failure.
pub fn commit(
    id: &str,
    workspace_id: Option<String>,
    name: &str,
    accent: &str,
    selected: &[String],
) -> Result<settings::AppSettings, String> {
    with_draft(id, |draft| {
        if draft.attempt.is_some() {
            return Err("Finish or cancel sign-in before saving.".into());
        }
        if selected.is_empty()
            || selected
                .iter()
                .any(|id| !draft.entries.iter().any(|e| &e.account.id == id))
        {
            return Err("Choose at least one verified account.".into());
        }
        if workspace_id.is_some() && draft.entries.iter().any(|entry|
            selected.contains(&entry.account.id) && entry.account.already_added)
        {
            return Err("This account is already added to Aiturn.".into());
        }
        workspaces::validate_destination(workspace_id.as_deref(), name, accent)?;
        for entry in draft
            .entries
            .iter()
            .filter(|e| selected.contains(&e.account.id))
        {
            let (identity, _, _) = inspect(
                &entry.account.provider,
                &entry.home,
                entry.existing.as_deref(),
            )?;
            if identity != entry.identity {
                return Err("An account changed. Load it again before saving.".into());
            }
        }
        let mut codex = vec![];
        let mut claude = vec![];
        let mut agy = vec![];
        let mut created: Vec<(String, String)> = vec![];
        let mut active_accounts = std::collections::BTreeMap::new();
        let result = (|| {
            for entry in draft
                .entries
                .iter()
                .filter(|e| selected.contains(&e.account.id))
            {
                let provider = entry.account.provider.as_str();
                let (id, new) = if let Some(id) = &entry.existing {
                    (id.clone(), false)
                } else if provider == "codex" {
                    profiles::import_or_reuse(&entry.account.name, &entry.home.join("auth.json"))?
                } else if provider == "claude" {
                    claude_profiles::adopt_config(
                        &entry.account.name,
                        &entry.home,
                        entry.account.email.clone(),
                        entry.account.subscription.clone(),
                    )?
                } else {
                    crate::antigravity::save(&entry.account.name, &entry.home)?
                };
                if entry.account.active { active_accounts.insert(provider.to_owned(), id.clone()); }
                if new {
                    created.push((provider.into(), id.clone()));
                }
                match provider {
                    "codex" => codex.push(id),
                    "claude" => claude.push(id),
                    _ => agy.push(id),
                }
            }
            workspaces::commit_accounts_with_active(workspace_id, name, accent, codex, claude, agy, active_accounts)
        })();
        if result.is_err() {
            for (provider, id) in created {
                match provider.as_str() {
                    "codex" => {
                        let _ = profiles::remove(&id);
                    }
                    "claude" => {
                        let _ = claude_profiles::edit(&id, None);
                    }
                    _ => {
                        let _ = crate::antigravity::remove(&id);
                    }
                }
            }
        }
        if result.is_ok() {
            for entry in &mut draft.entries {
                if selected.contains(&entry.account.id) && entry.account.provider == "claude" {
                    entry.owned = false;
                }
            }
        }
        result
    })
}

/// Confirm the ambient Google identity in a disposable copy of its OAuth cache.
pub(crate) fn current_google_email() -> Option<String> {
    if !desktop_installed("com.google.antigravity", "Antigravity.app") && cli::which_binary("agy").is_none() {
        return None;
    }
    let home = staging_home().ok()?;
    let email = crate::antigravity::copy_current(&home)
        .and_then(|()| crate::antigravity::verified_email(&home)).ok();
    cleanup_home("antigravity", &home);
    email
}

fn discover_current_google(draft: &mut Draft, name: String) -> Result<Account, String> {
    let home = staging_home()?;
    if let Err(error) = crate::antigravity::copy_current(&home) {
        cleanup_home("antigravity", &home);
        return Err(error);
    }
    let mut account = add_entry(draft, "antigravity", name, home, None, true)?;
    mark_active(draft, &mut account);
    Ok(account)
}

pub fn current_google(id: &str, name: &str) -> Result<Account, String> {
    let name = account_name(name)?;
    with_draft(id, |draft| discover_current_google(draft, name))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("aiturn-draft-test-{}", uuid::Uuid::new_v4()));
        profiles::private_dir(&root).unwrap();
        root
    }
    #[test]
    fn codex_discovers_a_shared_cache_once_and_uses_an_override_first() {
        let desktop = PathBuf::from("default");
        let cli = PathBuf::from("override");
        assert!(codex_candidates(None, None).is_empty());
        assert_eq!(codex_candidates(None, Some(cli.clone())), vec![(cli.clone(), AccountSource::Cli)]);
        assert_eq!(codex_candidates(Some(desktop.clone()), None), vec![(desktop.clone(), AccountSource::Desktop)]);
        assert_eq!(codex_candidates(Some(desktop.clone()), Some(desktop.clone())), vec![(desktop.clone(), AccountSource::Desktop)]);
        assert_eq!(codex_candidates(Some(desktop.clone()), Some(cli.clone())), vec![(cli, AccountSource::Cli), (desktop, AccountSource::Desktop)]);
    }

    #[test]
    fn discovery_scans_separate_homes_and_collapses_shared_home() {
        let desktop = PathBuf::from("desktop");
        let cli = PathBuf::from("cli");
        assert_eq!(selected_homes(Some(desktop.clone()), Some(cli.clone())), vec![desktop.clone(), cli]);
        assert_eq!(selected_homes(Some(desktop.clone()), Some(desktop.clone())), vec![desktop]);
    }

    #[test]
    fn codex_sign_in_defers_blank_names_to_verified_identity() {
        assert_eq!(enrollment_name("codex", "").unwrap(), "");
        assert_eq!(enrollment_name("codex", "  ").unwrap(), "");
        assert_eq!(enrollment_name("codex", " Work ").unwrap(), "Work");
        assert!(enrollment_name("claude", "").is_err());
        assert!(enrollment_name("antigravity", "").is_err());
        assert!(enrollment_name("codex", &"x".repeat(65)).is_err());
    }

    #[test]
    fn failed_or_empty_usage_is_excluded_but_limited_accounts_are_valid() {
        use crate::quota::{QuotaSet, QuotaWindow};
        assert!(require_loaded_usage(None).is_err());
        let mut quota = QuotaSet { provider: "codex".into(), windows: Some(vec![]), error: None, reset_credits: None, as_of: None };
        assert!(require_loaded_usage(Some(&quota)).is_err());
        quota.windows = Some(vec![QuotaWindow { window: "weekly".into(), percent: 100.0, resets_at: None, status: None }]);
        assert!(require_loaded_usage(Some(&quota)).is_ok());
        quota.error = Some("offline".into());
        assert!(require_loaded_usage(Some(&quota)).is_err());
    }

    #[test]
    fn current_logins_are_exclusive_only_inside_their_own_provider() {
        let account = |provider: &str, id: &str| Account { id: id.into(), provider: provider.into(), name: id.into(), display_name: None, active: false, already_added: false, email: None, source: None, subscription: Subscription { id: provider.into(), service: provider.into(), plan: Some("plus".into()), status: None, expires_at: None, monthly_price_usd: None } };
        let codex = account("codex", "codex-current");
        let claude = account("claude", "claude-current");
        let backup = account("codex", "codex-backup");
        let mut draft = Draft { attempt: None, entries: [codex.clone(), claude.clone(), backup.clone()].into_iter().map(|account| Entry { identity: account.id.clone(), account, home: PathBuf::new(), existing: None, owned: false }).collect() };
        mark_active(&mut draft, &mut codex.clone());
        mark_active(&mut draft, &mut claude.clone());
        assert!(draft.entries[0].account.active && draft.entries[1].account.active);
        mark_active(&mut draft, &mut backup.clone());
        assert!(!draft.entries[0].account.active);
        assert!(draft.entries[1].account.active && draft.entries[2].account.active);
    }

    #[test]
    fn import_rejects_invalid_oversized_and_symlink_sources_before_writing() {
        let root = fixture();
        let home = root.join("draft");
        profiles::private_dir(&home).unwrap();
        let source = root.join("source.json");
        std::fs::write(&source, "not JSON").unwrap();
        assert!(copy_auth(&source, &home).is_err());
        std::fs::write(&source, vec![b' '; 256 * 1024 + 1]).unwrap();
        assert!(copy_auth(&source, &home).is_err());
        #[cfg(unix)]
        {
            let link = root.join("link.json");
            std::os::unix::fs::symlink(&source, &link).unwrap();
            assert!(copy_auth(&link, &home).is_err());
        }
        assert!(!home.join("auth.json").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn discarding_draft_removes_only_owned_homes_without_touching_referenced_logins() {
        let root = fixture();
        let owned = root.join("owned");
        let external = root.join("external");
        for home in [&owned, &external] {
            profiles::private_dir(home).unwrap();
            profiles::write_private(
                &home.join("auth.json"),
                &serde_json::json!({"synthetic":"secret"}),
            )
            .unwrap();
        }
        let make = |home: PathBuf, owned: bool| Entry {
            account: Account {
                id: uuid::Uuid::new_v4().to_string(),
                provider: "codex".into(),
                name: "Test".into(),
                display_name: None,
                active: false,
                already_added: false,
                email: None,
                source: None,
                subscription: Subscription {
                    id: "chatgpt".into(),
                    service: "ChatGPT".into(),
                    plan: Some("plus".into()),
                    status: None,
                    expires_at: None,
                    monthly_price_usd: None,
                },
            },
            home,
            owned,
            existing: None,
            identity: "test".into(),
        };
        drop(Draft {
            entries: vec![make(owned.clone(), true), make(external.clone(), false)],
            attempt: None,
        });
        assert!(!owned.exists());
        assert!(external.join("auth.json").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn adding_an_already_saved_account_is_rejected_before_any_permanent_write() {
        let session = begin().unwrap();
        let account_id = "already-saved".to_string();
        with_draft(&session, |draft| {
            draft.entries.push(Entry {
                account: Account {
                    id: account_id.clone(), provider: "codex".into(), name: "Saved".into(),
                    display_name: None, active: false, already_added: true, email: None,
                    source: Some(AccountSource::Saved),
                    subscription: Subscription { id: "chatgpt".into(), service: "ChatGPT".into(), plan: Some("plus".into()), status: None, expires_at: None, monthly_price_usd: None },
                },
                home: PathBuf::new(), existing: Some("saved-profile".into()), owned: false, identity: "saved-identity".into(),
            });
            Ok(())
        }).unwrap();
        let error = commit(&session, Some("workspace".into()), "Workspace", "#7c6cf0", &[account_id]).unwrap_err();
        assert_eq!(error, "This account is already added to Aiturn.");
        discard(&session).unwrap();
    }

    #[test]
    fn unknown_session_or_provider_never_starts_authentication() {
        assert!(start("missing", "codex", "browser", "Test").is_err());
        assert!(start("missing", "claude", "file", "Test").is_err());
        assert!(account_name(
            "
"
        )
        .is_err());
        assert!(account_name(&"x".repeat(65)).is_err());
    }
}
