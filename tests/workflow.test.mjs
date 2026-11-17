import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { calculateAudit } from "../scripts/audit-report.mjs";

const scripts = fileURLToPath(new URL("../scripts/", import.meta.url));
const sample = JSON.parse(readFileSync(new URL("../sample/audit.json", import.meta.url)));
const node = (...args) => execFileSync(process.execPath, args, { encoding: "utf8" });

test("initialize an audit, record evidence, and generate a shareable report", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "team audit "));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const inputPath = path.join(root, "audit.json");
  const reportPath = path.join(root, "report.html");
  const project = "https://example.invalid/private-project-audit-test";
  const initializer = path.join(scripts, "audit.mjs");
  const report = path.join(scripts, "audit-report.mjs");
  const init = [initializer, "init", "--organization", "虚构交付团队", "--team-size", "17",
    "--project", project, "--date", "2026-11-17", "--scope", "近 30 天交付记录", "--output", inputPath];
  node(...init);
  const initial = readFileSync(inputPath, "utf8");
  const draft = JSON.parse(initial);
  assert.deepEqual(draft.setup, { teamSize: 17, project });
  assert.equal(draft.dimensions.length, 7);
  assert.ok(draft.dimensions.every(({ indicators }) => indicators.every(({ status, evidence }) => status === "unknown" && !evidence?.length)));
  const empty = calculateAudit(draft);
  assert.equal(empty.earned, 0);
  assert.equal(empty.coverage.covered, 0);
  assert.equal(empty.setup, undefined);
  node(report, "--input", inputPath, "--output", reportPath);
  assert.match(readFileSync(reportPath, "utf8"), /初始评估 · 待取证/);

  assert.notEqual(spawnSync(process.execPath, init).status, 0);
  assert.equal(readFileSync(inputPath, "utf8"), initial);
  const source = draft.dimensions[0].indicators[0];
  source.status = "proven";
  source.evidence = [{ kind: "execution_receipt", summary: "任务负责人签收了交付回执。" }];
  const opportunity = draft.dimensions[0].indicators[1];
  opportunity.next_step = "记录一次目标变更的确认过程。";
  opportunity.success_check = "读回一条带确认时间的决定。";
  writeFileSync(inputPath, JSON.stringify(draft));
  const validation = JSON.parse(node(report, "--input", inputPath, "--validate"));
  assert.equal(validation.valid, true);
  assert.equal(validation.coverage.covered, 1);
  assert.ok(validation.earned > 0);
  node(report, "--input", inputPath, "--output", reportPath);
  const html = readFileSync(reportPath, "utf8");
  assert.match(html, /虚构交付团队/);
  const plan = html.indexOf("接下来怎么优化");
  assert.ok(plan > html.indexOf("证据与改进"));
  const improvement = html.slice(plan);
  assert.match(improvement, /记录一次目标变更的确认过程。/);
  assert.match(improvement, /读回一条带确认时间的决定。/);
  assert.doesNotMatch(html, /private-project-audit-test|teamSize/);
  assert.doesNotMatch(html, /初始评估 · 待取证/);
});

test("invalid team size or project credentials cannot create an input", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "team audit invalid "));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const inputPath = path.join(root, "audit.json");
  const args = [path.join(scripts, "audit.mjs"), "init", "--organization", "示例", "--output", inputPath];
  const invalid = [
    ["0", "https://example.invalid/team"],
    ["8", "https://someone:dummy-credential@example.invalid/team"],
    ["8", " https://someone:dummy-credential@example.invalid/team"],
    ["8", "ssh://someone:dummy-credential@example.invalid/team"],
  ];
  for (const [size, address] of invalid) {
    const result = spawnSync(process.execPath, [...args, "--team-size", size, "--project", address], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(inputPath), false);
    assert.doesNotMatch(result.stderr + result.stdout, /dummy-credential/);
  }
});

test("legacy reports keep their scores and new suggestions do not affect scoring", () => {
  const v1 = { ...sample, schemaVersion: "ai-native-org-audit/v1", dimensions: sample.dimensions.slice(0, 6) };
  assert.equal(calculateAudit(v1).earned, 53.25);
  const withoutSuggestions = structuredClone(sample);
  for (const { indicators } of withoutSuggestions.dimensions) {
    for (const indicator of indicators) {
      delete indicator.next_step;
      delete indicator.success_check;
    }
  }
  assert.equal(calculateAudit(sample).earned, calculateAudit(withoutSuggestions).earned);
});
