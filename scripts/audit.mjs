#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  COLLABORATION_SCHEMA_VERSION,
  DIMENSIONS_V2,
  calculateAudit,
  main as reportMain,
} from "./audit-report.mjs";

const INIT_USAGE = `Usage: node scripts/audit.mjs init --organization NAME --team-size POSITIVE_INT --project ADDRESS [--scope TEXT] [--date YYYY-MM-DD] [--output audit.json]`;

// Keep this catalog short enough to edit by hand. It is a prompt scaffold, not evidence.
const DEFAULT_INDICATORS = Object.freeze({
  intent: [
    ["目标与边界", "写清目标、非目标和停止条件。", "另一位参与者能复述目标、非目标和停止条件。"],
    ["成功结果", "为目标补一条可观察的成功结果。", "结果可用一条具体回执或观察在范围内复核。"],
  ],
  spec_plan: [
    ["规格入口", "把目标关联到可执行规格或任务入口。", "抽查一项任务，能追溯到目标和验收条件。"],
    ["计划与责任", "补充负责人、依赖、时间点和验证方式。", "抽查一项计划，负责人和验证结果都有记录。"],
  ],
  evidence: [
    ["关键回执", "为关键结论留下一条带日期的执行回执。", "回读一条原始回执，能确认动作、结果和观察时间。"],
    ["证据范围", "记录抽样范围、来源和无法确认的部分。", "另一位复核者能按范围复查同一结论。"],
    ["分享脱敏", "分享前移除路径、链接、邮箱和凭据等敏感信息。", "公开 HTML 中搜索不到内部地址或凭据片段。"],
  ],
  review_safety: [
    ["权限与副作用", "列出只读授权、敏感边界和禁止的写入动作。", "复核记录能说明授权范围与未执行的副作用。"],
    ["独立复核", "安排另一位参与者检查结论和失败恢复路径。", "保留一次独立复核回执及其处理结果。"],
  ],
  deterministic_learning: [
    ["可重复验证", "保存最小可重复命令、输入和结果。", "在同一范围重跑得到可解释且可对照的结果。"],
    ["失败回归", "把已知失败转成可复测案例和通过条件。", "重跑该案例能区分失败、修复和未覆盖状态。"],
  ],
  feedback_loop: [
    ["真实反馈", "记录真实使用者反馈及其适用范围。", "一条反馈能追溯到决定、改动和后续观察。"],
    ["改进闭环", "为一次改动指定复查日期和结果记录。", "复查记录能说明改动是否达到预期。"],
  ],
  collaboration: [
    ["共同入口", "统一任务、决定和证据的共享入口。", "参与者能从共同入口找到当前任务和最新决定。"],
    ["交接回执", "交接时写明已完成、阻塞、下一步和责任人。", "接手者能据此继续工作并留下确认回执。"],
    ["自动化协作", "为自动化流程记录触发、执行回执和人工接手条件。", "抽查一次运行能看到触发、结果和异常接手记录。"],
  ],
});

function fail(message) {
  const error = new Error(message);
  error.code = "INVALID_INIT";
  throw error;
}

function parseInitArgs(argv) {
  const options = { help: false };
  const fields = new Set(["organization", "team-size", "project", "scope", "date", "output"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (!arg.startsWith("--") || !fields.has(arg.slice(2))) fail("init 参数无效");
    const key = arg.slice(2);
    if (Object.hasOwn(options, key)) fail(`--${key} 不能重复`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`--${key} 需要一个值`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function parseTeamSize(value) {
  if (!/^[1-9]\d*$/.test(value)) fail("--team-size 必须是正整数");
  const teamSize = Number(value);
  if (!Number.isSafeInteger(teamSize) || teamSize <= 0) fail("--team-size 必须是正整数");
  return teamSize;
}

function today() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildInitAudit(options) {
  const dimensions = DIMENSIONS_V2.map((dimension) => {
    const prompts = DEFAULT_INDICATORS[dimension.id];
    if (!prompts?.length) fail("初始化指标目录不完整");
    return {
      id: dimension.id,
      indicators: prompts.map(([label, nextStep, successCheck], index) => ({
        id: `${dimension.id}-${index + 1}`,
        label,
        status: "unknown",
        next_step: nextStep,
        success_check: successCheck,
      })),
    };
  });
  return {
    schemaVersion: COLLABORATION_SCHEMA_VERSION,
    organization: options.organization,
    assessmentDate: options.date ?? today(),
    auditor: "AI-Native 组织只读审计 Skill",
    scope: options.scope ?? "评估团队在目标项目中的 AI-Native 协作、交付与反馈闭环。",
    setup: { teamSize: parseTeamSize(options["team-size"]), project: options.project.trim() },
    dimensions,
  };
}

function writeNoClobber(output, content) {
  const descriptor = fs.openSync(output, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, content, "utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

function init(argv) {
  const options = parseInitArgs(argv);
  if (options.help) {
    console.log(INIT_USAGE);
    return 0;
  }
  for (const field of ["organization", "team-size", "project"]) {
    if (!options[field]?.trim()) fail(`--${field} 为必填项`);
  }
  const input = buildInitAudit(options);
  // Validation happens before opening the output, so invalid input cannot create a file.
  calculateAudit(input);
  const output = path.resolve(options.output ?? "audit.json");
  if (!output || output === path.parse(output).root) fail("--output 必须是文件路径");
  const serialized = `${JSON.stringify(input, null, 2)}\n`;
  try {
    writeNoClobber(output, serialized);
  } catch (error) {
    if (error?.code === "EEXIST") fail("输出文件已存在，未覆盖");
    throw error;
  }
  console.log(`Wrote initialization JSON: ${output}`);
  return 0;
}

export function main(argv = process.argv.slice(2)) {
  if (argv[0] === "init") return init(argv.slice(1));
  if (argv.length === 0 || ["--help", "-h"].includes(argv[0])) console.log(INIT_USAGE);
  return reportMain(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Audit input invalid: ${error.message}`);
    process.exitCode = 1;
  }
}
