import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolvedLockfile } from "./security.mjs";

const config = JSON.parse(
  readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url)),
);
const capability = JSON.parse(
  readFileSync(
    new URL("../src-tauri/capabilities/default.json", import.meta.url),
  ),
);

test("target audit keeps resolved package versions and removes other-target dependency edges", () => {
  const lock =
    'version = 4\n\n[[package]]\nname = "app"\nversion = "1.0.0"\ndependencies = [\n "shared 1.0.0",\n "shared 2.0.0",\n "js-sys",\n]\n\n[[package]]\nname = "shared"\nversion = "1.0.0"\n\n[[package]]\nname = "shared"\nversion = "2.0.0"\n\n[[package]]\nname = "js-sys"\nversion = "0.3.0"\n';
  const filtered = resolvedLockfile(
    lock,
    new Set(["app@1.0.0", "shared@1.0.0"]),
  );
  assert.match(filtered, /"shared 1.0.0"/);
  assert.doesNotMatch(filtered, /2\.0\.0|js-sys/);
  assert.match(filtered, /name = "app"/);
});
test("production CSP restricts scripts and connections to local app resources", () => {
  const directives = Object.fromEntries(
    config.app.security.csp
      .split(";")
      .map((item) => item.trim().split(/\s+/))
      .filter((item) => item[0])
      .map(([name, ...values]) => [name, values]),
  );
  assert.deepEqual(directives["script-src"], ["'self'"]);
  assert.deepEqual(directives["default-src"], ["'self'"]);
  assert.deepEqual(directives["connect-src"], ["ipc:", "http://ipc.localhost"]);
  assert.deepEqual(directives["base-uri"], ["'self'"]);
  for (const directive of ["object-src", "form-action", "frame-src"])
    assert.deepEqual(directives[directive], ["'none'"]);
  assert.equal(
    config.app.security.dangerousDisableAssetCspModification,
    undefined,
  );
  assert.equal(config.build.removeUnusedCommands, true);
});

test("only the local main window receives the explicit IPC permissions", () => {
  assert.deepEqual(capability.windows, ["main"]);
  assert.equal(capability.remote, undefined);
  const names = capability.permissions.map((permission) =>
    typeof permission === "string" ? permission : permission.identifier,
  );
  assert.deepEqual(
    names.sort(),
    [
      "core:app:allow-version",
      "core:event:allow-listen",
      "core:event:allow-unlisten",
      "core:resources:allow-close",
      "updater:allow-check",
      "updater:allow-download",
      "updater:allow-install",
      "process:allow-restart",
      "opener:allow-open-url",
    ].sort(),
  );
});

test("external URL permissions cover provider sign-in and documentation only", () => {
  const opener = capability.permissions.find(
    (permission) => permission.identifier === "opener:allow-open-url",
  );
  const hosts = new Set([
    "auth.openai.com",
    "auth0.openai.com",
    "claude.ai",
    "platform.claude.com",
    "console.anthropic.com",
    "accounts.google.com",
    "code.claude.com",
    "claude.com",
    "developers.openai.com",
    "opencode.ai",
    "geminicli.com",
    "github.com",
  ]);
  for (const entry of opener.allow) {
    const url = new URL(entry.url);
    assert.equal(url.protocol, "https:");
    assert.ok(hosts.has(url.hostname));
    assert.equal(url.username + url.password + url.port, "");
    if (url.hostname === "github.com")
      assert.equal(url.pathname, "/google-gemini/gemini-cli");
  }
});

test("updater uses HTTPS, signature verification and explicit installation", () => {
  assert.equal(
    config.plugins.updater.dangerousInsecureTransportProtocol,
    undefined,
  );
  assert.deepEqual(config.plugins.updater.endpoints, [
    "https://github.com/amirmahdinezhad/aiturn/releases/latest/download/latest.json",
  ]);
  const key = Buffer.from(config.plugins.updater.pubkey, "base64").toString();
  assert.match(key, /^untrusted comment: .*\nRW[^\n]+\n?$/);
  const source = readFileSync(
    new URL("../src/components/SettingsModal.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\.downloadAndInstall\(/);
  assert.match(source, /Install & relaunch/);
});
