import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateManifest, validateSecurityReport, repository } from "./release.mjs";

const notes = "English: Account improvements.\nفارسی: بهبود حساب‌ها.";
const asset = { url: `https://github.com/${repository}/releases/download/v1.0.0/Aiturn_universal.app.tar.gz`, signature: Buffer.from("untrusted comment: test\nsignature\ntrusted comment: test\nglobal-signature\n").toString("base64") };
const manifest = () => ({ version: "1.0.0", notes, pub_date: "2026-10-30T00:00:00Z", platforms: { "darwin-aarch64": { ...asset }, "darwin-x86_64": { ...asset } } });

test("accepts a universal feed with reviewed release notes", () => {
  validateManifest(manifest(), "1.0.0", notes);
});
test("rejects stale versions, missing Intel support and unreviewed notes", () => {
  const missingIntel = manifest(); delete missingIntel.platforms["darwin-x86_64"];
  for (const invalid of [missingIntel, { ...manifest(), version: "0.9.0" }, { ...manifest(), notes: "placeholder" }]) {
    assert.throws(() => validateManifest(invalid, "1.0.0", notes));
  }
});
test("rejects unsigned, mutable and foreign downloads", () => {
  for (const replacement of [{ ...asset, signature: "" }, { ...asset, url: asset.url.replace("download/v1.0.0", "latest/download") }, { ...asset, url: asset.url.replace(repository, "someone/else") }]) {
    const invalid = manifest(); invalid.platforms["darwin-aarch64"] = replacement;
    assert.throws(() => validateManifest(invalid, "1.0.0", notes));
  }
});
test("publication without explicit approval fails before invoking GitHub", () => {
  assert.throws(() => execFileSync(process.execPath, ["scripts/release.mjs", "publish"], { stdio: "pipe" }), (error) => {
    assert.match(error.stderr.toString(), /explicit user approval/);
    return true;
  });
});

test("release review rejects stale or unfinished security reports", () => {
  const report = "# Security review for Aiturn 1.5.2\n\n## Results\nPassed.\n\n## Remaining verification\nRecorded.";
  validateSecurityReport(report, "1.5.2");
  for (const invalid of [
    report.replace("# Security review for Aiturn", "Aiturn"),
    report.replace("1.5.2", "1.5.1"),
    report.replace("## Results", "Checks"),
    report.replace("## Remaining verification", "Follow-up"),
    report + "\nTODO",
  ]) {
    assert.throws(() => validateSecurityReport(invalid, "1.5.2"));
  }
});

test("a failing security gate stops approved publication before GitHub is invoked", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "aiturn-publish-gate-"));
  const bin = path.join(directory, "bin");
  const contacted = path.join(directory, "github-contacted");
  mkdirSync(bin);
  try {
    const scripts = {
      git: 'if (process.argv[2] === "rev-parse") console.log("reviewed-commit");',
      pnpm: 'console.error("simulated security gate failure"); process.exit(42);',
      gh: `require("node:fs").writeFileSync(${JSON.stringify(contacted)}, "unexpected GitHub call"); process.exit(99);`,
    };
    for (const [name, source] of Object.entries(scripts)) {
      writeFileSync(path.join(bin, name), `#!/usr/bin/env node\n${source}\n`, { mode: 0o700 });
    }
    assert.throws(() => execFileSync(process.execPath, ["scripts/release.mjs", "publish", "--approved"], {
      stdio: "pipe",
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    }), error => {
      assert.match(error.stderr.toString(), /simulated security gate failure/);
      return true;
    });
    assert.equal(existsSync(contacted), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("rejects URL traversal, encoded separators and extra URL components", () => {
  const directory = `https://github.com/${repository}/releases/download/v1.0.0/`;
  for (const url of [
    directory + "../v0.9.0/Aiturn.app.tar.gz",
    directory + "%2e%2e/v0.9.0/Aiturn.app.tar.gz",
    directory + "nested/Aiturn.app.tar.gz",
    directory + "nested%2fAiturn.app.tar.gz",
    asset.url + "?download=1",
    asset.url + "#fragment",
    asset.url.replace("github.com", "user@github.com"),
  ]) {
    const invalid = manifest();
    invalid.platforms["darwin-aarch64"].url = url;
    invalid.platforms["darwin-x86_64"].url = url;
    assert.throws(() => validateManifest(invalid, "1.0.0", notes));
  }
});
