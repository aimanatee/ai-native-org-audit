#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SCHEMA_VERSION = "ai-native-org-audit/v1";
export const COLLABORATION_SCHEMA_VERSION = "ai-native-org-audit/v2";
export const STATUS_COEFFICIENTS = Object.freeze({
  proven: 1,
  established: 0.75,
  stated: 0.4,
  unknown: 0,
  not_applicable: null,
});
export const EVIDENCE_KINDS = Object.freeze([
  "execution_receipt",
  "verified_artifact",
  "controlled_observation",
  "merged_control",
  "declared_policy",
]);
export const DIMENSIONS = Object.freeze([
  { id: "intent", title: "方向与意图", weight: 15, kicker: "先回答为什么做、做到什么程度、何时停下" },
  { id: "spec_plan", title: "可执行规格与计划", weight: 15, kicker: "把意图变成可交付、可检查的路径" },
  { id: "evidence", title: "可复核证据链", weight: 25, kicker: "让结论能被另一个人或另一次运行复核" },
  { id: "review_safety", title: "独立审查与安全边界", weight: 15, kicker: "保留权限、风险、失败恢复与独立检查" },
  { id: "deterministic_learning", title: "确定性验证与回归学习", weight: 20, kicker: "把已知失败变成可重复的验证，而非只看绿灯" },
  { id: "feedback_loop", title: "运行反馈与改进闭环", weight: 10, kicker: "用真实反馈改进规则，并能看到改变是否生效" },
]);
const V2_WEIGHTS = Object.freeze({
  intent: 13, spec_plan: 13, evidence: 21, review_safety: 13,
  deterministic_learning: 17, feedback_loop: 8, collaboration: 15,
});
const DIMENSIONS_V2 = Object.freeze([
  ...DIMENSIONS.map((item) => ({ ...item, weight: V2_WEIGHTS[item.id] })),
  { id: "collaboration", title: "团队协作", weight: V2_WEIGHTS.collaboration },
]);
const DIMENSIONS_BY_SCHEMA = new Map([
  [SCHEMA_VERSION, DIMENSIONS],
  [COLLABORATION_SCHEMA_VERSION, DIMENSIONS_V2],
]);
const INDICATOR_KEYS = new Set(["id", "label", "weight", "status", "evidence", "next_step", "rationale"]);
const EVIDENCE_KEYS = new Set(["kind", "summary", "locator", "observed_on"]);
const CONTROL_PATTERN = /<\s*script\b|<\s*iframe\b|javascript\s*:|on[a-z]+\s*=/i;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>'"]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ABS_PATH_PATTERN = /(?:^|[\s(])(?:\/(?:Users|home|private|var|tmp|etc|opt|srv)\/|[A-Za-z]:\\)[^\s<>'")]+/g;
const SECRET_PATTERN = /\b(?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*[^\s,;]+/gi;

function fail(message) { const error = new Error(message); error.code = "INVALID_AUDIT"; throw error; }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function safeText(value, field) {
  if (typeof value !== "string") fail(`${field} must be a string`);
  if (CONTROL_PATTERN.test(value)) fail(`${field} contains executable markup or a script-like URL`);
  return value;
}
function resetPatterns() { URL_PATTERN.lastIndex = EMAIL_PATTERN.lastIndex = ABS_PATH_PATTERN.lastIndex = SECRET_PATTERN.lastIndex = 0; }
function scrub(value) {
  resetPatterns();
  return value.replace(URL_PATTERN, "（链接已脱敏）")
    .replace(EMAIL_PATTERN, "（身份已脱敏）")
    .replace(SECRET_PATTERN, "（凭据已脱敏）")
    .replace(ABS_PATH_PATTERN, (match) => `${match.startsWith(" ") ? " " : ""}（路径已脱敏）`)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function display(value) { return escapeHtml(scrub(String(value ?? ""))); }
function validateDate(value, field) {
  safeText(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${field} must use YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) fail(`${field} is not a calendar date`);
}
function validateEvidence(evidence, field) {
  if (!Array.isArray(evidence)) fail(`${field} must be an array`);
  for (const [index, item] of evidence.entries()) {
    const itemField = `${field}[${index}]`;
    if (!isObject(item)) fail(`${itemField} must be an object`);
    for (const key of Object.keys(item)) if (!EVIDENCE_KEYS.has(key)) fail(`${itemField}.${key} is not allowed`);
    if (!EVIDENCE_KINDS.includes(item.kind)) fail(`${itemField}.kind is invalid`);
    safeText(item.summary, `${itemField}.summary`);
    if (!item.summary.trim()) fail(`${itemField}.summary is required`);
    if (item.locator !== undefined) {
      safeText(item.locator, `${itemField}.locator`);
      if (!item.locator.trim()) fail(`${itemField}.locator cannot be empty`);
      resetPatterns();
      if (URL_PATTERN.test(item.locator) || EMAIL_PATTERN.test(item.locator) || ABS_PATH_PATTERN.test(item.locator) || SECRET_PATTERN.test(item.locator)) fail(`${itemField}.locator must be a redacted human-safe label`);
      resetPatterns();
    }
    if (item.observed_on !== undefined) validateDate(item.observed_on, `${itemField}.observed_on`);
  }
}
export function validateAudit(input) {
  if (!isObject(input)) fail("audit input must be a JSON object");
  const contractDimensions = DIMENSIONS_BY_SCHEMA.get(input.schemaVersion);
  if (!contractDimensions) fail(`Unsupported schemaVersion. Use ${[...DIMENSIONS_BY_SCHEMA.keys()].join(" or ")}.`);
  for (const field of ["organization", "auditor", "scope"]) {
    safeText(input[field], field);
    if (!input[field].trim()) fail(`${field} is required`);
  }
  validateDate(input.assessmentDate, "assessmentDate");
  if (!Array.isArray(input.dimensions)) fail("dimensions must be an array");
  const seen = new Set();
  for (const [index, dimension] of input.dimensions.entries()) {
    const field = `dimensions[${index}]`;
    if (!isObject(dimension) || !contractDimensions.some(({ id }) => id === dimension.id)) fail(`${field}.id is not a dimension in the selected contract`);
    if (seen.has(dimension.id)) fail(`${field}.id is duplicated`); seen.add(dimension.id);
    if (!Array.isArray(dimension.indicators) || !dimension.indicators.length) fail(`${field}.indicators must be a non-empty array`);
    const indicatorIds = new Set();
    for (const [indicatorIndex, indicator] of dimension.indicators.entries()) {
      const itemField = `${field}.indicators[${indicatorIndex}`;
      if (!isObject(indicator)) fail(`${itemField}] must be an object`);
      for (const key of Object.keys(indicator)) if (!INDICATOR_KEYS.has(key)) fail(`${itemField}].${key} is not allowed`);
      safeText(indicator.id, `${itemField}].id`); safeText(indicator.label, `${itemField}].label`);
      if (!indicator.id.trim() || !indicator.label.trim()) fail(`${itemField}] id and label are required`);
      if (indicatorIds.has(indicator.id)) fail(`${itemField}].id is duplicated`); indicatorIds.add(indicator.id);
      if (indicator.weight !== undefined && (!Number.isFinite(indicator.weight) || indicator.weight <= 0)) fail(`${itemField}].weight must be positive`);
      if (!Object.hasOwn(STATUS_COEFFICIENTS, indicator.status)) fail(`${itemField}].status is invalid`);
      if (indicator.status === "not_applicable") {
        safeText(indicator.rationale, `${itemField}].rationale`);
        if (!indicator.rationale.trim()) fail(`${itemField}].rationale is required for not_applicable`);
      }
      if (["proven", "established", "stated"].includes(indicator.status)) {
        validateEvidence(indicator.evidence, `${itemField}].evidence`);
        if (!indicator.evidence.length) fail(`${itemField}].evidence must contain at least one item`);
      } else if (indicator.evidence !== undefined) validateEvidence(indicator.evidence, `${itemField}].evidence`);
      if (indicator.next_step !== undefined) { safeText(indicator.next_step, `${itemField}].next_step`); if (!indicator.next_step.trim()) fail(`${itemField}].next_step cannot be empty`); }
    }
  }
  const missing = contractDimensions.filter(({ id }) => !seen.has(id)).map(({ id }) => id);
  if (missing.length) fail(`dimensions is missing: ${missing.join(", ")}`);
  return true;
}
export function calculateAudit(input) {
  validateAudit(input);
  const dimensions = DIMENSIONS_BY_SCHEMA.get(input.schemaVersion).map((definition) => {
    const source = input.dimensions.find((item) => item.id === definition.id);
    const indicators = source.indicators.map((indicator) => ({ ...indicator, weight: indicator.weight ?? 1, coefficient: STATUS_COEFFICIENTS[indicator.status] }));
    const applicable = indicators.filter((indicator) => indicator.status !== "not_applicable");
    const totalWeight = applicable.reduce((sum, indicator) => sum + indicator.weight, 0);
    const ratio = totalWeight ? applicable.reduce((sum, indicator) => sum + indicator.weight * indicator.coefficient, 0) / totalWeight : 0;
    const covered = applicable.filter((indicator) => ["proven", "established"].includes(indicator.status)).length;
    return { ...definition, indicators, excluded: !applicable.length, earned: applicable.length ? definition.weight * ratio : 0, possible: applicable.length ? definition.weight : 0, coverage: { covered, applicable: applicable.length } };
  });
  const earned = dimensions.reduce((sum, item) => sum + item.earned, 0);
  const possible = dimensions.reduce((sum, item) => sum + item.possible, 0);
  const covered = dimensions.reduce((sum, item) => sum + item.coverage.covered, 0);
  const applicable = dimensions.reduce((sum, item) => sum + item.coverage.applicable, 0);
  return { schemaVersion: input.schemaVersion, organization: scrub(input.organization), assessmentDate: input.assessmentDate, auditor: scrub(input.auditor), scope: scrub(input.scope), dimensions, earned, possible, percent: possible ? earned / possible * 100 : 0, coverage: { covered, applicable, percent: applicable ? covered / applicable * 100 : 0 } };
}
function fmt(value) { return Number(value).toFixed(1); }
function statusLabel(status) { return ({ proven: "已复核", established: "已建立", stated: "已声明", unknown: "待补证", not_applicable: "不适用" })[status] ?? status; }
function renderAuditIndicator(indicator) {
  const evidence = (indicator.evidence ?? []).map((item) => `<li>${display(item.summary)}${item.observed_on ? `<time>${display(item.observed_on)}</time>` : ""}</li>`).join("");
  const rationale = indicator.rationale ? `<p class="rationale"><span>不适用理由</span>${display(indicator.rationale)}</p>` : "";
  const next = indicator.next_step && ["unknown", "stated"].includes(indicator.status) ? `<p class="next-step"><span>改进机会</span>${display(indicator.next_step)}</p>` : "";
  return `<article class="indicator status-${indicator.status}"><div class="indicator-head"><h4>${display(indicator.label)}</h4><span class="status-chip">${statusLabel(indicator.status)}</span></div>${evidence ? `<ul class="evidence-list">${evidence}</ul>` : ""}${rationale}${next}</article>`;
}

export function renderHtml(result) {
  const score = `${fmt(result.earned)} <span>/ ${fmt(result.possible)}</span>`;
  const versionLabel = display(result.schemaVersion.split("/").at(-1));
  const overview = result.dimensions.map((dimension) => {
    const ratio = dimension.possible ? dimension.earned / dimension.possible * 100 : 0;
    const coverage = dimension.coverage.applicable ? `${dimension.coverage.covered}/${dimension.coverage.applicable}` : "不适用";
    return `<article class="overview-card ${dimension.excluded ? "is-excluded" : ""}"><div class="overview-head"><h3>${display(dimension.title)}</h3><strong>${dimension.excluded ? "—" : fmt(dimension.earned)} <span>/ ${fmt(dimension.possible || dimension.weight)}</span></strong></div><div class="progress-track" role="img" aria-label="${display(dimension.title)} ${fmt(ratio)}%"><i style="width:${Math.max(0, Math.min(100, ratio))}%"></i></div><div class="overview-meta"><span>${dimension.excluded ? "不适用 · 从分母移除" : `${fmt(ratio)}%`}</span><span>覆盖 ${coverage}</span></div></article>`;
  }).join("");
  const opportunities = result.dimensions.flatMap((dimension) => dimension.indicators.map((indicator) => ({ ...indicator, dimensionTitle: dimension.title }))).filter((indicator) => ["unknown", "stated"].includes(indicator.status)).sort((a, b) => Number(a.status === "stated") - Number(b.status === "stated")).slice(0, 3);
  const opportunityHtml = opportunities.length ? opportunities.map((indicator) => `<article class="opportunity"><span class="opportunity-dimension">${display(indicator.dimensionTitle)}</span><h3>${display(indicator.label)}</h3><p>${display(indicator.next_step || "补充一条可复核的执行回执或受控观察")}</p></article>`).join("") : `<p class="empty-opportunities">当前没有待补证项；仍应按范围与日期复查证据新鲜度。</p>`;
  const details = result.dimensions.map((dimension) => {
    const coverage = dimension.coverage.applicable ? `${dimension.coverage.covered}/${dimension.coverage.applicable}` : "不适用";
    const scoreLabel = dimension.excluded ? "—" : `${fmt(dimension.earned)} / ${fmt(dimension.possible)}`;
    return `<details class="dimension-detail">
      <summary>
        <span class="detail-name">${display(dimension.title)}</span>
        <span class="detail-meta"><b>${scoreLabel}</b> <small>${dimension.excluded ? "从分母移除" : `覆盖 ${coverage}`}</small></span>
        <span class="detail-action"><span class="action-open">展开证据</span><span class="action-close">收起证据</span></span>
      </summary>
      <div class="detail-body">${dimension.indicators.map(renderAuditIndicator).join("")}</div>
    </details>`;
  }).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${display(result.organization)} · AI-Native 只读审计</title><style>
:root{--ink:#152840;--muted:#66768a;--line:#dce4eb;--paper:#fffdf8;--cream:#f5f1e8;--blue:#1f5f85;--cyan:#b8dfe2;--amber:#c47a28;--green:#31836f;--shadow:0 18px 55px rgba(21,40,64,.12)}*{box-sizing:border-box}html{background:#e9edf0}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans CJK SC",sans-serif}main{max-width:1120px;margin:auto;background:var(--paper)}.hero{min-height:100vh;display:grid;align-content:center;padding:clamp(32px,7vw,92px) clamp(24px,6vw,82px);background:radial-gradient(circle at 82% 18%,rgba(184,223,226,.58),transparent 34%),linear-gradient(140deg,#fffdf8 8%,#f6f8f4 100%);position:relative;overflow:hidden}.hero:after{content:"";width:360px;height:360px;border:1px solid rgba(31,95,133,.14);border-radius:50%;position:absolute;right:-130px;bottom:-150px;box-shadow:0 0 0 32px rgba(31,95,133,.04),0 0 0 64px rgba(31,95,133,.025)}.brand{display:flex;justify-content:space-between;align-items:center;letter-spacing:.06em;text-transform:uppercase;font-size:12px;color:var(--blue);font-weight:700}.hero-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(280px,.92fr);gap:clamp(32px,7vw,100px);align-items:center;margin-top:clamp(42px,8vw,90px)}.eyebrow{margin:0 0 10px;color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.12em}.hero h1{font-size:clamp(42px,8vw,88px);line-height:1.02;letter-spacing:-.055em;margin:0 0 22px;max-width:680px}.hero p{max-width:650px;margin:0;color:var(--muted);font-size:clamp(17px,2vw,22px)}.meta{display:flex;gap:20px;flex-wrap:wrap;margin-top:30px;color:var(--muted);font-size:14px}.meta strong{color:var(--ink)}.score-card{background:rgba(255,255,255,.78);border:1px solid rgba(31,95,133,.16);border-radius:28px;padding:34px 34px 30px;box-shadow:var(--shadow);backdrop-filter:blur(10px)}.score-label{color:var(--muted);font-size:13px;font-weight:700;letter-spacing:.08em}.score{font-variant-numeric:tabular-nums;font-size:clamp(54px,8vw,94px);font-weight:800;letter-spacing:-.07em;line-height:1.05;margin:12px 0}.score span{font-size:.38em;letter-spacing:-.02em;color:var(--muted);font-weight:600}.score-meta{border-top:1px solid var(--line);padding-top:18px}.coverage{color:var(--muted);font-size:14px}.coverage strong{display:block;color:var(--green);font-size:20px}.section{padding:clamp(48px,7vw,76px) clamp(24px,6vw,82px)}.section.overview{background:var(--cream)}.section h2{font-size:clamp(30px,4vw,48px);line-height:1.1;letter-spacing:-.04em;margin:0}.section-lead{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:28px}.section-lead p{color:var(--muted);margin:0}.overview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.overview-card{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:20px}.overview-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.overview-head h3{font-size:18px;line-height:1.25;margin:0}.overview-head strong{font-size:18px;white-space:nowrap;font-variant-numeric:tabular-nums}.overview-head strong span{font-size:12px;color:var(--muted);font-weight:500}.progress-track{height:10px;margin:20px 0 12px;border-radius:99px;background:#e2e9ee;overflow:hidden}.progress-track i{display:block;height:100%;border-radius:inherit;background:var(--blue)}.overview-card.is-excluded .progress-track i{background:#bfc8ce}.overview-meta{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:12px}.opportunity-wrap{background:var(--paper);border-top:1px solid var(--line);padding-top:28px;margin-top:34px}.opportunity-wrap h2{font-size:26px;margin-bottom:4px}.opportunity-wrap>p{color:var(--muted);margin:0 0 16px}.opportunities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.opportunity{background:#fff;border:1px solid #edd9bd;border-radius:16px;padding:16px}.opportunity-dimension{color:var(--amber);font-size:11px;font-weight:800}.opportunity h3{font-size:16px;margin:6px 0}.opportunity p{font-size:13px;color:#7d643f;margin:0}.empty-opportunities{padding:14px 0}.section.legend-section{background:var(--ink);color:#fff;padding-top:28px;padding-bottom:28px}.legend-line{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;color:#dbe7ec}.legend-title{font-weight:800;color:#fff;margin-right:4px}.legend-pill{border:1px solid rgba(255,255,255,.2);border-radius:99px;padding:6px 10px}.section.details-section{background:#fff}.details-list{display:grid;gap:12px;margin-top:24px}.dimension-detail{border:1px solid var(--line);border-radius:18px;background:var(--paper);overflow:hidden}
.dimension-detail summary {
  display: grid; grid-template-columns: minmax(0,1fr) auto auto;
  gap: 16px; align-items: center; list-style: none; cursor: pointer;
  padding: 16px 22px;
}
.dimension-detail summary::-webkit-details-marker { display: none; }
.dimension-detail summary:focus-visible { outline: 2px solid var(--blue); outline-offset: -3px; }
.detail-name { font-size: 20px; font-weight: 800; }
.detail-meta { display: grid; line-height: 1.35; text-align: right; font-variant-numeric: tabular-nums; }
.detail-meta small { color: var(--muted); }
.detail-action {
  display: grid; place-items: center; min-height: 44px; padding: 6px 12px;
  border: 1px solid #c9dce7; border-radius: 8px;
  background: #e6f1f7; color: #164d70; font-size: 14px; font-weight: 800; white-space: nowrap;
}
.dimension-detail summary:hover .detail-action { background: #d5e8f3; }
.action-close, .dimension-detail[open] .action-open { display: none; }
.dimension-detail[open] .action-close { display: inline; }
.detail-body {
  border-top: 1px solid var(--line); padding: 18px; display: grid;
  grid-template-columns: repeat(auto-fit,minmax(min(260px,100%),1fr)); gap: 12px;
}
.indicator{border:1px solid var(--line);border-radius:14px;padding:16px;background:#fff}.indicator-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.indicator h4{font-size:16px;line-height:1.3;margin:0}.status-chip{font-size:11px;white-space:nowrap;border-radius:99px;padding:4px 9px;background:#eef2f4;color:var(--muted);font-weight:700}.status-proven .status-chip{background:#e0f2ed;color:var(--green)}.status-established .status-chip{background:#e3f0f6;color:var(--blue)}.status-stated .status-chip{background:#fff0db;color:#a06b1c}.status-unknown .status-chip{background:#f0f1f2;color:#727d87}.status-not_applicable{opacity:.66}.evidence-list{list-style:none;margin:15px 0 0;padding:0}.evidence-list li{font-size:13px;color:#4d6171;margin-top:8px;padding-left:14px;position:relative}.evidence-list li:before{content:"";position:absolute;left:0;top:.65em;width:5px;height:5px;border-radius:50%;background:var(--cyan)}.evidence-list time{display:block;color:#94a0ab;font-size:11px;margin-top:2px}.rationale,.next-step{font-size:13px;color:var(--muted);border-top:1px dashed var(--line);padding-top:9px;margin:13px 0 0}.rationale span,.next-step span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:800}.next-step{color:#8b642b}.next-step span{color:var(--amber)}.footer{padding:28px clamp(24px,6vw,82px) 54px;color:var(--muted);font-size:12px;border-top:1px solid var(--line)}@media(max-width:740px){.hero-grid{grid-template-columns:1fr}.hero{min-height:auto}.hero-grid{margin-top:48px}.score-card{max-width:500px;order:-1}.overview-grid,.opportunities{grid-template-columns:1fr}.section-lead{display:block}.section-lead p{margin-top:8px}
.dimension-detail summary { grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; padding: 12px 14px; }
.detail-name { font-size: 16px; }
.detail-meta { grid-column: 1; grid-row: 2; display: flex; flex-wrap: wrap; gap: 4px 8px; text-align: left; font-size: 13px; }
.detail-action { grid-column: 2; grid-row: 1 / span 2; }
}@media print{html,body{background:#fff}.hero{min-height:95vh}.score-card{box-shadow:none}.section{break-inside:avoid}.dimension-detail{break-inside:avoid}}
</style></head><body><main><section class="hero"><div class="brand"><span>AI-NATIVE 组织只读审计</span><span>${versionLabel}</span></div><div class="hero-grid"><div><p class="eyebrow">分享版 · 证据分级审计</p><h1>${display(result.organization)}</h1><p>${display(result.scope)}</p><div class="meta"><span>评估日期 <strong>${display(result.assessmentDate)}</strong></span><span>审计方式 <strong>${display(result.auditor)}</strong></span></div></div><div class="score-card"><div class="score-label">总分 / 可评分满分</div><div class="score">${score}</div><div class="score-meta"><div class="coverage"><strong>${result.coverage.covered}/${result.coverage.applicable}</strong>证据覆盖率<br><small>已复核 + 已建立</small></div></div></div></div></section><section class="section overview"><div class="section-lead"><div><p class="eyebrow">能力总览</p><h2>维度总览</h2></div><p>条形长度代表该维度相对得分；覆盖率独立于分数显示。</p></div><div class="overview-grid">${overview}</div><div class="opportunity-wrap"><p class="eyebrow">下一步</p><h2>优先补证</h2><p>以下是最值得先补充的证据，不是失败认定。</p><div class="opportunities">${opportunityHtml}</div></div></section><section class="section legend-section"><div class="legend-line"><span class="legend-title">评分图例</span><span class="legend-pill">已复核 1.0 · 已建立 0.75 · 已声明 0.4</span><span class="legend-pill">待补证不等于失败</span><span class="legend-pill">不适用移出分母</span><span class="legend-pill">CI/CD 不计分</span></div></section><section class="section details-section"><div class="section-lead"><div><h2>证据与改进</h2></div></div><div class="details-list">${details}</div></section><footer class="footer">
  <p>评分口径 ${display(result.schemaVersion)}</p>
  <p><a href="https://github.com/aimanatee/ai-native-org-audit#快速开始">下载 Skill 与查看安装方法</a></p>
  <p>报告来源：<a href="https://nodecity.ai/">nodecity.ai</a>，为中小团队赋能的 AI 社群。</p>
</footer></main></body></html>`;
}

function args(argv) { const output = {}; for (let i = 0; i < argv.length; i += 1) { const arg = argv[i]; if (arg === "--validate") output.validate = true; else if (arg === "--input") output.input = argv[++i]; else if (arg === "--output") output.output = argv[++i]; else if (arg === "--help" || arg === "-h") output.help = true; else fail(`unknown option: ${arg}`); } return output; }
export function main(argv = process.argv.slice(2)) {
  const options = args(argv);
  if (options.help || !options.input) { console.log("Usage: node scripts/audit-report.mjs --input audit.json [--output report.html] [--validate]"); return 0; }
  const input = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8"));
  const result = calculateAudit(input);
  if (options.validate) { console.log(JSON.stringify({ valid: true, schemaVersion: result.schemaVersion, earned: result.earned, possible: result.possible, coverage: result.coverage }, null, 2)); return 0; }
  if (!options.output) fail("--output is required unless --validate is used");
  const output = path.resolve(options.output); fs.mkdirSync(path.dirname(output), { recursive: true }); const html = renderHtml(result); fs.writeFileSync(output, html, "utf8"); console.log(`Wrote redacted HTML report: ${output}`); return 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Audit input invalid: ${error.message}`);
    process.exitCode = 1;
  }
}
